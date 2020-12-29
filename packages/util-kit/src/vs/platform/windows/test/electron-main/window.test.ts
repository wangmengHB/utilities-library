/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'vs/base/common/path';
import { findWindowOnFile } from 'vs/platform/windows/electron-main/windowsFinder';
import { ICodeWindow, IWindowState } from 'vs/platform/windows/electron-main/windows';
import { IWorkspaceIdentifier } from 'vs/platform/workspaces/common/workspaces';
import { toWorkspaceFolders } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';
import { getPathFromAmdModule } from 'vs/base/common/amd';
import { extUriBiasedIgnorePathCase } from 'vs/base/common/resources';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Event } from 'vs/base/common/event';
import { UriDto } from 'vs/base/common/types';
import { ICommandAction } from 'vs/platform/actions/common/actions';
import { NativeParsedArgs } from 'vs/platform/environment/common/argv';
import { INativeWindowConfiguration } from 'vs/platform/windows/common/windows';

const fixturesFolder = getPathFromAmdModule(require, './fixtures');

const testWorkspace: IWorkspaceIdentifier = {
	id: Date.now().toString(),
	configPath: URI.file(path.join(fixturesFolder, 'workspaces.json'))
};

const testWorkspaceFolders = toWorkspaceFolders([{ path: path.join(fixturesFolder, 'vscode_workspace_1_folder') }, { path: path.join(fixturesFolder, 'vscode_workspace_2_folder') }], testWorkspace.configPath, extUriBiasedIgnorePathCase);
const localWorkspaceResolver = (workspace: any) => { return workspace === testWorkspace ? { id: testWorkspace.id, configPath: workspace.configPath, folders: testWorkspaceFolders } : null; };

function createTestCodeWindow(options: { lastFocusTime: number, openedFolderUri?: URI, openedWorkspace?: IWorkspaceIdentifier }): ICodeWindow {
	return new class implements ICodeWindow {
		onLoad: Event<void> = Event.None;
		onReady: Event<void> = Event.None;
		onClose: Event<void> = Event.None;
		onDestroy: Event<void> = Event.None;
		whenClosedOrLoaded: Promise<void> = Promise.resolve();
		id: number = -1;
		win: Electron.BrowserWindow = undefined!;
		config: INativeWindowConfiguration | undefined;
		openedFolderUri = options.openedFolderUri;
		openedWorkspace = options.openedWorkspace;
		backupPath?: string | undefined;
		remoteAuthority?: string | undefined;
		isExtensionDevelopmentHost = false;
		isExtensionTestHost = false;
		lastFocusTime = options.lastFocusTime;
		isFullScreen = false;
		isReady = true;
		hasHiddenTitleBarStyle = false;

		ready(): Promise<ICodeWindow> { throw new Error('Method not implemented.'); }
		setReady(): void { throw new Error('Method not implemented.'); }
		addTabbedWindow(window: ICodeWindow): void { throw new Error('Method not implemented.'); }
		load(config: INativeWindowConfiguration, isReload?: boolean): void { throw new Error('Method not implemented.'); }
		reload(cli?: NativeParsedArgs): void { throw new Error('Method not implemented.'); }
		focus(options?: { force: boolean; }): void { throw new Error('Method not implemented.'); }
		close(): void { throw new Error('Method not implemented.'); }
		getBounds(): Electron.Rectangle { throw new Error('Method not implemented.'); }
		send(channel: string, ...args: any[]): void { throw new Error('Method not implemented.'); }
		sendWhenReady(channel: string, token: CancellationToken, ...args: any[]): void { throw new Error('Method not implemented.'); }
		toggleFullScreen(): void { throw new Error('Method not implemented.'); }
		isMinimized(): boolean { throw new Error('Method not implemented.'); }
		setRepresentedFilename(name: string): void { throw new Error('Method not implemented.'); }
		getRepresentedFilename(): string | undefined { throw new Error('Method not implemented.'); }
		setDocumentEdited(edited: boolean): void { throw new Error('Method not implemented.'); }
		isDocumentEdited(): boolean { throw new Error('Method not implemented.'); }
		handleTitleDoubleClick(): void { throw new Error('Method not implemented.'); }
		updateTouchBar(items: UriDto<ICommandAction>[][]): void { throw new Error('Method not implemented.'); }
		serializeWindowState(): IWindowState { throw new Error('Method not implemented'); }
		dispose(): void { }
	};
}

const vscodeFolderWindow: ICodeWindow = createTestCodeWindow({ lastFocusTime: 1, openedFolderUri: URI.file(path.join(fixturesFolder, 'vscode_folder')) });
const lastActiveWindow: ICodeWindow = createTestCodeWindow({ lastFocusTime: 3, openedFolderUri: undefined });
const noVscodeFolderWindow: ICodeWindow = createTestCodeWindow({ lastFocusTime: 2, openedFolderUri: URI.file(path.join(fixturesFolder, 'no_vscode_folder')) });
const windows: ICodeWindow[] = [
	vscodeFolderWindow,
	lastActiveWindow,
	noVscodeFolderWindow,
];

suite('WindowsFinder', () => {

	test('New window without folder when no windows exist', () => {
		assert.equal(findWindowOnFile([], URI.file('nonexisting'), localWorkspaceResolver), null);
		assert.equal(findWindowOnFile([], URI.file(path.join(fixturesFolder, 'no_vscode_folder', 'file.txt')), localWorkspaceResolver), null);
	});

	test('Existing window with folder', () => {
		assert.equal(findWindowOnFile(windows, URI.file(path.join(fixturesFolder, 'no_vscode_folder', 'file.txt')), localWorkspaceResolver), noVscodeFolderWindow);

		assert.equal(findWindowOnFile(windows, URI.file(path.join(fixturesFolder, 'vscode_folder', 'file.txt')), localWorkspaceResolver), vscodeFolderWindow);

		const window: ICodeWindow = createTestCodeWindow({ lastFocusTime: 1, openedFolderUri: URI.file(path.join(fixturesFolder, 'vscode_folder', 'nested_folder')) });
		assert.equal(findWindowOnFile([window], URI.file(path.join(fixturesFolder, 'vscode_folder', 'nested_folder', 'subfolder', 'file.txt')), localWorkspaceResolver), window);
	});

	test('More specific existing window wins', () => {
		const window: ICodeWindow = createTestCodeWindow({ lastFocusTime: 2, openedFolderUri: URI.file(path.join(fixturesFolder, 'no_vscode_folder')) });
		const nestedFolderWindow: ICodeWindow = createTestCodeWindow({ lastFocusTime: 1, openedFolderUri: URI.file(path.join(fixturesFolder, 'no_vscode_folder', 'nested_folder')) });
		assert.equal(findWindowOnFile([window, nestedFolderWindow], URI.file(path.join(fixturesFolder, 'no_vscode_folder', 'nested_folder', 'subfolder', 'file.txt')), localWorkspaceResolver), nestedFolderWindow);
	});

	test('Workspace folder wins', () => {
		const window: ICodeWindow = createTestCodeWindow({ lastFocusTime: 1, openedWorkspace: testWorkspace });
		assert.equal(findWindowOnFile([window], URI.file(path.join(fixturesFolder, 'vscode_workspace_2_folder', 'nested_vscode_folder', 'subfolder', 'file.txt')), localWorkspaceResolver), window);
	});
});
