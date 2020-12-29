/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/panelpart';
import * as nls from 'vs/nls';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { Action } from 'vs/base/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncActionDescriptor, MenuId, MenuRegistry, registerAction2, Action2 } from 'vs/platform/actions/common/actions';
import { IWorkbenchActionRegistry, Extensions as WorkbenchExtensions, CATEGORIES } from 'vs/workbench/common/actions';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { IWorkbenchLayoutService, Parts, Position, positionToString } from 'vs/workbench/services/layout/browser/layoutService';
import { ActivityAction, ToggleCompositePinnedAction, ICompositeBar } from 'vs/workbench/browser/parts/compositeBarActions';
import { IActivity } from 'vs/workbench/common/activity';
import { ActivePanelContext, PanelMaximizedContext, PanelPositionContext, PanelVisibleContext } from 'vs/workbench/common/panel';
import { ContextKeyExpression } from 'vs/platform/contextkey/common/contextkey';
import { Codicon } from 'vs/base/common/codicons';
import { registerIcon } from 'vs/platform/theme/common/iconRegistry';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';

const maximizeIcon = registerIcon('panel-maximize', Codicon.chevronUp, nls.localize('maximizeIcon', 'Icon to maximize a panel.'));
const restoreIcon = registerIcon('panel-restore', Codicon.chevronDown, nls.localize('restoreIcon', 'Icon to restore a panel.'));
const closeIcon = registerIcon('panel-close', Codicon.close, nls.localize('closeIcon', 'Icon to close a panel.'));

export class TogglePanelAction extends Action {

	static readonly ID = 'workbench.action.togglePanel';
	static readonly LABEL = nls.localize('togglePanel', "Toggle Panel");

	constructor(
		id: string,
		name: string,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
	) {
		super(id, name, layoutService.isVisible(Parts.PANEL_PART) ? 'panel expanded' : 'panel');
	}

	async run(): Promise<void> {
		this.layoutService.setPanelHidden(this.layoutService.isVisible(Parts.PANEL_PART));
	}
}

class FocusPanelAction extends Action {

	static readonly ID = 'workbench.action.focusPanel';
	static readonly LABEL = nls.localize('focusPanel', "Focus into Panel");

	constructor(
		id: string,
		label: string,
		@IPanelService private readonly panelService: IPanelService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
	) {
		super(id, label);
	}

	async run(): Promise<void> {

		// Show panel
		if (!this.layoutService.isVisible(Parts.PANEL_PART)) {
			this.layoutService.setPanelHidden(false);
		}

		// Focus into active panel
		let panel = this.panelService.getActivePanel();
		if (panel) {
			panel.focus();
		}
	}
}

const PositionPanelActionId = {
	LEFT: 'workbench.action.positionPanelLeft',
	RIGHT: 'workbench.action.positionPanelRight',
	BOTTOM: 'workbench.action.positionPanelBottom',
};

interface PanelActionConfig<T> {
	id: string;
	when: ContextKeyExpression;
	alias: string;
	label: string;
	value: T;
}

function createPositionPanelActionConfig(id: string, alias: string, label: string, position: Position): PanelActionConfig<Position> {
	return {
		id,
		alias,
		label,
		value: position,
		when: PanelPositionContext.notEqualsTo(positionToString(position))
	};
}

export const PositionPanelActionConfigs: PanelActionConfig<Position>[] = [
	createPositionPanelActionConfig(PositionPanelActionId.LEFT, 'View: Move Panel Left', nls.localize('positionPanelLeft', 'Move Panel Left'), Position.LEFT),
	createPositionPanelActionConfig(PositionPanelActionId.RIGHT, 'View: Move Panel Right', nls.localize('positionPanelRight', 'Move Panel Right'), Position.RIGHT),
	createPositionPanelActionConfig(PositionPanelActionId.BOTTOM, 'View: Move Panel To Bottom', nls.localize('positionPanelBottom', 'Move Panel To Bottom'), Position.BOTTOM),
];

const positionByActionId = new Map(PositionPanelActionConfigs.map(config => [config.id, config.value]));

export class SetPanelPositionAction extends Action {
	constructor(
		id: string,
		label: string,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
	) {
		super(id, label);
	}

	async run(): Promise<void> {
		const position = positionByActionId.get(this.id);
		this.layoutService.setPanelPosition(position === undefined ? Position.BOTTOM : position);
	}
}

export class PanelActivityAction extends ActivityAction {

	constructor(
		activity: IActivity,
		@IPanelService private readonly panelService: IPanelService
	) {
		super(activity);
	}

	async run(): Promise<void> {
		await this.panelService.openPanel(this.activity.id, true);
		this.activate();
	}

	setActivity(activity: IActivity): void {
		this.activity = activity;
	}
}

export class PlaceHolderPanelActivityAction extends PanelActivityAction {

	constructor(
		id: string,
		@IPanelService panelService: IPanelService
	) {
		super({ id, name: id }, panelService);
	}
}

export class PlaceHolderToggleCompositePinnedAction extends ToggleCompositePinnedAction {

	constructor(id: string, compositeBar: ICompositeBar) {
		super({ id, name: id, cssClass: undefined }, compositeBar);
	}

	setActivity(activity: IActivity): void {
		this.label = activity.name;
	}
}


export class SwitchPanelViewAction extends Action {

	constructor(
		id: string,
		name: string,
		@IPanelService private readonly panelService: IPanelService
	) {
		super(id, name);
	}

	async run(offset: number): Promise<void> {
		const pinnedPanels = this.panelService.getPinnedPanels();
		const activePanel = this.panelService.getActivePanel();
		if (!activePanel) {
			return;
		}
		let targetPanelId: string | undefined;
		for (let i = 0; i < pinnedPanels.length; i++) {
			if (pinnedPanels[i].id === activePanel.getId()) {
				targetPanelId = pinnedPanels[(i + pinnedPanels.length + offset) % pinnedPanels.length].id;
				break;
			}
		}
		if (typeof targetPanelId === 'string') {
			await this.panelService.openPanel(targetPanelId, true);
		}
	}
}

export class PreviousPanelViewAction extends SwitchPanelViewAction {

	static readonly ID = 'workbench.action.previousPanelView';
	static readonly LABEL = nls.localize('previousPanelView', 'Previous Panel View');

	constructor(
		id: string,
		name: string,
		@IPanelService panelService: IPanelService
	) {
		super(id, name, panelService);
	}

	run(): Promise<void> {
		return super.run(-1);
	}
}

export class NextPanelViewAction extends SwitchPanelViewAction {

	static readonly ID = 'workbench.action.nextPanelView';
	static readonly LABEL = nls.localize('nextPanelView', 'Next Panel View');

	constructor(
		id: string,
		name: string,
		@IPanelService panelService: IPanelService
	) {
		super(id, name, panelService);
	}

	run(): Promise<void> {
		return super.run(1);
	}
}

const actionRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchExtensions.WorkbenchActions);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.from(TogglePanelAction, { primary: KeyMod.CtrlCmd | KeyCode.KEY_J }), 'View: Toggle Panel', CATEGORIES.View.value);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.from(FocusPanelAction), 'View: Focus into Panel', CATEGORIES.View.value);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.from(PreviousPanelViewAction), 'View: Previous Panel View', CATEGORIES.View.value);
actionRegistry.registerWorkbenchAction(SyncActionDescriptor.from(NextPanelViewAction), 'View: Next Panel View', CATEGORIES.View.value);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.toggleMaximizedPanel',
			title: { value: nls.localize('toggleMaximizedPanel', "Toggle Maximized Panel"), original: 'Toggle Maximized Panel' },
			tooltip: nls.localize('maximizePanel', "Maximize Panel Size"),
			category: CATEGORIES.View,
			f1: true,
			icon: maximizeIcon,
			toggled: { condition: PanelMaximizedContext, icon: restoreIcon, tooltip: nls.localize('minimizePanel', "Restore Panel Size") },
			menu: [{
				id: MenuId.PanelTitle,
				group: 'navigation',
				order: 1
			}]
		});
	}
	run(accessor: ServicesAccessor) {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		if (!layoutService.isVisible(Parts.PANEL_PART)) {
			layoutService.setPanelHidden(false);
			// If the panel is not already maximized, maximize it
			if (!layoutService.isPanelMaximized()) {
				layoutService.toggleMaximizedPanel();
			}
		}
		else {
			layoutService.toggleMaximizedPanel();
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.closePanel',
			title: { value: nls.localize('closePanel', "Close Panel"), original: 'Close Panel' },
			category: CATEGORIES.View,
			icon: closeIcon,
			menu: [{
				id: MenuId.CommandPalette,
				when: PanelVisibleContext,
			}, {
				id: MenuId.PanelTitle,
				group: 'navigation',
				order: 2
			}]
		});
	}
	run(accessor: ServicesAccessor) {
		accessor.get(IWorkbenchLayoutService).setPanelHidden(true);
	}
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	group: '2_workbench_layout',
	command: {
		id: TogglePanelAction.ID,
		title: nls.localize({ key: 'miShowPanel', comment: ['&& denotes a mnemonic'] }, "Show &&Panel"),
		toggled: ActivePanelContext
	},
	order: 5
});

function registerPositionPanelActionById(config: PanelActionConfig<Position>) {
	const { id, label, alias, when } = config;
	// register the workbench action
	actionRegistry.registerWorkbenchAction(SyncActionDescriptor.create(SetPanelPositionAction, id, label), alias, CATEGORIES.View.value, when);
	// register as a menu item
	MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
		group: '3_workbench_layout_move',
		command: {
			id,
			title: label
		},
		when,
		order: 5
	});
}

// register each position panel action
PositionPanelActionConfigs.forEach(registerPositionPanelActionById);
