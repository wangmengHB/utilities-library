/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import * as modes from 'vs/editor/common/modes';
import { Emitter, Event } from 'vs/base/common/event';
import { IMainContext, MainContext, MainThreadAuthenticationShape, ExtHostAuthenticationShape } from 'vs/workbench/api/common/extHost.protocol';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';
import { IExtensionDescription, ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';

interface GetSessionsRequest {
	scopes: string;
	result: Promise<vscode.AuthenticationSession | undefined>;
}

export class ExtHostAuthentication implements ExtHostAuthenticationShape {
	private _proxy: MainThreadAuthenticationShape;
	private _authenticationProviders: Map<string, vscode.AuthenticationProvider> = new Map<string, vscode.AuthenticationProvider>();

	private _providerIds: string[] = [];

	private _providers: vscode.AuthenticationProviderInformation[] = [];

	private _onDidChangeAuthenticationProviders = new Emitter<vscode.AuthenticationProvidersChangeEvent>();
	readonly onDidChangeAuthenticationProviders: Event<vscode.AuthenticationProvidersChangeEvent> = this._onDidChangeAuthenticationProviders.event;

	private _onDidChangeSessions = new Emitter<vscode.AuthenticationSessionsChangeEvent>();
	readonly onDidChangeSessions: Event<vscode.AuthenticationSessionsChangeEvent> = this._onDidChangeSessions.event;

	private _onDidChangePassword = new Emitter<void>();
	readonly onDidChangePassword: Event<void> = this._onDidChangePassword.event;

	private _inFlightRequests = new Map<string, GetSessionsRequest[]>();

	constructor(mainContext: IMainContext) {
		this._proxy = mainContext.getProxy(MainContext.MainThreadAuthentication);
	}

	$setProviders(providers: vscode.AuthenticationProviderInformation[]): Promise<void> {
		this._providers = providers;
		return Promise.resolve();
	}

	getProviderIds(): Promise<ReadonlyArray<string>> {
		return this._proxy.$getProviderIds();
	}

	get providerIds(): string[] {
		return this._providerIds;
	}

	get providers(): ReadonlyArray<vscode.AuthenticationProviderInformation> {
		return Object.freeze(this._providers.slice());
	}

	async getSession(requestingExtension: IExtensionDescription, providerId: string, scopes: string[], options: vscode.AuthenticationGetSessionOptions & { createIfNone: true }): Promise<vscode.AuthenticationSession>;
	async getSession(requestingExtension: IExtensionDescription, providerId: string, scopes: string[], options: vscode.AuthenticationGetSessionOptions = {}): Promise<vscode.AuthenticationSession | undefined> {
		const extensionId = ExtensionIdentifier.toKey(requestingExtension.identifier);
		const inFlightRequests = this._inFlightRequests.get(extensionId) || [];
		const sortedScopes = scopes.sort().join(' ');
		let inFlightRequest: GetSessionsRequest | undefined = inFlightRequests.find(request => request.scopes === sortedScopes);

		if (inFlightRequest) {
			return inFlightRequest.result;
		} else {
			const session = this._getSession(requestingExtension, extensionId, providerId, scopes, options);
			inFlightRequest = {
				scopes: sortedScopes,
				result: session
			};

			inFlightRequests.push(inFlightRequest);
			this._inFlightRequests.set(extensionId, inFlightRequests);

			try {
				await session;
			} finally {
				const requestIndex = inFlightRequests.findIndex(request => request.scopes === sortedScopes);
				if (requestIndex > -1) {
					inFlightRequests.splice(requestIndex);
					this._inFlightRequests.set(extensionId, inFlightRequests);
				}
			}

			return session;
		}
	}

	private async _getSession(requestingExtension: IExtensionDescription, extensionId: string, providerId: string, scopes: string[], options: vscode.AuthenticationGetSessionOptions = {}): Promise<vscode.AuthenticationSession | undefined> {
		await this._proxy.$ensureProvider(providerId);
		const provider = this._authenticationProviders.get(providerId);
		const extensionName = requestingExtension.displayName || requestingExtension.name;

		if (!provider) {
			return this._proxy.$getSession(providerId, scopes, extensionId, extensionName, options);
		}

		const orderedScopes = scopes.sort().join(' ');
		const sessions = (await provider.getSessions()).filter(session => session.scopes.slice().sort().join(' ') === orderedScopes);

		let session: vscode.AuthenticationSession | undefined = undefined;
		if (sessions.length) {
			if (!provider.supportsMultipleAccounts) {
				session = sessions[0];
				const allowed = await this._proxy.$getSessionsPrompt(providerId, session.account.label, provider.label, extensionId, extensionName);
				if (!allowed) {
					throw new Error('User did not consent to login.');
				}
			} else {
				// On renderer side, confirm consent, ask user to choose between accounts if multiple sessions are valid
				const selected = await this._proxy.$selectSession(providerId, provider.label, extensionId, extensionName, sessions, scopes, !!options.clearSessionPreference);
				session = sessions.find(session => session.id === selected.id);
			}

		} else {
			if (options.createIfNone) {
				const isAllowed = await this._proxy.$loginPrompt(provider.label, extensionName);
				if (!isAllowed) {
					throw new Error('User did not consent to login.');
				}

				session = await provider.login(scopes);
				await this._proxy.$setTrustedExtensionAndAccountPreference(providerId, session.account.label, extensionId, extensionName, session.id);
			} else {
				await this._proxy.$requestNewSession(providerId, scopes, extensionId, extensionName);
			}
		}


		return session;
	}

	async logout(providerId: string, sessionId: string): Promise<void> {
		const provider = this._authenticationProviders.get(providerId);
		if (!provider) {
			return this._proxy.$logout(providerId, sessionId);
		}

		return provider.logout(sessionId);
	}

	registerAuthenticationProvider(provider: vscode.AuthenticationProvider): vscode.Disposable {
		if (this._authenticationProviders.get(provider.id)) {
			throw new Error(`An authentication provider with id '${provider.id}' is already registered.`);
		}

		this._authenticationProviders.set(provider.id, provider);
		if (!this._providerIds.includes(provider.id)) {
			this._providerIds.push(provider.id);
		}

		if (!this._providers.find(p => p.id === provider.id)) {
			this._providers.push({
				id: provider.id,
				label: provider.label
			});
		}

		const listener = provider.onDidChangeSessions(e => {
			this._proxy.$sendDidChangeSessions(provider.id, e);
		});

		this._proxy.$registerAuthenticationProvider(provider.id, provider.label, provider.supportsMultipleAccounts);

		return new Disposable(() => {
			listener.dispose();
			this._authenticationProviders.delete(provider.id);
			const index = this._providerIds.findIndex(id => id === provider.id);
			if (index > -1) {
				this._providerIds.splice(index);
			}

			const i = this._providers.findIndex(p => p.id === provider.id);
			if (i > -1) {
				this._providers.splice(i);
			}

			this._proxy.$unregisterAuthenticationProvider(provider.id);
		});
	}

	$login(providerId: string, scopes: string[]): Promise<modes.AuthenticationSession> {
		const authProvider = this._authenticationProviders.get(providerId);
		if (authProvider) {
			return Promise.resolve(authProvider.login(scopes));
		}

		throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
	}

	$logout(providerId: string, sessionId: string): Promise<void> {
		const authProvider = this._authenticationProviders.get(providerId);
		if (authProvider) {
			return Promise.resolve(authProvider.logout(sessionId));
		}

		throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
	}

	$getSessions(providerId: string): Promise<ReadonlyArray<modes.AuthenticationSession>> {
		const authProvider = this._authenticationProviders.get(providerId);
		if (authProvider) {
			return Promise.resolve(authProvider.getSessions());
		}

		throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
	}

	async $getSessionAccessToken(providerId: string, sessionId: string): Promise<string> {
		const authProvider = this._authenticationProviders.get(providerId);
		if (authProvider) {
			const sessions = await authProvider.getSessions();
			const session = sessions.find(session => session.id === sessionId);
			if (session) {
				return session.accessToken;
			}

			throw new Error(`Unable to find session with id: ${sessionId}`);
		}

		throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
	}

	$onDidChangeAuthenticationSessions(id: string, label: string, event: modes.AuthenticationSessionsChangeEvent) {
		this._onDidChangeSessions.fire({ provider: { id, label }, ...event });
		return Promise.resolve();
	}

	$onDidChangeAuthenticationProviders(added: modes.AuthenticationProviderInformation[], removed: modes.AuthenticationProviderInformation[]) {
		added.forEach(provider => {
			if (!this._providers.some(p => p.id === provider.id)) {
				this._providers.push(provider);
			}
		});

		removed.forEach(p => {
			const index = this._providers.findIndex(provider => provider.id === p.id);
			if (index > -1) {
				this._providers.splice(index);
			}
		});

		this._onDidChangeAuthenticationProviders.fire({ added, removed });
		return Promise.resolve();
	}

	async $onDidChangePassword(): Promise<void> {
		this._onDidChangePassword.fire();
	}

	getPassword(requestingExtension: IExtensionDescription, key: string): Promise<string | undefined> {
		const extensionId = ExtensionIdentifier.toKey(requestingExtension.identifier);
		return this._proxy.$getPassword(extensionId, key);
	}

	setPassword(requestingExtension: IExtensionDescription, key: string, value: string): Promise<void> {
		const extensionId = ExtensionIdentifier.toKey(requestingExtension.identifier);
		return this._proxy.$setPassword(extensionId, key, value);
	}

	deletePassword(requestingExtension: IExtensionDescription, key: string): Promise<void> {
		const extensionId = ExtensionIdentifier.toKey(requestingExtension.identifier);
		return this._proxy.$deletePassword(extensionId, key);
	}
}
