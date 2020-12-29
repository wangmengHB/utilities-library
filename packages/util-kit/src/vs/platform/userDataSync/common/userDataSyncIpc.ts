/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IServerChannel, IChannel, IPCServer } from 'vs/base/parts/ipc/common/ipc';
import { Event } from 'vs/base/common/event';
import { IUserDataSyncService, IUserDataSyncUtilService, IUserDataAutoSyncService, IManualSyncTask, IUserDataManifest, IUserDataSyncStoreManagementService, SyncStatus } from 'vs/platform/userDataSync/common/userDataSync';
import { URI } from 'vs/base/common/uri';
import { IStringDictionary } from 'vs/base/common/collections';
import { FormattingOptions } from 'vs/base/common/jsonFormatter';
import { ILogService } from 'vs/platform/log/common/log';
import { IUserDataSyncMachinesService } from 'vs/platform/userDataSync/common/userDataSyncMachines';
import { IUserDataSyncAccountService } from 'vs/platform/userDataSync/common/userDataSyncAccount';

export class UserDataSyncChannel implements IServerChannel {

	constructor(private server: IPCServer, private readonly service: IUserDataSyncService, private readonly logService: ILogService) { }

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onDidChangeStatus': return this.service.onDidChangeStatus;
			case 'onDidChangeConflicts': return this.service.onDidChangeConflicts;
			case 'onDidChangeLocal': return this.service.onDidChangeLocal;
			case 'onDidChangeLastSyncTime': return this.service.onDidChangeLastSyncTime;
			case 'onSyncErrors': return this.service.onSyncErrors;
			case 'onDidResetLocal': return this.service.onDidResetLocal;
			case 'onDidResetRemote': return this.service.onDidResetRemote;
		}
		throw new Error(`Event not found: ${event}`);
	}

	async call(context: any, command: string, args?: any): Promise<any> {
		try {
			const result = await this._call(context, command, args);
			return result;
		} catch (e) {
			this.logService.error(e);
			throw e;
		}
	}

	private _call(context: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case '_getInitialData': return Promise.resolve([this.service.status, this.service.conflicts, this.service.lastSyncTime]);

			case 'createManualSyncTask': return this.createManualSyncTask();

			case 'replace': return this.service.replace(URI.revive(args[0]));
			case 'reset': return this.service.reset();
			case 'resetRemote': return this.service.resetRemote();
			case 'resetLocal': return this.service.resetLocal();
			case 'hasPreviouslySynced': return this.service.hasPreviouslySynced();
			case 'hasLocalData': return this.service.hasLocalData();
			case 'accept': return this.service.accept(args[0], URI.revive(args[1]), args[2], args[3]);
			case 'resolveContent': return this.service.resolveContent(URI.revive(args[0]));
			case 'getLocalSyncResourceHandles': return this.service.getLocalSyncResourceHandles(args[0]);
			case 'getRemoteSyncResourceHandles': return this.service.getRemoteSyncResourceHandles(args[0]);
			case 'getAssociatedResources': return this.service.getAssociatedResources(args[0], { created: args[1].created, uri: URI.revive(args[1].uri) });
			case 'getMachineId': return this.service.getMachineId(args[0], { created: args[1].created, uri: URI.revive(args[1].uri) });
		}
		throw new Error('Invalid call');
	}

	private async createManualSyncTask(): Promise<{ id: string, manifest: IUserDataManifest | null, status: SyncStatus }> {
		const manualSyncTask = await this.service.createManualSyncTask();
		const manualSyncTaskChannel = new ManualSyncTaskChannel(manualSyncTask, this.logService);
		this.server.registerChannel(`manualSyncTask-${manualSyncTask.id}`, manualSyncTaskChannel);
		return { id: manualSyncTask.id, manifest: manualSyncTask.manifest, status: manualSyncTask.status };
	}
}

class ManualSyncTaskChannel implements IServerChannel {

	constructor(
		private readonly manualSyncTask: IManualSyncTask,
		private readonly logService: ILogService
	) { }

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onSynchronizeResources': return this.manualSyncTask.onSynchronizeResources;
		}
		throw new Error(`Event not found: ${event}`);
	}

	async call(context: any, command: string, args?: any): Promise<any> {
		try {
			const result = await this._call(context, command, args);
			return result;
		} catch (e) {
			this.logService.error(e);
			throw e;
		}
	}

	private async _call(context: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'preview': return this.manualSyncTask.preview();
			case 'accept': return this.manualSyncTask.accept(URI.revive(args[0]), args[1]);
			case 'merge': return this.manualSyncTask.merge(URI.revive(args[0]));
			case 'discard': return this.manualSyncTask.discard(URI.revive(args[0]));
			case 'discardConflicts': return this.manualSyncTask.discardConflicts();
			case 'apply': return this.manualSyncTask.apply();
			case 'pull': return this.manualSyncTask.pull();
			case 'push': return this.manualSyncTask.push();
			case 'stop': return this.manualSyncTask.stop();
			case '_getStatus': return this.manualSyncTask.status;
			case 'dispose': return this.manualSyncTask.dispose();
		}
		throw new Error('Invalid call');
	}

}

export class UserDataAutoSyncChannel implements IServerChannel {

	constructor(private readonly service: IUserDataAutoSyncService) { }

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onError': return this.service.onError;
		}
		throw new Error(`Event not found: ${event}`);
	}

	call(context: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'triggerSync': return this.service.triggerSync(args[0], args[1], args[2]);
			case 'turnOn': return this.service.turnOn();
			case 'turnOff': return this.service.turnOff(args[0]);
		}
		throw new Error('Invalid call');
	}
}

export class UserDataSycnUtilServiceChannel implements IServerChannel {

	constructor(private readonly service: IUserDataSyncUtilService) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	call(context: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'resolveDefaultIgnoredSettings': return this.service.resolveDefaultIgnoredSettings();
			case 'resolveUserKeybindings': return this.service.resolveUserBindings(args[0]);
			case 'resolveFormattingOptions': return this.service.resolveFormattingOptions(URI.revive(args[0]));
		}
		throw new Error('Invalid call');
	}
}

export class UserDataSyncUtilServiceClient implements IUserDataSyncUtilService {

	declare readonly _serviceBrand: undefined;

	constructor(private readonly channel: IChannel) {
	}

	async resolveDefaultIgnoredSettings(): Promise<string[]> {
		return this.channel.call('resolveDefaultIgnoredSettings');
	}

	async resolveUserBindings(userbindings: string[]): Promise<IStringDictionary<string>> {
		return this.channel.call('resolveUserKeybindings', [userbindings]);
	}

	async resolveFormattingOptions(file: URI): Promise<FormattingOptions> {
		return this.channel.call('resolveFormattingOptions', [file]);
	}

}

export class UserDataSyncMachinesServiceChannel implements IServerChannel {

	constructor(private readonly service: IUserDataSyncMachinesService) { }

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onDidChange': return this.service.onDidChange;
		}
		throw new Error(`Event not found: ${event}`);
	}

	async call(context: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'getMachines': return this.service.getMachines();
			case 'addCurrentMachine': return this.service.addCurrentMachine();
			case 'removeCurrentMachine': return this.service.removeCurrentMachine();
			case 'renameMachine': return this.service.renameMachine(args[0], args[1]);
			case 'setEnablement': return this.service.setEnablement(args[0], args[1]);
		}
		throw new Error('Invalid call');
	}

}

export class UserDataSyncAccountServiceChannel implements IServerChannel {
	constructor(private readonly service: IUserDataSyncAccountService) { }

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onDidChangeAccount': return this.service.onDidChangeAccount;
			case 'onTokenFailed': return this.service.onTokenFailed;
		}
		throw new Error(`Event not found: ${event}`);
	}

	call(context: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case '_getInitialData': return Promise.resolve(this.service.account);
			case 'updateAccount': return this.service.updateAccount(args);
		}
		throw new Error('Invalid call');
	}
}

export class UserDataSyncStoreManagementServiceChannel implements IServerChannel {
	constructor(private readonly service: IUserDataSyncStoreManagementService) { }

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onDidChangeUserDataSyncStore': return this.service.onDidChangeUserDataSyncStore;
		}
		throw new Error(`Event not found: ${event}`);
	}

	call(context: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'switch': return this.service.switch(args[0]);
			case 'getPreviousUserDataSyncStore': return this.service.getPreviousUserDataSyncStore();
		}
		throw new Error('Invalid call');
	}
}
