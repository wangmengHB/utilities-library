/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { BaseBinaryResourceEditor } from 'vs/workbench/browser/parts/editor/binaryEditor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { EditorInput, EditorOptions } from 'vs/workbench/common/editor';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { BINARY_FILE_EDITOR_ID } from 'vs/workbench/contrib/files/common/files';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { openEditorWith } from 'vs/workbench/services/editor/common/editorOpenWith';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

/**
 * An implementation of editor for binary files that cannot be displayed.
 */
export class BinaryFileEditor extends BaseBinaryResourceEditor {

	static readonly ID = BINARY_FILE_EDITOR_ID;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
	) {
		super(
			BinaryFileEditor.ID,
			{
				openInternal: (input, options) => this.openInternal(input, options),
				openExternal: resource => this.openerService.open(resource, { openExternal: true })
			},
			telemetryService,
			themeService,
			environmentService,
			storageService
		);
	}

	private async openInternal(input: EditorInput, options: EditorOptions | undefined): Promise<void> {
		if (input instanceof FileEditorInput && this.group) {

			// Enforce to open the input as text to enable our text based viewer
			input.setForceOpenAsText();

			// If more editors are installed that can handle this input, show a picker
			await this.instantiationService.invokeFunction(openEditorWith, input, undefined, options, this.group);
		}
	}

	getTitle(): string {
		return this.input ? this.input.getName() : nls.localize('binaryFileEditor', "Binary File Viewer");
	}
}
