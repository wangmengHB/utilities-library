# util-kit

util-kit is mainly from vscode's code base, and it is a util npm both for browser and nodejs. What it has done have for vscode:     
1. re-organize the exports of vscode code base for easily usage as a common utility npm.    
2. add documents and demos for every available utitilies.           

As a fan for vscode, I think vscode is the most awesome open source front-end project I've ever seen, and its code base has realy high quality. So What if we can reuse all this good stuff (the elegant `data structure / algrithom / design pattern` in vscode) in our own project? Maybe it is a good idea. So I do it for my personal usage, I hope it can also help you. 

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
## 1. [Event Emitter](https://github.com/wangmengHB/utilities-library/blob/master/packages/util-kit/docs/Event.md)

```ts
import { 
  Event, Emitter, EventBufferer, 
  EventMultiplexer, AsyncEmitter, IWaitUntil, 
  PauseableEmitter , IDisposable, DisposableStore, asyncs, 
} from 'util-kit';
```

## 2. objects
```ts
import { objects } from 'util-kit';
const {
  deepClone, deepFreeze, cloneAndChange, mixin, equals, 
  safeStringify, getOrDefault, distinct, getCaseInsensitive, 
} = objects;
```

## 3. numbers
```ts
import { numbers } from 'util-kit';
const {
  clamp, rot, Counter, MovingAverage 
} = numbers;
```

## 4. strings 
```ts
import { strings } from 'util-kit';
const {
  clamp, rot, Counter, MovingAverage 
} = strings;
```

## 5. dates

## 6. decorators
```ts
import { decorators } from 'util-kit';
const {
  createDecorator, createMemoizer, memoize, debounce, throttle, 
} = decorators;
```

## 7. uuid























