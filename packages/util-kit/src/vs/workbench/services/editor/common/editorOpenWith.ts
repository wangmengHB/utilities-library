/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { IConfigurationNode, IConfigurationRegistry, Extensions } from 'vs/platform/configuration/common/configurationRegistry';
import { workbenchConfigurationNodeBase } from 'vs/workbench/common/configuration';
import { Registry } from 'vs/platform/registry/common/platform';
import { ICustomEditorInfo, IEditorService, IOpenEditorOverrideHandler, IOpenEditorOverrideEntry } from 'vs/workbench/services/editor/common/editorService';
import { IEditorInput, IEditorPane, IEditorInputFactoryRegistry, Extensions as EditorExtensions, EditorResourceAccessor } from 'vs/workbench/common/editor';
import { ITextEditorOptions, IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorGroup, IEditorGroupsService, OpenEditorContext, preferredSideBySideGroupDirection } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IKeyMods, IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { URI } from 'vs/base/common/uri';
import { extname, basename, isEqual } from 'vs/base/common/resources';
import { Codicon } from 'vs/base/common/codicons';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

/**
 * Id of the default editor for open with.
 */
export const DEFAULT_EDITOR_ID = 'default';

/**
 * Try to open an resource with a given editor.
 *
 * @param input Resource to open.
 * @param id Id of the editor to use. If not provided, the user is prompted for which editor to use.
 */
export async function openEditorWith(
	accessor: ServicesAccessor,
	input: IEditorInput,
	id: string | undefined,
	options: IEditorOptions | ITextEditorOptions | undefined,
	group: IEditorGroup,
): Promise<IEditorPane | undefined> {
	const editorService = accessor.get(IEditorService);
	const editorGroupsService = accessor.get(IEditorGroupsService);
	const configurationService = accessor.get(IConfigurationService);
	const quickInputService = accessor.get(IQuickInputService);

	const resource = input.resource;
	if (!resource) {
		return;
	}

	const overrideOptions = { ...options, override: id };

	const allEditorOverrides = getAllAvailableEditors(resource, id, overrideOptions, group, editorService);
	if (!allEditorOverrides.length) {
		return;
	}

	let overrideToUse;
	if (typeof id === 'string') {
		overrideToUse = allEditorOverrides.find(([_, entry]) => entry.id === id);
	} else if (allEditorOverrides.length === 1) {
		overrideToUse = allEditorOverrides[0];
	}
	if (overrideToUse) {
		return overrideToUse[0].open(input, overrideOptions, group, OpenEditorContext.NEW_EDITOR)?.override;
	}

	// Prompt
	const originalResource = EditorResourceAccessor.getOriginalUri(input) || resource;
	const resourceExt = extname(originalResource);

	const items: (IQuickPickItem & { handler: IOpenEditorOverrideHandler })[] = allEditorOverrides.map(([handler, entry]) => {
		return {
			handler: handler,
			id: entry.id,
			label: entry.label,
			description: entry.active ? nls.localize('promptOpenWith.currentlyActive', 'Currently Active') : undefined,
			detail: entry.detail,
			buttons: resourceExt ? [{
				iconClass: Codicon.gear.classNames,
				tooltip: nls.localize('promptOpenWith.setDefaultTooltip', "Set as default editor for '{0}' files", resourceExt)
			}] : undefined
		};
	});
	type QuickPickItem = IQuickPickItem & {
		readonly handler: IOpenEditorOverrideHandler;
	};

	const picker = quickInputService.createQuickPick<QuickPickItem>();
	picker.items = items;
	if (items.length) {
		picker.selectedItems = [items[0]];
	}
	picker.placeholder = nls.localize('promptOpenWith.placeHolder', "Select editor for '{0}'", basename(originalResource));
	picker.canAcceptInBackground = true;

	type PickedResult = {
		readonly item: QuickPickItem;
		readonly keyMods?: IKeyMods;
		readonly openInBackground: boolean;
	};

	function openEditor(picked: PickedResult) {
		const targetGroup = getTargetGroup(group, picked.keyMods, configurationService, editorGroupsService);

		const openOptions: IEditorOptions = {
			...options,
			override: picked.item.id,
			preserveFocus: picked.openInBackground || options?.preserveFocus,
		};
		return picked.item.handler.open(input, openOptions, targetGroup, OpenEditorContext.NEW_EDITOR)?.override;
	}

	const picked = await new Promise<PickedResult | undefined>(resolve => {
		picker.onDidAccept(e => {
			if (picker.selectedItems.length === 1) {
				const result: PickedResult = {
					item: picker.selectedItems[0],
					keyMods: picker.keyMods,
					openInBackground: e.inBackground
				};

				if (e.inBackground) {
					openEditor(result);
				} else {
					resolve(result);
				}
			} else {
				resolve(undefined);
			}
		});

		picker.onDidTriggerItemButton(e => {
			const pick = e.item;
			const id = pick.id;
			resolve({ item: pick, openInBackground: false }); // open the view
			picker.dispose();

			// And persist the setting
			if (pick && id) {
				const newAssociation: CustomEditorAssociation = { viewType: id, filenamePattern: '*' + resourceExt };
				const currentAssociations = [...configurationService.getValue<CustomEditorsAssociations>(customEditorsAssociationsSettingId)];

				// First try updating existing association
				for (let i = 0; i < currentAssociations.length; ++i) {
					const existing = currentAssociations[i];
					if (existing.filenamePattern === newAssociation.filenamePattern) {
						currentAssociations.splice(i, 1, newAssociation);
						configurationService.updateValue(customEditorsAssociationsSettingId, currentAssociations);
						return;
					}
				}

				// Otherwise, create a new one
				currentAssociations.unshift(newAssociation);
				configurationService.updateValue(customEditorsAssociationsSettingId, currentAssociations);
			}
		});

		picker.show();
	});

	if (!picked) {
		return undefined;
	}

	return openEditor(picked);
}

const builtinProviderDisplayName = nls.localize('builtinProviderDisplayName', "Built-in");

export const defaultEditorOverrideEntry = Object.freeze({
	id: DEFAULT_EDITOR_ID,
	label: nls.localize('promptOpenWith.defaultEditor.displayName', "Text Editor"),
	detail: builtinProviderDisplayName
});

/**
 * Get the group to open the editor in by looking at the pressed keys from the picker.
 */
function getTargetGroup(
	startingGroup: IEditorGroup,
	keyMods: IKeyMods | undefined,
	configurationService: IConfigurationService,
	editorGroupsService: IEditorGroupsService,
) {
	if (keyMods?.alt || keyMods?.ctrlCmd) {
		const direction = preferredSideBySideGroupDirection(configurationService);
		const targetGroup = editorGroupsService.findGroup({ direction }, startingGroup.id);
		return targetGroup ?? editorGroupsService.addGroup(startingGroup, direction);
	}
	return startingGroup;
}

/**
 * Get a list of all available editors, including the default text editor.
 */
export function getAllAvailableEditors(
	resource: URI,
	id: string | undefined,
	options: IEditorOptions | ITextEditorOptions | undefined,
	group: IEditorGroup,
	editorService: IEditorService
): Array<[IOpenEditorOverrideHandler, IOpenEditorOverrideEntry]> {
	const fileEditorInputFactory = Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories).getFileEditorInputFactory();
	const overrides = editorService.getEditorOverrides(resource, options, group);
	if (!overrides.some(([_, entry]) => entry.id === DEFAULT_EDITOR_ID)) {
		overrides.unshift([
			{
				open: (input: IEditorInput, options: IEditorOptions | ITextEditorOptions | undefined, group: IEditorGroup) => {
					const resource = EditorResourceAccessor.getOriginalUri(input);
					if (!resource) {
						return;
					}

					const fileEditorInput = editorService.createEditorInput({ resource, forceFile: true });
					const textOptions: IEditorOptions | ITextEditorOptions = options ? { ...options, override: false } : { override: false };
					return { override: editorService.openEditor(fileEditorInput, textOptions, group) };
				}
			},
			{
				...defaultEditorOverrideEntry,
				active: fileEditorInputFactory.isFileEditorInput(editorService.activeEditor) && isEqual(editorService.activeEditor.resource, resource),
			}]);
	}

	return overrides;
}

export const customEditorsAssociationsSettingId = 'workbench.editorAssociations';

export const viewTypeSchamaAddition: IJSONSchema = {
	type: 'string',
	enum: []
};

export type CustomEditorAssociation = {
	readonly viewType: string;
	readonly filenamePattern?: string;
};

export type CustomEditorsAssociations = readonly CustomEditorAssociation[];

export const editorAssociationsConfigurationNode: IConfigurationNode = {
	...workbenchConfigurationNodeBase,
	properties: {
		[customEditorsAssociationsSettingId]: {
			type: 'array',
			markdownDescription: nls.localize('editor.editorAssociations', "Configure which editor to use for specific file types."),
			items: {
				type: 'object',
				defaultSnippets: [{
					body: {
						'viewType': '$1',
						'filenamePattern': '$2'
					}
				}],
				properties: {
					'viewType': {
						anyOf: [
							{
								type: 'string',
								description: nls.localize('editor.editorAssociations.viewType', "The unique id of the editor to use."),
							},
							viewTypeSchamaAddition
						]
					},
					'filenamePattern': {
						type: 'string',
						description: nls.localize('editor.editorAssociations.filenamePattern', "Glob pattern specifying which files the editor should be used for."),
					}
				}
			}
		}
	}
};

export const DEFAULT_CUSTOM_EDITOR: ICustomEditorInfo = {
	id: 'default',
	displayName: nls.localize('promptOpenWith.defaultEditor.displayName', "Text Editor"),
	providerDisplayName: builtinProviderDisplayName
};

export function updateViewTypeSchema(enumValues: string[], enumDescriptions: string[]): void {
	viewTypeSchamaAddition.enum = enumValues;
	viewTypeSchamaAddition.enumDescriptions = enumDescriptions;

	Registry.as<IConfigurationRegistry>(Extensions.Configuration)
		.notifyConfigurationSchemaUpdated(editorAssociationsConfigurationNode);
}
