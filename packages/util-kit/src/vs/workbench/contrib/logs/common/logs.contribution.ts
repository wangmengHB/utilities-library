/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { join } from 'vs/base/common/path';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionExtensions, CATEGORIES } from 'vs/workbench/common/actions';
import { Action2, registerAction2, SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { SetLogLevelAction, OpenWindowSessionLogFileAction } from 'vs/workbench/contrib/logs/common/logsActions';
import * as Constants from 'vs/workbench/contrib/logs/common/logConstants';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IFileService, FileChangeType, whenProviderRegistered } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { IOutputChannelRegistry, Extensions as OutputExt } from 'vs/workbench/services/output/common/output';
import { Disposable } from 'vs/base/common/lifecycle';
import { ILogService, LogLevel } from 'vs/platform/log/common/log';
import { dirname } from 'vs/base/common/resources';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { isWeb } from 'vs/base/common/platform';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { LogsDataCleaner } from 'vs/workbench/contrib/logs/common/logsDataCleaner';
import { IOutputService } from 'vs/workbench/contrib/output/common/output';

const workbenchActionsRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions);
workbenchActionsRegistry.registerWorkbenchAction(SyncActionDescriptor.from(SetLogLevelAction), 'Developer: Set Log Level...', CATEGORIES.Developer.value);

class LogOutputChannels extends Disposable implements IWorkbenchContribution {

	constructor(
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.registerCommonContributions();
		if (isWeb) {
			this.registerWebContributions();
		} else {
			this.registerNativeContributions();
		}
	}

	private registerCommonContributions(): void {
		this.registerLogChannel(Constants.userDataSyncLogChannelId, nls.localize('userDataSyncLog', "Settings Sync"), this.environmentService.userDataSyncLogResource);
		this.registerLogChannel(Constants.rendererLogChannelId, nls.localize('rendererLog', "Window"), this.environmentService.logFile);

		const registerTelemetryChannel = (level: LogLevel) => {
			if (level === LogLevel.Trace && !Registry.as<IOutputChannelRegistry>(OutputExt.OutputChannels).getChannel(Constants.telemetryLogChannelId)) {
				this.registerLogChannel(Constants.telemetryLogChannelId, nls.localize('telemetryLog', "Telemetry"), this.environmentService.telemetryLogResource);
			}
		};
		registerTelemetryChannel(this.logService.getLevel());
		this.logService.onDidChangeLogLevel(registerTelemetryChannel);

		registerAction2(class ShowWindowLogAction extends Action2 {
			constructor() {
				super({
					id: Constants.showWindowLogActionId,
					title: { value: nls.localize('show window log', "Show Window Log"), original: 'Show Window Log' },
					category: CATEGORIES.Developer,
					f1: true
				});
			}
			async run(servicesAccessor: ServicesAccessor): Promise<void> {
				const outputService = servicesAccessor.get(IOutputService);
				outputService.showChannel(Constants.rendererLogChannelId);
			}
		});
	}

	private registerWebContributions(): void {
		this.instantiationService.createInstance(LogsDataCleaner);

		const workbenchActionsRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions);
		workbenchActionsRegistry.registerWorkbenchAction(SyncActionDescriptor.from(OpenWindowSessionLogFileAction), 'Developer: Open Window Log File (Session)...', CATEGORIES.Developer.value);
	}

	private registerNativeContributions(): void {
		this.registerLogChannel(Constants.mainLogChannelId, nls.localize('mainLog', "Main"), URI.file(join(this.environmentService.logsPath, `main.log`)));
		this.registerLogChannel(Constants.sharedLogChannelId, nls.localize('sharedLog', "Shared"), URI.file(join(this.environmentService.logsPath, `sharedprocess.log`)));
	}

	private async registerLogChannel(id: string, label: string, file: URI): Promise<void> {
		await whenProviderRegistered(file, this.fileService);
		const outputChannelRegistry = Registry.as<IOutputChannelRegistry>(OutputExt.OutputChannels);

		/* watch first and then check if file exists so that to avoid missing file creation event after watching #102117 */
		const watcher = this.fileService.watch(dirname(file));
		const exists = await this.fileService.exists(file);
		if (exists) {
			watcher.dispose();
			outputChannelRegistry.registerChannel({ id, label, file, log: true });
			return;
		}

		const disposable = this.fileService.onDidFilesChange(e => {
			if (e.contains(file, FileChangeType.ADDED, FileChangeType.UPDATED)) {
				watcher.dispose();
				disposable.dispose();
				outputChannelRegistry.registerChannel({ id, label, file, log: true });
			}
		});
	}

}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(LogOutputChannels, LifecyclePhase.Restored);
