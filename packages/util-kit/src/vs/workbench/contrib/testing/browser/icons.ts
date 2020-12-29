/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from 'vs/base/common/codicons';
import { localize } from 'vs/nls';
import { registerIcon } from 'vs/platform/theme/common/iconRegistry';
import { registerThemingParticipant, ThemeIcon } from 'vs/platform/theme/common/themeService';
import { TestRunState } from 'vs/workbench/api/common/extHostTypes';
import { testStatesToIconColors } from 'vs/workbench/contrib/testing/browser/theme';

export const testingViewIcon = registerIcon('testing-view-icon', Codicon.beaker, localize('testingViewIcon', 'View icon of the testing view.'));
export const testingRunIcon = registerIcon('testing-run-icon', Codicon.debugStart, localize('testingRunIcon', 'Icon of the "run test" action.'));
export const testingDebugIcon = registerIcon('testing-debug-icon', Codicon.debugAlt, localize('testingDebugIcon', 'Icon of the "debug test" action.'));
export const testingCancelIcon = registerIcon('testing-cancel-icon', Codicon.close, localize('testingCancelIcon', 'Icon to cancel ongoing test runs.'));

export const testingShowAsList = registerIcon('testing-show-as-list-icon', Codicon.listTree, localize('testingShowAsList', 'Icon shown when the test explorer is disabled as a tree.'));
export const testingShowAsTree = registerIcon('testing-show-as-list-icon', Codicon.listFlat, localize('testingShowAsTree', 'Icon shown when the test explorer is disabled as a list.'));

export const testingStatesToIcons = new Map<TestRunState, ThemeIcon>([
	[TestRunState.Errored, registerIcon('testing-error-icon', Codicon.warning, localize('testingErrorIcon', 'Icon shown for tests that have an error.'))],
	[TestRunState.Failed, registerIcon('testing-failed-icon', Codicon.close, localize('testingFailedIcon', 'Icon shown for tests that failed.'))],
	[TestRunState.Passed, registerIcon('testing-passed-icon', Codicon.pass, localize('testingPassedIcon', 'Icon shown for tests that passed.'))],
	[TestRunState.Queued, registerIcon('testing-queued-icon', Codicon.watch, localize('testingQueuedIcon', 'Icon shown for tests that are queued.'))],
	[TestRunState.Running, registerIcon('testing-loading-icon', Codicon.loading, localize('testingLoadingIcon', 'Icon shown for tests that are loading.'))],
	[TestRunState.Skipped, registerIcon('testing-skipped-icon', Codicon.debugStepOver, localize('testingSkippedIcon', 'Icon shown for tests that are skipped.'))],
	[TestRunState.Unset, registerIcon('testing-unset-icon', Codicon.circleOutline, localize('testingUnsetIcon', 'Icon shown for tests that are in an unset state.'))],
]);

registerThemingParticipant((theme, collector) => {
	for (const [state, icon] of testingStatesToIcons.entries()) {
		const color = testStatesToIconColors[state];
		if (!color) {
			continue;
		}
		collector.addRule(`.monaco-workbench ${ThemeIcon.asCSSSelector(icon)} {
			color: ${theme.getColor(color)} !important;
		}`);
	}
});
