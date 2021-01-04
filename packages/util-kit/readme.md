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

# Available Utilities
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

## 2. [Event ( Emitter )](https://github.com/wangmengHB/utilities-library/blob/master/packages/util-kit/docs/event.md)

The event-related utils can be found in `util-kit` as below: 
```ts
import { 
	Emitter, PauseableEmitter, AsyncEmitter,
	EventBufferer, EventMultiplexer, 
	Event, 
	CancellationToken, asyncs,
	IWaitUntil,
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

For details, Please view [Event (Emitter) document](https://github.com/wangmengHB/utilities-library/blob/master/packages/util-kit/docs/event.md).


## 3. objects
```ts
import { objects } from 'util-kit';
const {
  deepClone, deepFreeze, cloneAndChange, mixin, equals, 
  safeStringify, getOrDefault, distinct, getCaseInsensitive, 
} = objects;
```

## 4. numbers
```ts
import { numbers } from 'util-kit';
const {
  clamp, rot, Counter, MovingAverage 
} = numbers;
```

## 5. strings 
```ts
import { strings } from 'util-kit';
const {
  clamp, rot, Counter, MovingAverage 
} = strings;
```

## 6. dates

## 7. decorators
```ts
import { decorators } from 'util-kit';
const {
  createDecorator, createMemoizer, memoize, debounce, throttle, 
} = decorators;
```

## 7. uuid























