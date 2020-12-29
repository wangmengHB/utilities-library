/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ExtHostTestingResource } from 'vs/workbench/api/common/extHost.protocol';
import { RunTestForProviderRequest, RunTestsRequest, RunTestsResult, TestsDiff } from 'vs/workbench/contrib/testing/common/testCollection';

export const ITestService = createDecorator<ITestService>('testService');

export interface MainTestController {
	runTests(request: RunTestForProviderRequest, token: CancellationToken): Promise<RunTestsResult>;
}

export type TestDiffListener = (diff: TestsDiff) => void;

export interface ITestService {
	readonly _serviceBrand: undefined;
	readonly onShouldSubscribe: Event<{ resource: ExtHostTestingResource, uri: URI }>;
	readonly onShouldUnsubscribe: Event<{ resource: ExtHostTestingResource, uri: URI }>;
	readonly onDidChangeProviders: Event<{ delta: number }>;
	readonly providers: number;
	readonly subscriptions: ReadonlyArray<{ resource: ExtHostTestingResource, uri: URI }>;

	readonly testRuns: Iterable<RunTestsRequest>;
	readonly onTestRunStarted: Event<RunTestsRequest>;
	readonly onTestRunCompleted: Event<{ req: RunTestsRequest, result: RunTestsResult }>;

	registerTestController(id: string, controller: MainTestController): void;
	unregisterTestController(id: string): void;
	runTests(req: RunTestsRequest, token?: CancellationToken): Promise<RunTestsResult>;
	cancelTestRun(req: RunTestsRequest): void;
	publishDiff(resource: ExtHostTestingResource, uri: URI, diff: TestsDiff): void;
	subscribeToDiffs(resource: ExtHostTestingResource, uri: URI, acceptDiff: TestDiffListener): IDisposable;
}
