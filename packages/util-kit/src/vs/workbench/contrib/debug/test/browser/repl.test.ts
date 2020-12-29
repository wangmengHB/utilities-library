/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import severity from 'vs/base/common/severity';
import { DebugModel, StackFrame, Thread } from 'vs/workbench/contrib/debug/common/debugModel';
import { MockRawSession, MockDebugAdapter, createMockDebugModel } from 'vs/workbench/contrib/debug/test/browser/mockDebug';
import { SimpleReplElement, RawObjectReplElement, ReplEvaluationInput, ReplModel, ReplEvaluationResult, ReplGroup } from 'vs/workbench/contrib/debug/common/replModel';
import { RawDebugSession } from 'vs/workbench/contrib/debug/browser/rawDebugSession';
import { timeout } from 'vs/base/common/async';
import { createMockSession } from 'vs/workbench/contrib/debug/test/browser/callStack.test';
import { ReplFilter } from 'vs/workbench/contrib/debug/browser/replFilter';
import { TreeVisibility } from 'vs/base/browser/ui/tree/tree';

suite('Debug - REPL', () => {
	let model: DebugModel;
	let rawSession: MockRawSession;

	setup(() => {
		model = createMockDebugModel();
		rawSession = new MockRawSession();
	});

	test('repl output', () => {
		const session = createMockSession(model);
		const repl = new ReplModel();
		repl.appendToRepl(session, 'first line\n', severity.Error);
		repl.appendToRepl(session, 'second line ', severity.Error);
		repl.appendToRepl(session, 'third line ', severity.Error);
		repl.appendToRepl(session, 'fourth line', severity.Error);

		let elements = <SimpleReplElement[]>repl.getReplElements();
		assert.equal(elements.length, 2);
		assert.equal(elements[0].value, 'first line\n');
		assert.equal(elements[0].severity, severity.Error);
		assert.equal(elements[1].value, 'second line third line fourth line');
		assert.equal(elements[1].severity, severity.Error);

		repl.appendToRepl(session, '1', severity.Warning);
		elements = <SimpleReplElement[]>repl.getReplElements();
		assert.equal(elements.length, 3);
		assert.equal(elements[2].value, '1');
		assert.equal(elements[2].severity, severity.Warning);

		const keyValueObject = { 'key1': 2, 'key2': 'value' };
		repl.appendToRepl(session, new RawObjectReplElement('fakeid', 'fake', keyValueObject), severity.Info);
		const element = <RawObjectReplElement>repl.getReplElements()[3];
		assert.equal(element.value, 'Object');
		assert.deepEqual(element.valueObj, keyValueObject);

		repl.removeReplExpressions();
		assert.equal(repl.getReplElements().length, 0);

		repl.appendToRepl(session, '1\n', severity.Info);
		repl.appendToRepl(session, '2', severity.Info);
		repl.appendToRepl(session, '3\n4', severity.Info);
		repl.appendToRepl(session, '5\n', severity.Info);
		repl.appendToRepl(session, '6', severity.Info);
		elements = <SimpleReplElement[]>repl.getReplElements();
		assert.equal(elements.length, 3);
		assert.equal(elements[0], '1\n');
		assert.equal(elements[1], '23\n45\n');
		assert.equal(elements[2], '6');

		repl.removeReplExpressions();
		repl.appendToRepl(session, 'first line\n', severity.Info);
		repl.appendToRepl(session, 'first line\n', severity.Info);
		repl.appendToRepl(session, 'first line\n', severity.Info);
		repl.appendToRepl(session, 'second line', severity.Info);
		repl.appendToRepl(session, 'second line', severity.Info);
		repl.appendToRepl(session, 'third line', severity.Info);
		elements = <SimpleReplElement[]>repl.getReplElements();
		assert.equal(elements.length, 3);
		assert.equal(elements[0], 'first line\n');
		assert.equal(elements[0].count, 3);
		assert.equal(elements[1], 'second line');
		assert.equal(elements[1].count, 2);
		assert.equal(elements[2], 'third line');
		assert.equal(elements[2].count, 1);
	});

	test('repl output count', () => {
		const session = createMockSession(model);
		const repl = new ReplModel();
		repl.appendToRepl(session, 'first line\n', severity.Info);
		repl.appendToRepl(session, 'first line\n', severity.Info);
		repl.appendToRepl(session, 'first line\n', severity.Info);
		repl.appendToRepl(session, 'second line', severity.Info);
		repl.appendToRepl(session, 'second line', severity.Info);
		repl.appendToRepl(session, 'third line', severity.Info);
		const elements = <SimpleReplElement[]>repl.getReplElements();
		assert.equal(elements.length, 3);
		assert.equal(elements[0], 'first line\n');
		assert.equal(elements[0].count, 3);
		assert.equal(elements[1], 'second line');
		assert.equal(elements[1].count, 2);
		assert.equal(elements[2], 'third line');
		assert.equal(elements[2].count, 1);
	});

	test('repl merging', () => {
		// 'mergeWithParent' should be ignored when there is no parent.
		const parent = createMockSession(model, 'parent', { repl: 'mergeWithParent' });
		const child1 = createMockSession(model, 'child1', { parentSession: parent, repl: 'separate' });
		const child2 = createMockSession(model, 'child2', { parentSession: parent, repl: 'mergeWithParent' });
		const grandChild = createMockSession(model, 'grandChild', { parentSession: child2, repl: 'mergeWithParent' });
		const child3 = createMockSession(model, 'child3', { parentSession: parent });

		let parentChanges = 0;
		parent.onDidChangeReplElements(() => ++parentChanges);

		parent.appendToRepl('1\n', severity.Info);
		assert.equal(parentChanges, 1);
		assert.equal(parent.getReplElements().length, 1);
		assert.equal(child1.getReplElements().length, 0);
		assert.equal(child2.getReplElements().length, 1);
		assert.equal(grandChild.getReplElements().length, 1);
		assert.equal(child3.getReplElements().length, 0);

		grandChild.appendToRepl('2\n', severity.Info);
		assert.equal(parentChanges, 2);
		assert.equal(parent.getReplElements().length, 2);
		assert.equal(child1.getReplElements().length, 0);
		assert.equal(child2.getReplElements().length, 2);
		assert.equal(grandChild.getReplElements().length, 2);
		assert.equal(child3.getReplElements().length, 0);

		child3.appendToRepl('3\n', severity.Info);
		assert.equal(parentChanges, 2);
		assert.equal(parent.getReplElements().length, 2);
		assert.equal(child1.getReplElements().length, 0);
		assert.equal(child2.getReplElements().length, 2);
		assert.equal(grandChild.getReplElements().length, 2);
		assert.equal(child3.getReplElements().length, 1);

		child1.appendToRepl('4\n', severity.Info);
		assert.equal(parentChanges, 2);
		assert.equal(parent.getReplElements().length, 2);
		assert.equal(child1.getReplElements().length, 1);
		assert.equal(child2.getReplElements().length, 2);
		assert.equal(grandChild.getReplElements().length, 2);
		assert.equal(child3.getReplElements().length, 1);
	});

	test('repl expressions', () => {
		const session = createMockSession(model);
		assert.equal(session.getReplElements().length, 0);
		model.addSession(session);

		session['raw'] = <any>rawSession;
		const thread = new Thread(session, 'mockthread', 1);
		const stackFrame = new StackFrame(thread, 1, <any>undefined, 'app.js', 'normal', { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 }, 1);
		const replModel = new ReplModel();
		replModel.addReplExpression(session, stackFrame, 'myVariable').then();
		replModel.addReplExpression(session, stackFrame, 'myVariable').then();
		replModel.addReplExpression(session, stackFrame, 'myVariable').then();

		assert.equal(replModel.getReplElements().length, 3);
		replModel.getReplElements().forEach(re => {
			assert.equal((<ReplEvaluationInput>re).value, 'myVariable');
		});

		replModel.removeReplExpressions();
		assert.equal(replModel.getReplElements().length, 0);
	});

	test('repl ordering', async () => {
		const session = createMockSession(model);
		model.addSession(session);

		const adapter = new MockDebugAdapter();
		const raw = new RawDebugSession(adapter, undefined!, undefined!, undefined!, undefined!, undefined!, undefined!);
		session.initializeForTest(raw);

		await session.addReplExpression(undefined, 'before.1');
		assert.equal(session.getReplElements().length, 3);
		assert.equal((<ReplEvaluationInput>session.getReplElements()[0]).value, 'before.1');
		assert.equal((<SimpleReplElement>session.getReplElements()[1]).value, 'before.1');
		assert.equal((<ReplEvaluationResult>session.getReplElements()[2]).value, '=before.1');

		await session.addReplExpression(undefined, 'after.2');
		await timeout(0);
		assert.equal(session.getReplElements().length, 6);
		assert.equal((<ReplEvaluationInput>session.getReplElements()[3]).value, 'after.2');
		assert.equal((<ReplEvaluationResult>session.getReplElements()[4]).value, '=after.2');
		assert.equal((<SimpleReplElement>session.getReplElements()[5]).value, 'after.2');
	});

	test('repl groups', async () => {
		const session = createMockSession(model);
		const repl = new ReplModel();

		repl.appendToRepl(session, 'first global line', severity.Info);
		repl.startGroup('group_1', true);
		repl.appendToRepl(session, 'first line in group', severity.Info);
		repl.appendToRepl(session, 'second line in group', severity.Info);
		const elements = repl.getReplElements();
		assert.equal(elements.length, 2);
		const group = elements[1] as ReplGroup;
		assert.equal(group.name, 'group_1');
		assert.equal(group.autoExpand, true);
		assert.equal(group.hasChildren, true);
		assert.equal(group.hasEnded, false);

		repl.startGroup('group_2', false);
		repl.appendToRepl(session, 'first line in subgroup', severity.Info);
		repl.appendToRepl(session, 'second line in subgroup', severity.Info);
		const children = group.getChildren();
		assert.equal(children.length, 3);
		assert.equal((<SimpleReplElement>children[0]).value, 'first line in group');
		assert.equal((<SimpleReplElement>children[1]).value, 'second line in group');
		assert.equal((<ReplGroup>children[2]).name, 'group_2');
		assert.equal((<ReplGroup>children[2]).hasEnded, false);
		assert.equal((<ReplGroup>children[2]).getChildren().length, 2);
		repl.endGroup();
		assert.equal((<ReplGroup>children[2]).hasEnded, true);
		repl.appendToRepl(session, 'third line in group', severity.Info);
		assert.equal(group.getChildren().length, 4);
		assert.equal(group.hasEnded, false);
		repl.endGroup();
		assert.equal(group.hasEnded, true);
		repl.appendToRepl(session, 'second global line', severity.Info);
		assert.equal(repl.getReplElements().length, 3);
		assert.equal((<SimpleReplElement>repl.getReplElements()[2]).value, 'second global line');
	});

	test('repl filter', async () => {
		const session = createMockSession(model);
		const repl = new ReplModel();
		const replFilter = new ReplFilter();

		const getFilteredElements = () => {
			const elements = repl.getReplElements();
			return elements.filter(e => {
				const filterResult = replFilter.filter(e, TreeVisibility.Visible);
				return filterResult === true || filterResult === TreeVisibility.Visible;
			});
		};

		repl.appendToRepl(session, 'first line\n', severity.Info);
		repl.appendToRepl(session, 'second line\n', severity.Info);
		repl.appendToRepl(session, 'third line\n', severity.Info);
		repl.appendToRepl(session, 'fourth line\n', severity.Info);

		replFilter.filterQuery = 'first';
		let r1 = <SimpleReplElement[]>getFilteredElements();
		assert.equal(r1.length, 1);
		assert.equal(r1[0].value, 'first line\n');

		replFilter.filterQuery = '!first';
		let r2 = <SimpleReplElement[]>getFilteredElements();
		assert.equal(r1.length, 1);
		assert.equal(r2[0].value, 'second line\n');
		assert.equal(r2[1].value, 'third line\n');
		assert.equal(r2[2].value, 'fourth line\n');

		replFilter.filterQuery = 'first, line';
		let r3 = <SimpleReplElement[]>getFilteredElements();
		assert.equal(r3.length, 4);
		assert.equal(r3[0].value, 'first line\n');
		assert.equal(r3[1].value, 'second line\n');
		assert.equal(r3[2].value, 'third line\n');
		assert.equal(r3[3].value, 'fourth line\n');

		replFilter.filterQuery = 'line, !second';
		let r4 = <SimpleReplElement[]>getFilteredElements();
		assert.equal(r4.length, 3);
		assert.equal(r4[0].value, 'first line\n');
		assert.equal(r4[1].value, 'third line\n');
		assert.equal(r4[2].value, 'fourth line\n');

		replFilter.filterQuery = '!second, line';
		let r4_same = <SimpleReplElement[]>getFilteredElements();
		assert.equal(r4.length, r4_same.length);

		replFilter.filterQuery = '!line';
		let r5 = <SimpleReplElement[]>getFilteredElements();
		assert.equal(r5.length, 0);

		replFilter.filterQuery = 'smth';
		let r6 = <SimpleReplElement[]>getFilteredElements();
		assert.equal(r6.length, 0);
	});
});
