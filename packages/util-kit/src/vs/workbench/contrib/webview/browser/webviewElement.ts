/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener } from 'vs/base/browser/dom';
import { streamToBuffer } from 'vs/base/common/buffer';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IRemoteAuthorityResolverService } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { ITunnelService } from 'vs/platform/remote/common/tunnel';
import { IRequestService } from 'vs/platform/request/common/request';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { loadLocalResource, WebviewResourceResponse } from 'vs/platform/webview/common/resourceLoader';
import { WebviewPortMappingManager } from 'vs/platform/webview/common/webviewPortMapping';
import { BaseWebview, WebviewMessageChannels } from 'vs/workbench/contrib/webview/browser/baseWebviewElement';
import { WebviewThemeDataProvider } from 'vs/workbench/contrib/webview/browser/themeing';
import { Webview, WebviewContentOptions, WebviewExtensionDescription, WebviewOptions } from 'vs/workbench/contrib/webview/browser/webview';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';

export class IFrameWebview extends BaseWebview<HTMLIFrameElement> implements Webview {
	private readonly _portMappingManager: WebviewPortMappingManager;
	private _confirmBeforeClose: string;

	constructor(
		id: string,
		options: WebviewOptions,
		contentOptions: WebviewContentOptions,
		extension: WebviewExtensionDescription | undefined,
		webviewThemeDataProvider: WebviewThemeDataProvider,
		@INotificationService notificationService: INotificationService,
		@ITunnelService tunnelService: ITunnelService,
		@IFileService private readonly fileService: IFileService,
		@IRequestService private readonly requestService: IRequestService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IRemoteAuthorityResolverService private readonly _remoteAuthorityResolverService: IRemoteAuthorityResolverService,
		@ILogService private readonly logService: ILogService,
	) {
		super(id, options, contentOptions, extension, webviewThemeDataProvider, notificationService, logService, telemetryService, environmentService);

		this._portMappingManager = this._register(new WebviewPortMappingManager(
			() => this.extension?.location,
			() => this.content.options.portMapping || [],
			tunnelService
		));

		this._register(this.on(WebviewMessageChannels.loadResource, (entry: any) => {
			const rawPath = entry.path;
			const normalizedPath = decodeURIComponent(rawPath);
			const uri = URI.parse(normalizedPath.replace(/^\/([\w\-]+)\/(.+)$/, (_, scheme, path) => scheme + ':/' + path));
			this.loadResource(rawPath, uri);
		}));

		this._register(this.on(WebviewMessageChannels.loadLocalhost, (entry: any) => {
			this.localLocalhost(entry.origin);
		}));

		this._confirmBeforeClose = this._configurationService.getValue<string>('window.confirmBeforeClose');

		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('window.confirmBeforeClose')) {
				this._confirmBeforeClose = this._configurationService.getValue('window.confirmBeforeClose');
				this._send(WebviewMessageChannels.setConfirmBeforeClose, this._confirmBeforeClose);
			}
		}));

		this.initElement(extension, options);
	}

	protected createElement(options: WebviewOptions, _contentOptions: WebviewContentOptions) {
		// Do not start loading the webview yet.
		// Wait the end of the ctor when all listeners have been hooked up.
		const element = document.createElement('iframe');
		element.className = `webview ${options.customClasses || ''}`;
		element.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-pointer-lock', 'allow-downloads');
		element.style.border = 'none';
		element.style.width = '100%';
		element.style.height = '100%';
		return element;
	}

	protected initElement(extension: WebviewExtensionDescription | undefined, options: WebviewOptions) {
		const params = {
			id: this.id,

			// The extensionId and purpose in the URL are used for filtering in js-debug:
			extensionId: extension?.id.value ?? '',
			purpose: options.purpose,
		} as const;

		const queryString = (Object.keys(params) as Array<keyof typeof params>)
			.map((key) => `${key}=${params[key]}`)
			.join('&');

		this.element!.setAttribute('src', `${this.externalEndpoint}/index.html?${queryString}`);
	}

	private get externalEndpoint(): string {
		const endpoint = this.environmentService.webviewExternalEndpoint!.replace('{{uuid}}', this.id);
		if (endpoint[endpoint.length - 1] === '/') {
			return endpoint.slice(0, endpoint.length - 1);
		}
		return endpoint;
	}

	public mountTo(parent: HTMLElement) {
		if (this.element) {
			parent.appendChild(this.element);
		}
	}

	public set html(value: string) {
		super.html = this.preprocessHtml(value);
	}

	protected preprocessHtml(value: string): string {
		return value
			.replace(/(["'])(?:vscode-resource):(\/\/([^\s\/'"]+?)(?=\/))?([^\s'"]+?)(["'])/gi, (match, startQuote, _1, scheme, path, endQuote) => {
				if (scheme) {
					return `${startQuote}${this.externalEndpoint}/vscode-resource/${scheme}${path}${endQuote}`;
				}
				return `${startQuote}${this.externalEndpoint}/vscode-resource/file${path}${endQuote}`;
			})
			.replace(/(["'])(?:vscode-webview-resource):(\/\/[^\s\/'"]+\/([^\s\/'"]+?)(?=\/))?([^\s'"]+?)(["'])/gi, (match, startQuote, _1, scheme, path, endQuote) => {
				if (scheme) {
					return `${startQuote}${this.externalEndpoint}/vscode-resource/${scheme}${path}${endQuote}`;
				}
				return `${startQuote}${this.externalEndpoint}/vscode-resource/file${path}${endQuote}`;
			});
	}

	protected get extraContentOptions(): any {
		return {
			endpoint: this.externalEndpoint,
			confirmBeforeClose: this._confirmBeforeClose,
		};
	}

	focus(): void {
		if (this.element) {
			this._send('focus');
		}
	}

	showFind(): void {
		throw new Error('Method not implemented.');
	}

	hideFind(): void {
		throw new Error('Method not implemented.');
	}

	runFindAction(previous: boolean): void {
		throw new Error('Method not implemented.');
	}

	private async loadResource(requestPath: string, uri: URI) {
		try {
			const remoteAuthority = this.environmentService.remoteAuthority;
			const remoteConnectionData = remoteAuthority ? this._remoteAuthorityResolverService.getConnectionData(remoteAuthority) : null;
			const extensionLocation = this.extension?.location;

			// If we are loading a file resource from a remote extension, rewrite the uri to go remote
			let rewriteUri: undefined | ((uri: URI) => URI);
			if (extensionLocation?.scheme === Schemas.vscodeRemote) {
				rewriteUri = (uri) => {
					if (uri.scheme === Schemas.file && extensionLocation?.scheme === Schemas.vscodeRemote) {
						return URI.from({
							scheme: Schemas.vscodeRemote,
							authority: extensionLocation.authority,
							path: '/vscode-resource',
							query: JSON.stringify({
								requestResourcePath: uri.path
							})
						});
					}
					return uri;
				};
			}

			const result = await loadLocalResource(uri, {
				extensionLocation: extensionLocation,
				roots: this.content.options.localResourceRoots || [],
				remoteConnectionData,
				rewriteUri,
			}, {
				readFileStream: (resource) => this.fileService.readFileStream(resource).then(x => x.value),
			}, this.requestService, this.logService);

			if (result.type === WebviewResourceResponse.Type.Success) {
				const { buffer } = await streamToBuffer(result.stream);
				return this._send('did-load-resource', {
					status: 200,
					path: requestPath,
					mime: result.mimeType,
					data: buffer,
				});
			}
		} catch {
			// noop
		}

		return this._send('did-load-resource', {
			status: 404,
			path: requestPath
		});
	}

	private async localLocalhost(origin: string) {
		const authority = this.environmentService.remoteAuthority;
		const resolveAuthority = authority ? await this._remoteAuthorityResolverService.resolveAuthority(authority) : undefined;
		const redirect = resolveAuthority ? await this._portMappingManager.getRedirect(resolveAuthority.authority, origin) : undefined;
		return this._send('did-load-localhost', {
			origin,
			location: redirect
		});
	}

	protected doPostMessage(channel: string, data?: any): void {
		if (this.element) {
			this.element.contentWindow!.postMessage({ channel, args: data }, '*');
		}
	}

	protected on<T = unknown>(channel: WebviewMessageChannels, handler: (data: T) => void): IDisposable {
		return addDisposableListener(window, 'message', e => {
			if (!e || !e.data || e.data.target !== this.id) {
				return;
			}
			if (e.data.channel === channel) {
				handler(e.data.data);
			}
		});
	}
}
