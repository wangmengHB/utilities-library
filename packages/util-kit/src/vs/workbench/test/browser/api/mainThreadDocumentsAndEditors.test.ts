/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { MainThreadDocumentsAndEditors } from 'vs/workbench/api/browser/mainThreadDocumentsAndEditors';
import { SingleProxyRPCProtocol } from './testRPCProtocol';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { ModelServiceImpl } from 'vs/editor/common/services/modelServiceImpl';
import { TestCodeEditorService } from 'vs/editor/test/browser/editorTestServices';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { ExtHostDocumentsAndEditorsShape, IDocumentsAndEditorsDelta } from 'vs/workbench/api/common/extHost.protocol';
import { createTestCodeEditor, ITestCodeEditor } from 'vs/editor/test/browser/testCodeEditor';
import { mock } from 'vs/base/test/common/mock';
import { TestEditorService, TestEditorGroupsService, TestEnvironmentService, TestPathService } from 'vs/workbench/test/browser/workbenchTestServices';
import { Event } from 'vs/base/common/event';
import { ITextModel } from 'vs/editor/common/model';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { IFileService } from 'vs/platform/files/common/files';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { NullLogService } from 'vs/platform/log/common/log';
import { UndoRedoService } from 'vs/platform/undoRedo/common/undoRedoService';
import { TestDialogService } from 'vs/platform/dialogs/test/common/testDialogService';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestTextResourcePropertiesService, TestWorkingCopyFileService } from 'vs/workbench/test/common/workbenchTestServices';
import { UriIdentityService } from 'vs/workbench/services/uriIdentity/common/uriIdentityService';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

suite('MainThreadDocumentsAndEditors', () => {

	let modelService: ModelServiceImpl;
	let codeEditorService: TestCodeEditorService;
	let textFileService: ITextFileService;
	let deltas: IDocumentsAndEditorsDelta[] = [];
	const hugeModelString = new Array(2 + (50 * 1024 * 1024)).join('-');

	function myCreateTestCodeEditor(model: ITextModel | undefined): ITestCodeEditor {
		return createTestCodeEditor({
			model: model,
			serviceCollection: new ServiceCollection(
				[ICodeEditorService, codeEditorService]
			)
		});
	}

	setup(() => {
		deltas.length = 0;
		const configService = new TestConfigurationService();
		configService.setUserConfiguration('editor', { 'detectIndentation': false });
		const dialogService = new TestDialogService();
		const notificationService = new TestNotificationService();
		const undoRedoService = new UndoRedoService(dialogService, notificationService);
		modelService = new ModelServiceImpl(configService, new TestTextResourcePropertiesService(configService), new TestThemeService(), new NullLogService(), undoRedoService);
		codeEditorService = new TestCodeEditorService();
		textFileService = new class extends mock<ITextFileService>() {
			isDirty() { return false; }
			files = <any>{
				onDidSave: Event.None,
				onDidRevert: Event.None,
				onDidChangeDirty: Event.None
			};
		};
		const workbenchEditorService = new TestEditorService();
		const editorGroupService = new TestEditorGroupsService();

		const fileService = new class extends mock<IFileService>() {
			onDidRunOperation = Event.None;
			onDidChangeFileSystemProviderCapabilities = Event.None;
			onDidChangeFileSystemProviderRegistrations = Event.None;
		};

		new MainThreadDocumentsAndEditors(
			SingleProxyRPCProtocol(new class extends mock<ExtHostDocumentsAndEditorsShape>() {
				$acceptDocumentsAndEditorsDelta(delta: IDocumentsAndEditorsDelta) { deltas.push(delta); }
			}),
			modelService,
			textFileService,
			workbenchEditorService,
			codeEditorService,
			fileService,
			null!,
			editorGroupService,
			null!,
			new class extends mock<IPanelService>() implements IPanelService {
				declare readonly _serviceBrand: undefined;
				onDidPanelOpen = Event.None;
				onDidPanelClose = Event.None;
				getActivePanel() {
					return undefined;
				}
			},
			TestEnvironmentService,
			new TestWorkingCopyFileService(),
			new UriIdentityService(fileService),
			new class extends mock<IClipboardService>() {
				readText() {
					return Promise.resolve('clipboard_contents');
				}
			},
			new TestPathService()
		);
	});


	test('Model#add', () => {
		deltas.length = 0;

		modelService.createModel('farboo', null);

		assert.equal(deltas.length, 1);
		const [delta] = deltas;

		assert.equal(delta.addedDocuments!.length, 1);
		assert.equal(delta.removedDocuments, undefined);
		assert.equal(delta.addedEditors, undefined);
		assert.equal(delta.removedEditors, undefined);
		assert.equal(delta.newActiveEditor, null);
	});

	test('ignore huge model', function () {
		this.timeout(1000 * 60); // increase timeout for this one test

		const model = modelService.createModel(hugeModelString, null);
		assert.ok(model.isTooLargeForSyncing());

		assert.equal(deltas.length, 1);
		const [delta] = deltas;
		assert.equal(delta.newActiveEditor, null);
		assert.equal(delta.addedDocuments, undefined);
		assert.equal(delta.removedDocuments, undefined);
		assert.equal(delta.addedEditors, undefined);
		assert.equal(delta.removedEditors, undefined);
	});

	test('ignore simple widget model', function () {
		this.timeout(1000 * 60); // increase timeout for this one test

		const model = modelService.createModel('test', null, undefined, true);
		assert.ok(model.isForSimpleWidget);

		assert.equal(deltas.length, 1);
		const [delta] = deltas;
		assert.equal(delta.newActiveEditor, null);
		assert.equal(delta.addedDocuments, undefined);
		assert.equal(delta.removedDocuments, undefined);
		assert.equal(delta.addedEditors, undefined);
		assert.equal(delta.removedEditors, undefined);
	});

	test('ignore huge model from editor', function () {
		this.timeout(1000 * 60); // increase timeout for this one test

		const model = modelService.createModel(hugeModelString, null);
		const editor = myCreateTestCodeEditor(model);

		assert.equal(deltas.length, 1);
		deltas.length = 0;
		assert.equal(deltas.length, 0);

		editor.dispose();
	});

	test('ignore editor w/o model', () => {
		const editor = myCreateTestCodeEditor(undefined);
		assert.equal(deltas.length, 1);
		const [delta] = deltas;
		assert.equal(delta.newActiveEditor, null);
		assert.equal(delta.addedDocuments, undefined);
		assert.equal(delta.removedDocuments, undefined);
		assert.equal(delta.addedEditors, undefined);
		assert.equal(delta.removedEditors, undefined);

		editor.dispose();
	});

	test('editor with model', () => {
		deltas.length = 0;

		const model = modelService.createModel('farboo', null);
		const editor = myCreateTestCodeEditor(model);

		assert.equal(deltas.length, 2);
		const [first, second] = deltas;
		assert.equal(first.addedDocuments!.length, 1);
		assert.equal(first.newActiveEditor, null);
		assert.equal(first.removedDocuments, undefined);
		assert.equal(first.addedEditors, undefined);
		assert.equal(first.removedEditors, undefined);

		assert.equal(second.addedEditors!.length, 1);
		assert.equal(second.addedDocuments, undefined);
		assert.equal(second.removedDocuments, undefined);
		assert.equal(second.removedEditors, undefined);
		assert.equal(second.newActiveEditor, undefined);

		editor.dispose();
	});

	test('editor with dispos-ed/-ing model', () => {
		modelService.createModel('foobar', null);
		const model = modelService.createModel('farboo', null);
		const editor = myCreateTestCodeEditor(model);

		// ignore things until now
		deltas.length = 0;

		modelService.destroyModel(model.uri);
		assert.equal(deltas.length, 1);
		const [first] = deltas;

		assert.equal(first.newActiveEditor, null);
		assert.equal(first.removedEditors!.length, 1);
		assert.equal(first.removedDocuments!.length, 1);
		assert.equal(first.addedDocuments, undefined);
		assert.equal(first.addedEditors, undefined);

		editor.dispose();
	});
});
