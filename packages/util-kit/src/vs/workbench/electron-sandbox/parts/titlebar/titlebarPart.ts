/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getZoomFactor } from 'vs/base/browser/browser';
import * as DOM from 'vs/base/browser/dom';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IConfigurationService, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { ILabelService } from 'vs/platform/label/common/label';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { INativeWorkbenchEnvironmentService } from 'vs/workbench/services/environment/electron-sandbox/environmentService';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { isMacintosh, isWindows, isLinux } from 'vs/base/common/platform';
import { IMenuService } from 'vs/platform/actions/common/actions';
import { TitlebarPart as BrowserTitleBarPart } from 'vs/workbench/browser/parts/titlebar/titlebarPart';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IProductService } from 'vs/platform/product/common/productService';
import { INativeHostService } from 'vs/platform/native/electron-sandbox/native';
import { getTitleBarStyle } from 'vs/platform/windows/common/windows';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Codicon } from 'vs/base/common/codicons';

export class TitlebarPart extends BrowserTitleBarPart {
	private appIcon: HTMLElement | undefined;
	private windowControls: HTMLElement | undefined;
	private maxRestoreControl: HTMLElement | undefined;
	private dragRegion: HTMLElement | undefined;
	private resizer: HTMLElement | undefined;

	private getMacTitlebarSize() {
		const osVersion = this.environmentService.os.release;
		if (parseFloat(osVersion) >= 20) { // Big Sur increases title bar height
			return 28;
		}

		return 22;
	}

	get minimumHeight(): number { return isMacintosh ? this.getMacTitlebarSize() / getZoomFactor() : super.minimumHeight; }
	get maximumHeight(): number { return this.minimumHeight; }

	constructor(
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService protected readonly configurationService: IConfigurationService,
		@IEditorService editorService: IEditorService,
		@INativeWorkbenchEnvironmentService protected readonly environmentService: INativeWorkbenchEnvironmentService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@ILabelService labelService: ILabelService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IMenuService menuService: IMenuService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IHostService hostService: IHostService,
		@IProductService productService: IProductService,
		@INativeHostService private readonly nativeHostService: INativeHostService
	) {
		super(contextMenuService, configurationService, editorService, environmentService, contextService, instantiationService, themeService, labelService, storageService, layoutService, menuService, contextKeyService, hostService, productService);
	}

	private onUpdateAppIconDragBehavior() {
		const setting = this.configurationService.getValue('window.doubleClickIconToClose');
		if (setting && this.appIcon) {
			(this.appIcon.style as any)['-webkit-app-region'] = 'no-drag';
		} else if (this.appIcon) {
			(this.appIcon.style as any)['-webkit-app-region'] = 'drag';
		}
	}

	private onDidChangeMaximized(maximized: boolean) {
		if (this.maxRestoreControl) {
			if (maximized) {
				this.maxRestoreControl.classList.remove(...Codicon.chromeMaximize.classNamesArray);
				this.maxRestoreControl.classList.add(...Codicon.chromeRestore.classNamesArray);
			} else {
				this.maxRestoreControl.classList.remove(...Codicon.chromeRestore.classNamesArray);
				this.maxRestoreControl.classList.add(...Codicon.chromeMaximize.classNamesArray);
			}
		}

		if (this.resizer) {
			if (maximized) {
				DOM.hide(this.resizer);
			} else {
				DOM.show(this.resizer);
			}
		}

		this.adjustTitleMarginToCenter();
	}

	private onMenubarFocusChanged(focused: boolean) {
		if ((isWindows || isLinux) && this.currentMenubarVisibility !== 'compact' && this.dragRegion) {
			if (focused) {
				DOM.hide(this.dragRegion);
			} else {
				DOM.show(this.dragRegion);
			}
		}
	}

	protected onMenubarVisibilityChanged(visible: boolean) {
		// Hide title when toggling menu bar
		if ((isWindows || isLinux) && this.currentMenubarVisibility === 'toggle' && visible) {
			// Hack to fix issue #52522 with layered webkit-app-region elements appearing under cursor
			if (this.dragRegion) {
				DOM.hide(this.dragRegion);
				setTimeout(() => DOM.show(this.dragRegion!), 50);
			}
		}

		super.onMenubarVisibilityChanged(visible);
	}

	protected onConfigurationChanged(event: IConfigurationChangeEvent): void {

		super.onConfigurationChanged(event);

		if (event.affectsConfiguration('window.doubleClickIconToClose')) {
			if (this.appIcon) {
				this.onUpdateAppIconDragBehavior();
			}
		}
	}

	protected adjustTitleMarginToCenter(): void {
		if (this.customMenubar && this.menubar) {
			const leftMarker = (this.appIcon ? this.appIcon.clientWidth : 0) + this.menubar.clientWidth + 10;
			const rightMarker = this.element.clientWidth - (this.windowControls ? this.windowControls.clientWidth : 0) - 10;

			// Not enough space to center the titlebar within window,
			// Center between menu and window controls
			if (leftMarker > (this.element.clientWidth - this.title.clientWidth) / 2 ||
				rightMarker < (this.element.clientWidth + this.title.clientWidth) / 2) {
				this.title.style.position = '';
				this.title.style.left = '';
				this.title.style.transform = '';
				return;
			}
		}

		this.title.style.position = 'absolute';
		this.title.style.left = '50%';
		this.title.style.transform = 'translate(-50%, 0)';
	}

	protected installMenubar(): void {
		super.installMenubar();

		if (this.menubar) {
			return;
		}

		if (this.customMenubar) {
			this._register(this.customMenubar.onFocusStateChange(e => this.onMenubarFocusChanged(e)));
		}
	}

	createContentArea(parent: HTMLElement): HTMLElement {
		const ret = super.createContentArea(parent);

		// App Icon (Native Windows/Linux)
		if (!isMacintosh) {
			this.appIcon = DOM.prepend(this.element, DOM.$('div.window-appicon'));
			this.onUpdateAppIconDragBehavior();

			this._register(DOM.addDisposableListener(this.appIcon, DOM.EventType.DBLCLICK, (e => {
				this.nativeHostService.closeWindow();
			})));
		}

		// Draggable region that we can manipulate for #52522
		this.dragRegion = DOM.prepend(this.element, DOM.$('div.titlebar-drag-region'));

		// Window Controls (Native Windows/Linux)
		if (!isMacintosh) {
			this.windowControls = DOM.append(this.element, DOM.$('div.window-controls-container'));

			// Minimize
			const minimizeIcon = DOM.append(this.windowControls, DOM.$('div.window-icon.window-minimize' + Codicon.chromeMinimize.cssSelector));
			this._register(DOM.addDisposableListener(minimizeIcon, DOM.EventType.CLICK, e => {
				this.nativeHostService.minimizeWindow();
			}));

			// Restore
			this.maxRestoreControl = DOM.append(this.windowControls, DOM.$('div.window-icon.window-max-restore'));
			this._register(DOM.addDisposableListener(this.maxRestoreControl, DOM.EventType.CLICK, async e => {
				const maximized = await this.nativeHostService.isMaximized();
				if (maximized) {
					return this.nativeHostService.unmaximizeWindow();
				}

				return this.nativeHostService.maximizeWindow();
			}));

			// Close
			const closeIcon = DOM.append(this.windowControls, DOM.$('div.window-icon.window-close' + Codicon.chromeClose.cssSelector));
			this._register(DOM.addDisposableListener(closeIcon, DOM.EventType.CLICK, e => {
				this.nativeHostService.closeWindow();
			}));

			// Resizer
			this.resizer = DOM.append(this.element, DOM.$('div.resizer'));

			this._register(this.layoutService.onMaximizeChange(maximized => this.onDidChangeMaximized(maximized)));
			this.onDidChangeMaximized(this.layoutService.isWindowMaximized());
		}

		return ret;
	}

	updateLayout(dimension: DOM.Dimension): void {
		this.lastLayoutDimensions = dimension;

		if (getTitleBarStyle(this.configurationService) === 'custom') {
			// Only prevent zooming behavior on macOS or when the menubar is not visible
			if (isMacintosh || this.currentMenubarVisibility === 'hidden') {
				this.title.style.zoom = `${1 / getZoomFactor()}`;
				if (isWindows || isLinux) {
					if (this.appIcon) {
						this.appIcon.style.zoom = `${1 / getZoomFactor()}`;
					}

					if (this.windowControls) {
						this.windowControls.style.zoom = `${1 / getZoomFactor()}`;
					}
				}
			} else {
				this.title.style.zoom = '';
				if (isWindows || isLinux) {
					if (this.appIcon) {
						this.appIcon.style.zoom = '';
					}

					if (this.windowControls) {
						this.windowControls.style.zoom = '';
					}
				}
			}

			DOM.runAtThisOrScheduleAtNextAnimationFrame(() => this.adjustTitleMarginToCenter());

			if (this.customMenubar) {
				const menubarDimension = new DOM.Dimension(0, dimension.height);
				this.customMenubar.layout(menubarDimension);
			}
		}
	}
}
