/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IPaneComposite } from 'vs/workbench/common/panecomposite';

export const SideBarVisibleContext = new RawContextKey<boolean>('sideBarVisible', false);
export const SidebarFocusContext = new RawContextKey<boolean>('sideBarFocus', false);
export const ActiveViewletContext = new RawContextKey<string>('activeViewlet', '');

export interface IViewlet extends IPaneComposite {

	/**
	 * Returns the minimal width needed to avoid any content horizontal truncation
	 */
	getOptimalWidth(): number | undefined;
}
