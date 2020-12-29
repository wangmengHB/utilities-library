/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'vs/base/common/path';
import * as resources from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { Event, Emitter } from 'vs/base/common/event';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkspaceContextService, IWorkspace, WorkbenchState, IWorkspaceFolder, IWorkspaceFoldersChangeEvent, Workspace } from 'vs/platform/workspace/common/workspace';
import { TestWorkspace } from 'vs/platform/workspace/test/common/testWorkspace';
import { IWorkspaceIdentifier, ISingleFolderWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier } from 'vs/platform/workspaces/common/workspaces';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { isLinux, isMacintosh } from 'vs/base/common/platform';
import { InMemoryStorageService, WillSaveStateReason } from 'vs/platform/storage/common/storage';
import { WorkingCopyService, IWorkingCopy, IWorkingCopyBackup, WorkingCopyCapabilities } from 'vs/workbench/services/workingCopy/common/workingCopyService';
import { NullExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IWorkingCopyFileService, IWorkingCopyFileOperationParticipant, WorkingCopyFileEvent, IDeleteOperation, ICopyOperation, IMoveOperation, IFileOperationUndoRedoInfo, ICreateFileOperation, ICreateOperation } from 'vs/workbench/services/workingCopy/common/workingCopyFileService';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { IFileStatWithMetadata } from 'vs/platform/files/common/files';
import { ISaveOptions, IRevertOptions } from 'vs/workbench/common/editor';
import { CancellationToken } from 'vs/base/common/cancellation';

export class TestTextResourcePropertiesService implements ITextResourcePropertiesService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
	}

	getEOL(resource: URI, language?: string): string {
		const eol = this.configurationService.getValue<string>('files.eol', { overrideIdentifier: language, resource });
		if (eol && eol !== 'auto') {
			return eol;
		}
		return (isLinux || isMacintosh) ? '\n' : '\r\n';
	}
}

export class TestContextService implements IWorkspaceContextService {

	declare readonly _serviceBrand: undefined;

	private workspace: Workspace;
	private options: object;

	private readonly _onDidChangeWorkspaceName: Emitter<void>;
	get onDidChangeWorkspaceName(): Event<void> { return this._onDidChangeWorkspaceName.event; }

	private readonly _onDidChangeWorkspaceFolders: Emitter<IWorkspaceFoldersChangeEvent>;
	get onDidChangeWorkspaceFolders(): Event<IWorkspaceFoldersChangeEvent> { return this._onDidChangeWorkspaceFolders.event; }

	private readonly _onDidChangeWorkbenchState: Emitter<WorkbenchState>;
	get onDidChangeWorkbenchState(): Event<WorkbenchState> { return this._onDidChangeWorkbenchState.event; }

	constructor(workspace = TestWorkspace, options = null) {
		this.workspace = workspace;
		this.options = options || Object.create(null);
		this._onDidChangeWorkspaceName = new Emitter<void>();
		this._onDidChangeWorkspaceFolders = new Emitter<IWorkspaceFoldersChangeEvent>();
		this._onDidChangeWorkbenchState = new Emitter<WorkbenchState>();
	}

	getFolders(): IWorkspaceFolder[] {
		return this.workspace ? this.workspace.folders : [];
	}

	getWorkbenchState(): WorkbenchState {
		if (this.workspace.configuration) {
			return WorkbenchState.WORKSPACE;
		}

		if (this.workspace.folders.length) {
			return WorkbenchState.FOLDER;
		}

		return WorkbenchState.EMPTY;
	}

	getCompleteWorkspace(): Promise<IWorkspace> {
		return Promise.resolve(this.getWorkspace());
	}

	getWorkspace(): IWorkspace {
		return this.workspace;
	}

	getWorkspaceFolder(resource: URI): IWorkspaceFolder | null {
		return this.workspace.getFolder(resource);
	}

	setWorkspace(workspace: any): void {
		this.workspace = workspace;
	}

	getOptions() {
		return this.options;
	}

	updateOptions() { }

	isInsideWorkspace(resource: URI): boolean {
		if (resource && this.workspace) {
			return resources.isEqualOrParent(resource, this.workspace.folders[0].uri);
		}

		return false;
	}

	toResource(workspaceRelativePath: string): URI {
		return URI.file(join('C:\\', workspaceRelativePath));
	}

	isCurrentWorkspace(workspaceIdentifier: ISingleFolderWorkspaceIdentifier | IWorkspaceIdentifier): boolean {
		return isSingleFolderWorkspaceIdentifier(workspaceIdentifier) && resources.isEqual(this.workspace.folders[0].uri, workspaceIdentifier);
	}
}

export class TestStorageService extends InMemoryStorageService {

	emitWillSaveState(reason: WillSaveStateReason): void {
		super.emitWillSaveState(reason);
	}
}

export class TestWorkingCopyService extends WorkingCopyService { }

export class TestWorkingCopy extends Disposable implements IWorkingCopy {

	private readonly _onDidChangeDirty = this._register(new Emitter<void>());
	readonly onDidChangeDirty = this._onDidChangeDirty.event;

	private readonly _onDidChangeContent = this._register(new Emitter<void>());
	readonly onDidChangeContent = this._onDidChangeContent.event;

	private readonly _onDispose = this._register(new Emitter<void>());
	readonly onDispose = this._onDispose.event;

	readonly capabilities = WorkingCopyCapabilities.None;

	readonly name = resources.basename(this.resource);

	private dirty = false;

	constructor(public readonly resource: URI, isDirty = false) {
		super();

		this.dirty = isDirty;
	}

	setDirty(dirty: boolean): void {
		if (this.dirty !== dirty) {
			this.dirty = dirty;
			this._onDidChangeDirty.fire();
		}
	}

	setContent(content: string): void {
		this._onDidChangeContent.fire();
	}

	isDirty(): boolean {
		return this.dirty;
	}

	async save(options?: ISaveOptions): Promise<boolean> {
		return true;
	}

	async revert(options?: IRevertOptions): Promise<void> {
		this.setDirty(false);
	}

	async backup(token: CancellationToken): Promise<IWorkingCopyBackup> {
		return {};
	}

	dispose(): void {
		this._onDispose.fire();

		super.dispose();
	}
}

export class TestWorkingCopyFileService implements IWorkingCopyFileService {

	declare readonly _serviceBrand: undefined;

	onWillRunWorkingCopyFileOperation: Event<WorkingCopyFileEvent> = Event.None;
	onDidFailWorkingCopyFileOperation: Event<WorkingCopyFileEvent> = Event.None;
	onDidRunWorkingCopyFileOperation: Event<WorkingCopyFileEvent> = Event.None;

	addFileOperationParticipant(participant: IWorkingCopyFileOperationParticipant): IDisposable { return Disposable.None; }

	async delete(operations: IDeleteOperation[], undoInfo?: IFileOperationUndoRedoInfo, token?: CancellationToken): Promise<void> { }

	registerWorkingCopyProvider(provider: (resourceOrFolder: URI) => IWorkingCopy[]): IDisposable { return Disposable.None; }

	getDirty(resource: URI): IWorkingCopy[] { return []; }

	create(operation: ICreateFileOperation, undoInfo?: IFileOperationUndoRedoInfo, token?: CancellationToken): Promise<IFileStatWithMetadata> { throw new Error('Method not implemented.'); }
	createFolder(operation: ICreateOperation, undoInfo?: IFileOperationUndoRedoInfo, token?: CancellationToken): Promise<IFileStatWithMetadata> { throw new Error('Method not implemented.'); }

	move(operations: IMoveOperation[], undoInfo?: IFileOperationUndoRedoInfo): Promise<IFileStatWithMetadata[]> { throw new Error('Method not implemented.'); }

	copy(operations: ICopyOperation[], undoInfo?: IFileOperationUndoRedoInfo, token?: CancellationToken): Promise<IFileStatWithMetadata[]> { throw new Error('Method not implemented.'); }
}

export function mock<T>(): Ctor<T> {
	return function () { } as any;
}

export interface Ctor<T> {
	new(): T;
}

export class TestExtensionService extends NullExtensionService { }
