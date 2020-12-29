/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Disposable } from 'vs/base/common/lifecycle';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { Severity } from 'vs/platform/notification/common/notification';
import { INativeHostService } from 'vs/platform/native/electron-sandbox/native';
import { env } from 'vs/base/common/process';

export class LoaderCyclicChecker extends Disposable implements IWorkbenchContribution {

	constructor(
		@IDialogService dialogService: IDialogService,
		@INativeHostService nativeHostService: INativeHostService,
	) {
		super();

		if (require.hasDependencyCycle()) {
			if (env.CI || env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
				// running on a build machine, just exit
				console.log('There is a dependency cycle in the AMD modules');
				nativeHostService.exit(37);
			}
			dialogService.show(Severity.Error, nls.localize('loaderCycle', "There is a dependency cycle in the AMD modules"), [nls.localize('ok', "OK")]);
			nativeHostService.openDevTools();
		}
	}
}

