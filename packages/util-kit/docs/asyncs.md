# asyncs
```ts
import { asyncs } from 'util-kit';
const {
    createCancelablePromise, timeout, Queue
} = asyncs;
```
* createCancelablePromise
* timeout
* raceTimeout
* raceCancellation



## 1. createCancelablePromise
It create a cancelable promise, which can cancel the `promise`, force it to be rejected. It accept a callback function as parameter. The callback function accept `token` as input (mainly used to register cancel handler if need), and it must return a promise. The `createCancelablePromise` will wrap the inner promise to be a cancelable promise, no matter the inner promise is already resolved or rejected. And the cancel happens only once.    
After the cancelable promise is resolved or rejected without cancel, the handler on the token are all disposed immediately.       

Example:
```ts
const {
    createCancelablePromise, timeout, 
} = asyncs;

let canceled = 0;
let promise = createCancelablePromise(token => {
    token.onCancellationRequested(_ => { canceled += 1; });
    return new Promise(resolve => { /*never*/ });
});
promise.then(
    () => console.log('never happens'), 
    err => {
        console.log(`onCancellationRequested is called, canceled should be 1`, canceled);
        console.log(`err is isPromiseCanceledError: true`, isPromiseCanceledError(err));
    }
);
promise.cancel();
console.log(`canceled should be 1`, canceled);
promise.cancel(); // cancel only once



canceled = 0;
promise = createCancelablePromise(token => {
    token.onCancellationRequested(_ => { canceled += 1; });
    // the inner promise is already resolved
    return Promise.resolve(1234);
});
promise.then(
    () => console.log('never happens'), 
    (err) => {
        console.log(`onCancellationRequested is called, canceled should be 1`, canceled);
        console.log(`err is isPromiseCanceledError: true`, isPromiseCanceledError(err));
    }
);
promise.cancel();
console.log(`canceled should be 1`, canceled);


const order: string[] = [];

let cancellablePromise = createCancelablePromise(token => {
    order.push('in callback');
    token.onCancellationRequested(_ => order.push('cancelled'));
    return Promise.resolve(1234);
});

order.push('afterCreate');

promise = cancellablePromise.finally(() => order.push('finally'));

cancellablePromise.cancel();
order.push('afterCancel');

console.log(`order should be ['in callback', 'afterCreate', 'cancelled', 'afterCancel']`, order);

promise.then(
    () => {},
    () => {
        console.log('because it is canceled, the promise is rejected.')
        console.log(`order should be ['in callback', 'afterCreate', 'cancelled', 'afterCancel','finally']`, order);
    }
);
```

## 2. timeout
`timeout` is used to wrap `setTimeout` as a cancelable promise. 
```ts
export function timeout(millis: number, token?: CancellationToken): CancelablePromise<void> | Promise<void> {
	if (!token) {
		return createCancelablePromise(token => timeout(millis, token));
	}
	return new Promise((resolve, reject) => {
		const handle = setTimeout(resolve, millis);
		token.onCancellationRequested(() => {
			clearTimeout(handle);
			reject(errors.canceled());
		});
	});
}
```


## 3. raceTimeout
`raceTimeout` is used to race a promise and a certain timeout millis.
```ts
export function raceTimeout<T>(promise: Promise<T>, timeout: number, onTimeout?: () => void): Promise<T | undefined> {
	let promiseResolve: ((value: T | undefined) => void) | undefined = undefined;

	const timer = setTimeout(() => {
		promiseResolve?.(undefined);
		onTimeout?.();
	}, timeout);

	return Promise.race([
		promise.finally(() => clearTimeout(timer)),
		new Promise<T | undefined>(resolve => promiseResolve = resolve)
	]);
}
```

## 4. raceCancellation
```ts
export function raceCancellation<T>(promise: Promise<T>, token: CancellationToken, defaultValue?: T): Promise<T | undefined> {
	return Promise.race([promise, new Promise<T | undefined>(resolve => token.onCancellationRequested(() => resolve(defaultValue)))]);
}
```

## 5. retry
```ts
export async function retry<T>(task: ITask<Promise<T>>, delay: number, retries: number): Promise<T> {
	let lastError: Error | undefined;

	for (let i = 0; i < retries; i++) {
		try {
			return await task();
		} catch (error) {
			lastError = error;

			await timeout(delay);
		}
	}

	throw lastError;
}
```

## 6. firstParallel
It race promises with a `shouldStop` function, if the first match is hit, it will return the target resolved result and cancel all the promises if they are cancelable. If finally not matched, return default value.	
```ts
export function firstParallel<T>(promiseList: Promise<T>[], shouldStop: (t: T) => boolean = t => !!t, defaultValue: T | null = null) {
	if (promiseList.length === 0) {
		return Promise.resolve(defaultValue);
	}

	let todo = promiseList.length;
	const finish = () => {
		todo = -1;
		for (const promise of promiseList) {
			(promise as Partial<CancelablePromise<T>>).cancel?.();
		}
	};

	return new Promise<T | null>((resolve, reject) => {
		for (const promise of promiseList) {
			promise.then(result => {
				if (--todo >= 0 && shouldStop(result)) {
					finish();
					resolve(result);
				} else if (todo === 0) {
					resolve(defaultValue);
				}
			})
			.catch(err => {
				if (--todo >= 0) {
					finish();
					reject(err);
				}
			});
		}
	});
}

```


## 7. Queue
A helper to queue N promises, keeping it resolved in order, and error bubbling would not block the queue.
`new Queue()` is equivalent with `new Limiter(1)`. 

```ts
let queue = new Queue();

let res: number[] = [];
let error = false;

let f1 = () => timeout(Math.random() * 100).then(() => res.push(1));
let f2 = () => Promise.resolve(true).then(() => res.push(2));
let f3 = () => Promise.resolve(true).then(() => Promise.reject(new Error('error')));
let f4 = () => timeout(Math.random() * 100).then(() => res.push(4));
let f5 = () => timeout(Math.random() * 100).then(() => res.push(5));

queue.queue(f1);
queue.queue(f2);
queue.queue(f3).then(undefined, () => error = true);
queue.queue(f4);

queue.queue(f5).then(() => {
	console.log(`res[0] should be 1`,res[0]);
	console.log(`res[1] should be 2`, res[1]);
	console.log(`error should be true`, error);
	console.log(`res[2] should be 4`, res[2]);
	console.log(`res[3] should be 5`, res[3]);
});

queue.onFinished(() => {
	console.log('items in the queue are all consumed!');
});

```

## 8. Limiter
A helper to queue N promises and run them all with a max degree of parallelism. The helper ensures that at any time no more than M promises are running at the same time.
```ts
let activePromises = 0;
let factoryFactory = (n: number) => () => {
	activePromises++;
	console.log('the count of promise run in the same time should < 6', activePromises < 6)
	return timeout(Math.random() * 100).then(() => { activePromises--; return n; });
};

// limit the max paralism to be 5
let limiter = new Limiter(5);

let promises: Promise<any>[] = [];
[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(n => promises.push(limiter.queue(factoryFactory(n))));

Promise.all(promises).then((res) => {
	console.log(`res.length should be 10`, res.length);
	console.log(`res should be [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]`, res);
});

```

 





## sequence
```ts
/**
 * Runs the provided list of promise factories in sequential order. The returned
 * promise will complete to an array of results from each promise.
 */

export function sequence<T>(promiseFactories: ITask<Promise<T>>[]): Promise<T[]> {
	const results: T[] = [];
	let index = 0;
	const len = promiseFactories.length;

	function next(): Promise<T> | null {
		return index < len ? promiseFactories[index++]() : null;
	}

	function thenHandler(result: any): Promise<any> {
		if (result !== undefined && result !== null) {
			results.push(result);
		}

		const n = next();
		if (n) {
			return n.then(thenHandler);
		}

		return Promise.resolve(results);
	}

	return Promise.resolve(null).then(thenHandler);
}
```



## Throttler
Only the first and last promise task factory will be called when the current queue is not resolved.

```ts
let factory = (n) => () => timeout(Math.random() * 100).then(() => { 
    console.log(`No.${n} task is called.`); 
    return n; 
});

let throttler = new Throttler();

Promise.all([
    throttler.queue(factory(1)).then((result) => { console.log(`1 reuslt be 1`, result); }),
    throttler.queue(factory(2)).then((result) => { console.log(`2 reuslt be 5`, result); }),
    throttler.queue(factory(3)).then((result) => { console.log(`3 reuslt be 5`, result); }),
    throttler.queue(factory(4)).then((result) => { console.log(`4 reuslt be 5`, result); }),
    throttler.queue(factory(5)).then((result) => { console.log(`5 reuslt be 5`, result); })
]).then(() => {
    
});
```


## Delayer
A helper (following the throttler) to delay execution of a task that is being requested often.

```ts
let factory = (n) => () => timeout(Math.random() * 10).then(() => { 
    console.log(`No.${n} task is called.`); 
    return n; 
});

let delayer = new Delayer(10);

Promise.all([
    delayer.trigger(factory(1)).then((result) => { console.log(`1 reuslt be 5`, result); }),
    delayer.trigger(factory(2)).then((result) => { console.log(`2 reuslt be 5`, result); }),
    delayer.trigger(factory(3)).then((result) => { console.log(`3 reuslt be 5`, result); }),
    delayer.trigger(factory(4)).then((result) => { console.log(`4 reuslt be 5`, result); }),
    delayer.trigger(factory(5)).then((result) => { console.log(`5 reuslt be 5`, result); })
]).then(() => {
    
});

```

## TaskSequentializer
```ts
const sequentializer = new TaskSequentializer();

let pendingDone = false;
sequentializer.setPending(1, timeout(1).then(() => { 
	pendingDone = true; 
	console.log('pending done first');  
}));

// next finishes instantly
let nextDone = false;
const res = sequentializer.setNext(() => Promise.resolve(null).then(() => { 
	nextDone = true; 
	console.log('next after pending'); 
}));

```
