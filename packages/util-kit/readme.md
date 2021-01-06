# util-kit

util-kit is mainly from vscode's code base snippet, and it is an util npm both for browser and nodejs. What `util-kit` has done:     
1. Organize the vscode snippet as a util npm can be used both on browser and nodejs. And re-organize the exports of vscode snippet for easily usage.    
2. add documents for utitilies. For complex utitilies, documents and exmaples are provided. For other easy ones, you can easily find the interface in typescript environment.           

As a fan for vscode, I think vscode is the most awesome open source front-end project I've ever seen, and its code base has realy high quality. So I think What if we can reuse all this good stuff (the elegant `data structure / algrithom / design pattern` in vscode) in our own project? Maybe it is a good idea. So `util-kit` is created fot this purpose, I hope it can be helpful.   

The source code of [vscode](https://github.com/microsoft/vscode):
* [src/vs/base/common](https://github.com/microsoft/vscode/tree/master/src/vs/base/common)
This part is common utility part, and it can be run both in browser and nodejs.

unit test:
* [src/vs/base/test/common](https://github.com/microsoft/vscode/tree/master/src/vs/base/test/common)


The code base will be synced from vscode monthly.   


# How To Use util-kit
```bash
npm install --S util-kit
```

# Utilities
## 1. lifecycle ( Disposable )
Disposable is an important concept in vscode, used to manage the lifecycle of object. `Disposable` is an abstract class, which can not be instanced. 
So many objects in vscode are disposable. Especiallly, the event-related part use it a lot. `Dispose` has the same meaning as `destroy`. 
 
```ts
import { 
  IDisposable, DisposableStore, dispose, isDisposable, 
  combinedDisposable, toDisposable, 
} from 'util-kit';
```
Actually it does not do much work in disposable itself, it should be considered as sth like coding rule in vscode. 
For details, you can easily find the interface in typescript environment. 

## 2. [Event & Emitter ](https://github.com/wangmengHB/utilities-library/blob/master/packages/util-kit/docs/event.md)

The event-related utils can be found in `util-kit` as below: 
```ts
import { 
	Emitter, PauseableEmitter, AsyncEmitter,
	EventBufferer, EventMultiplexer, 
	Event, IWaitUntil,
} from 'util-kit';
```

The Event (Emitter) in vscode has the following features:    
1. Emitter ( Emitter/PauseableEmitter/AsyncEmitter ) : 
	* No Event Name Concept				
	* Handling Exception in event handler		
	* In-Order delivery, especially in the scenarior of firing event in handler       
2. PauseableEmitter (extends Emitter)	
3. AsyncEmitter (extends Emitter)	
4. EventMultiplexer ( an util class for emitter)
5. EventBufferer ( an util class for emitter)	
6. Event Utils ( util functions under the namespace `Event`)    
    * Event.buffer    
    * Event.latch     
    * Event.once 
    * Event.stopwatch 
    * Event.fromPromise 
    * Event.debounce

For details, Please view [Event & Emitter document](https://github.com/wangmengHB/utilities-library/blob/master/packages/util-kit/docs/event.md).

## 3. CancellationToken
```ts
import { CancellationTokenSource, CancellationToken } from 'util-kit';
const { isCancellationToken, None, Cancelled } = CancellationToken;
```
`CancellationToken` is defined as a namespace and also as an interface. 
CancellationToken is an important concept in vscode, it is a token used to cancel a promise. The token has 2 properties:
* isCancellationRequested: boolean, it can only be converted from `false` to `true`, can not in the reverse way.  
* onCancellationRequested: it used to register hanlder function and return IDisposable object, the handler is called when cancel happens.   

`CancellationToken.None` is a constant frozen token, representing the initial state token.  
`CancellationToken.Cancelled` is a constant frozen token, representing the cancelled state token. For cancelled token, its `onCancellationRequested` always works as `setTimeout(fn,0)`.

`CancellationTokenSource` is the object which holds the readonly token, and it can cancel the token. `CancellationTokenSource` has several features:
1. cancel the token means the token is converted from `false` to `true`, and the handler in `source.token.onCancellationRequested` will be triggered.  
2. cancel happens only once.         
3. parent token will cancel children when parent is cancelled. `CancellationTokenSource` can accept a parent token as the optional parameter in constuctor.  
4. `CancellationTokenSource` has a `dispose` method to dispose all handlers, and it accept an optional parameter to let you cancel the token first and then dispose.

Example: 
```ts
import { CancellationTokenSource, CancellationToken } from 'util-kit';

const source = new CancellationTokenSource();
let cancelCount = 0;
function onCancel() {
  cancelCount += 1;
}
source.token.onCancellationRequested(onCancel);
console.log(`should be false`, source.token.isCancellationRequested);
// cancel the first time
source.cancel();
console.log(`count should be 1`, count);
console.log(`should be true`, source.token.isCancellationRequested);
// cancel the second time, nothing happens
source.cancel();
console.log(`count should be 1`, count);

// for the token whose isCancellationRequested is true,
// onCancellationRequested functions as setTimeout(0)
source.token.onCancellationRequested(function() {
  console.log('here is called as setTimeout(fn, 0)')
});


let parent = new CancellationTokenSource();
let child = new CancellationTokenSource(parent.token);

let childCount = 0;
child.token.onCancellationRequested(() => childCount += 1);
// parent cancel will cancel children
parent.cancel();

console.log('child count should be 1', childCount);
console.log('child.token.isCancellationRequested should be true', child.token.isCancellationRequested);
console.log('child count should be 1', childCount);
console.log('parent.token.isCancellationRequested should be true', parent.token.isCancellationRequested);
```

Notice: for `CancellationTokenSource`:
* if `dispose` immediately after created, its token always is `CancellationToken.None`
* if `cancel` immediately after created, its token always is `CancellationToken.Cancelled`.


## 4. async utils
The async utils of vscode can be found in: 
```ts
import { asyncs } from 'util-kit';
const {
	createCancelablePromise, 
	timeout, raceTimeout, raceCancellation, retry, sequence, 
	Queue, Limiter, Throttler, Delayer, 
} = asyncs;
```
The most common used is `createCancelablePromise`, it can create a cancelable promise.  
For more details, view [async utils document](https://github.com/wangmengHB/utilities-library/blob/master/packages/util-kit/docs/asyncs.md).


## 5. objects
```ts
import { objects } from 'util-kit';
const {
  deepClone, deepFreeze, cloneAndChange, mixin, equals, 
  safeStringify, getOrDefault, distinct, getCaseInsensitive, 
} = objects;
```

## 6. numbers
```ts
import { numbers } from 'util-kit';
const {
  clamp, rot, Counter, MovingAverage 
} = numbers;
```

## 7. strings 
```ts
import { strings } from 'util-kit';
const {
  escapeRegExpCharacters, escape, createRegExp, 
} = strings;
```

## 8. dates

## 9. decorators
```ts
import { decorators } from 'util-kit';
const {
  createDecorator, createMemoizer, memoize, debounce, throttle, 
} = decorators;
```

## 10. uuid























