/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INavigator, ArrayNavigator } from 'vs/base/common/iterator';

export class HistoryNavigator<T> implements INavigator<T> {

	private _history!: Set<T>;
	private _limit: number;
	private _navigator!: ArrayNavigator<T>;

	constructor(history: readonly T[] = [], limit: number = 10) {
		this._initialize(history);
		this._limit = limit;
		this._onChange();
	}

	public getHistory(): T[] {
		return this._elements;
	}

	public add(t: T) {
		this._history.delete(t);
		this._history.add(t);
		this._onChange();
	}

	public next(): T | null {
		return this._navigator.next();
	}

	public previous(): T | null {
		return this._navigator.previous();
	}

	public current(): T | null {
		return this._navigator.current();
	}

	public parent(): null {
		return null;
	}

	public first(): T | null {
		return this._navigator.first();
	}

	public last(): T | null {
		return this._navigator.last();
	}

	public has(t: T): boolean {
		return this._history.has(t);
	}

	public clear(): void {
		this._initialize([]);
		this._onChange();
	}

	private _onChange() {
		this._reduceToLimit();
		const elements = this._elements;
		this._navigator = new ArrayNavigator(elements, 0, elements.length, elements.length);
	}

	private _reduceToLimit() {
		const data = this._elements;
		if (data.length > this._limit) {
			this._initialize(data.slice(data.length - this._limit));
		}
	}

	private _initialize(history: readonly T[]): void {
		this._history = new Set();
		for (const entry of history) {
			this._history.add(entry);
		}
	}

	private get _elements(): T[] {
		const elements: T[] = [];
		this._history.forEach(e => elements.push(e));
		return elements;
	}
}
