/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { once } from '../base/functional';
import { IDisposable, IReference } from '../interface';




export function isDisposable<E extends object>(thing: E): thing is E & IDisposable {
	return typeof (<IDisposable><any>thing).dispose === 'function'
		&& (<IDisposable><any>thing).dispose.length === 0;
}

export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(disposable: T | undefined): T | undefined;
export function dispose<T extends IDisposable>(disposables: Array<T>): Array<T>;
export function dispose<T extends IDisposable>(disposables: ReadonlyArray<T>): ReadonlyArray<T>;
export function dispose<T extends IDisposable>(disposables: T | T[] | undefined): T | T[] | undefined {
	if (Array.isArray(disposables)) {
		disposables.forEach(d => {
			if (d) {
				d.dispose();
			}
		});
		return [];
	} else if (disposables) {
		disposables.dispose();
		return disposables;
	} else {
		return undefined;
	}
}

export function combinedDisposable(...disposables: IDisposable[]): IDisposable {
	return { dispose: () => dispose(disposables) };
}

export function toDisposable(fn: () => void): IDisposable {
	const self = {
		dispose: () => {
			fn();
		}
	};
	return self;
}

export class DisposableStore implements IDisposable {
	private _toDispose = new Set<IDisposable>();
	private _isDisposed = false;

	/**
	 * Dispose of all registered disposables and mark this object as disposed.
	 *
	 * Any future disposables added to this object will be disposed of on `add`.
	 */
	public dispose(): void {
		if (this._isDisposed) {
			return;
		}
		this._isDisposed = true;
		this.clear();
	}

	/**
	 * Dispose of all registered disposables but do not mark this object as disposed.
	 */
	public clear(): void {
		this._toDispose.forEach(item => item.dispose());
		this._toDispose.clear();
	}

	public add<T extends IDisposable>(t: T): T {
		if (!t) {
			return t;
		}
		if ((t as any as DisposableStore) === this) {
			throw new Error('Cannot register a disposable on itself!');
		}

		if (this._isDisposed) {
			console.warn(new Error('Trying to add a disposable to a DisposableStore that has already been disposed of. The added object will be leaked!').stack);
		} else {
			this._toDispose.add(t);
		}

		return t;
	}
}

export abstract class Disposable implements IDisposable {

	static readonly None = Object.freeze<IDisposable>({ dispose() { } });

	private readonly _store = new DisposableStore();

	constructor() { }

	public dispose(): void {
		this._store.dispose();
	}

	protected _register<T extends IDisposable>(t: T): T {
		if ((t as any as Disposable) === this) {
			throw new Error('Cannot register a disposable on itself!');
		}
		return this._store.add(t);
	}
}

/**
 * Manages the lifecycle of a disposable value that may be changed.
 *
 * This ensures that when the the disposable value is changed, the previously held disposable is disposed of. You can
 * also register a `MutableDisposable` on a `Disposable` to ensure it is automatically cleaned up.
 */
export class MutableDisposable<T extends IDisposable> implements IDisposable {
	private _value?: T;
	private _isDisposed = false;

	constructor() {}

	get value(): T | undefined {
		return this._isDisposed ? undefined : this._value;
	}

	set value(value: T | undefined) {
		if (this._isDisposed || value === this._value) {
			return;
		}

		if (this._value) {
			this._value.dispose();
		}
		this._value = value;
	}

	clear() {
		this.value = undefined;
	}

	dispose(): void {
		this._isDisposed = true;
		if (this._value) {
			this._value.dispose();
		}
		this._value = undefined;
	}
}

/**
 * Wrapper class that stores a disposable that is not currently "owned" by anyone.
 *
 * Example use cases:
 *
 * - Express that a function/method will take ownership of a disposable parameter.
 * - Express that a function returns a disposable that the caller must explicitly take ownership of.
 */
export class UnownedDisposable<T extends IDisposable> extends Disposable {
	private _hasBeenAcquired = false;
	private _value?: T;

	public constructor(value: T) {
		super();
		this._value = value;
	}

	public acquire(): T {
		if (this._hasBeenAcquired) {
			throw new Error('This disposable has already been acquired');
		}
		this._hasBeenAcquired = true;
		const value = this._value!;
		this._value = undefined;
		return value;
	}

	public dispose() {
		super.dispose();
		if (!this._hasBeenAcquired) {
			this._hasBeenAcquired = true;
			this._value!.dispose();
			this._value = undefined;
		}
	}
}



export abstract class ReferenceCollection<T> {

	private readonly references: Map<string, { readonly object: T; counter: number; }> = new Map();

	acquire(key: string): IReference<T> {
		let reference = this.references.get(key);

		if (!reference) {
			reference = { counter: 0, object: this.createReferencedObject(key) };
			this.references.set(key, reference);
		}

		const { object } = reference;
		const dispose = once(() => {
			if (--reference!.counter === 0) {
				this.destroyReferencedObject(key, reference!.object);
				this.references.delete(key);
			}
		});

		reference.counter++;

		return { object, dispose };
	}

	protected abstract createReferencedObject(key: string): T;
	protected abstract destroyReferencedObject(key: string, object: T): void;
}

export class ImmortalReference<T> implements IReference<T> {
	constructor(public object: T) { }
	dispose(): void { /* noop */ }
}
