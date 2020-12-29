/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DynamicWebviewEditorOverlay } from 'vs/workbench/contrib/webview/browser/dynamicWebviewEditorOverlay';
import { WebviewContentOptions, WebviewElement, WebviewExtensionDescription, WebviewOptions, WebviewOverlay } from 'vs/workbench/contrib/webview/browser/webview';
import { WebviewService } from 'vs/workbench/contrib/webview/browser/webviewService';
import { ElectronIframeWebview } from 'vs/workbench/contrib/webview/electron-sandbox/iframeWebviewElement';
import { ElectronWebviewBasedWebview } from 'vs/workbench/contrib/webview/electron-browser/webviewElement';

export class ElectronWebviewService extends WebviewService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService private readonly _configService: IConfigurationService,
	) {
		super(instantiationService);
	}

	createWebviewElement(
		id: string,
		options: WebviewOptions,
		contentOptions: WebviewContentOptions,
		extension: WebviewExtensionDescription | undefined,
	): WebviewElement {
		const useIframes = this._configService.getValue<string>('webview.experimental.useIframes');
		const webview = this._instantiationService.createInstance(useIframes ? ElectronIframeWebview : ElectronWebviewBasedWebview, id, options, contentOptions, extension, this._webviewThemeDataProvider);
		this.addWebviewListeners(webview);
		return webview;
	}

	createWebviewOverlay(
		id: string,
		options: WebviewOptions,
		contentOptions: WebviewContentOptions,
		extension: WebviewExtensionDescription | undefined,
	): WebviewOverlay {
		const webview = this._instantiationService.createInstance(DynamicWebviewEditorOverlay, id, options, contentOptions, extension);
		this.addWebviewListeners(webview);
		return webview;
	}
}
