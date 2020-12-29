/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncActionDescriptor, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionExtensions } from 'vs/workbench/common/actions';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { EditorDescriptor, IEditorRegistry, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { RuntimeExtensionsEditor, IExtensionHostProfileService, StartExtensionHostProfileAction, StopExtensionHostProfileAction, CONTEXT_PROFILE_SESSION_STATE, CONTEXT_EXTENSION_HOST_PROFILE_RECORDED, SaveExtensionHostProfileAction } from 'vs/workbench/contrib/extensions/electron-browser/runtimeExtensionsEditor';
import { DebugExtensionHostAction } from 'vs/workbench/contrib/extensions/electron-browser/debugExtensionHostAction';
import { EditorInput, IEditorInputFactory, IEditorInputFactoryRegistry, Extensions as EditorInputExtensions, ActiveEditorContext } from 'vs/workbench/common/editor';
import { ExtensionHostProfileService } from 'vs/workbench/contrib/extensions/electron-browser/extensionProfileService';
import { RuntimeExtensionsInput } from 'vs/workbench/contrib/extensions/common/runtimeExtensionsInput';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ExtensionsAutoProfiler } from 'vs/workbench/contrib/extensions/electron-browser/extensionsAutoProfiler';
import { INativeWorkbenchEnvironmentService } from 'vs/workbench/services/environment/electron-sandbox/environmentService';
import { OpenExtensionsFolderAction } from 'vs/workbench/contrib/extensions/electron-sandbox/extensionsActions';
import { ExtensionsLabel } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IExtensionRecommendationNotificationService } from 'vs/platform/extensionRecommendations/common/extensionRecommendations';
import { ISharedProcessService } from 'vs/platform/ipc/electron-browser/sharedProcessService';
import { ExtensionRecommendationNotificationServiceChannel } from 'vs/platform/extensionRecommendations/electron-sandbox/extensionRecommendationsIpc';
import { Codicon } from 'vs/base/common/codicons';

// Singletons
registerSingleton(IExtensionHostProfileService, ExtensionHostProfileService, true);

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(ExtensionsAutoProfiler, LifecyclePhase.Eventually);

// Running Extensions Editor
Registry.as<IEditorRegistry>(EditorExtensions.Editors).registerEditor(
	EditorDescriptor.create(RuntimeExtensionsEditor, RuntimeExtensionsEditor.ID, localize('runtimeExtension', "Running Extensions")),
	[new SyncDescriptor(RuntimeExtensionsInput)]
);

class RuntimeExtensionsInputFactory implements IEditorInputFactory {
	canSerialize(editorInput: EditorInput): boolean {
		return true;
	}
	serialize(editorInput: EditorInput): string {
		return '';
	}
	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): EditorInput {
		return RuntimeExtensionsInput.instance;
	}
}

Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories).registerEditorInputFactory(RuntimeExtensionsInput.ID, RuntimeExtensionsInputFactory);


// Global actions
const actionRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions);

class ExtensionsContributions implements IWorkbenchContribution {

	constructor(
		@INativeWorkbenchEnvironmentService environmentService: INativeWorkbenchEnvironmentService,
		@IExtensionRecommendationNotificationService extensionRecommendationNotificationService: IExtensionRecommendationNotificationService,
		@ISharedProcessService sharedProcessService: ISharedProcessService,
	) {
		sharedProcessService.registerChannel('IExtensionRecommendationNotificationService', new ExtensionRecommendationNotificationServiceChannel(extensionRecommendationNotificationService));
		const openExtensionsFolderActionDescriptor = SyncActionDescriptor.from(OpenExtensionsFolderAction);
		actionRegistry.registerWorkbenchAction(openExtensionsFolderActionDescriptor, 'Extensions: Open Extensions Folder', ExtensionsLabel);
	}
}

workbenchRegistry.registerWorkbenchContribution(ExtensionsContributions, LifecyclePhase.Starting);

// Register Commands

CommandsRegistry.registerCommand(DebugExtensionHostAction.ID, (accessor: ServicesAccessor) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(DebugExtensionHostAction).run();
});

CommandsRegistry.registerCommand(StartExtensionHostProfileAction.ID, (accessor: ServicesAccessor) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(StartExtensionHostProfileAction, StartExtensionHostProfileAction.ID, StartExtensionHostProfileAction.LABEL).run();
});

CommandsRegistry.registerCommand(StopExtensionHostProfileAction.ID, (accessor: ServicesAccessor) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(StopExtensionHostProfileAction, StopExtensionHostProfileAction.ID, StopExtensionHostProfileAction.LABEL).run();
});

CommandsRegistry.registerCommand(SaveExtensionHostProfileAction.ID, (accessor: ServicesAccessor) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(SaveExtensionHostProfileAction, SaveExtensionHostProfileAction.ID, SaveExtensionHostProfileAction.LABEL).run();
});

// Running extensions

MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
	command: {
		id: DebugExtensionHostAction.ID,
		title: DebugExtensionHostAction.LABEL,
		icon: Codicon.debugStart
	},
	group: 'navigation',
	when: ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID)
});

MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
	command: {
		id: StartExtensionHostProfileAction.ID,
		title: StartExtensionHostProfileAction.LABEL,
		icon: Codicon.circleFilled
	},
	group: 'navigation',
	when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID), CONTEXT_PROFILE_SESSION_STATE.notEqualsTo('running'))
});

MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
	command: {
		id: StopExtensionHostProfileAction.ID,
		title: StopExtensionHostProfileAction.LABEL,
		icon: Codicon.debugStop
	},
	group: 'navigation',
	when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID), CONTEXT_PROFILE_SESSION_STATE.isEqualTo('running'))
});

MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
	command: {
		id: SaveExtensionHostProfileAction.ID,
		title: SaveExtensionHostProfileAction.LABEL,
		icon: Codicon.saveAll,
		precondition: CONTEXT_EXTENSION_HOST_PROFILE_RECORDED
	},
	group: 'navigation',
	when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(RuntimeExtensionsEditor.ID))
});
