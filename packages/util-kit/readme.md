# util-kit

This utilities project is mainly from vscode's code base. Vscode is the most awesome open source front end project I've ever seen, and its code base has very high quality.

So I think What if we can reuse all this good stuff (the elegant data structure / algrithom / design pattern in vscode) in our own project?

Maybe it is a good idea, so this project (package) is created for this purpose.    

The util code base from [vscode](https://github.com/microsoft/vscode):
* src/vs/base/common

unit test case:
* src/vs/base/test/common


# How to use it
You can install it through npm:
```bash
npm install --S util-kit
```

# Utilities Available For Usage
## Event Emitter

```ts
import { 
  Event, Emitter, EventBufferer, 
  EventMultiplexer, AsyncEmitter, IWaitUntil, 
  PauseableEmitter , IDisposable, DisposableStore, asyncs, 
} from 'util-kit';
```


There is NO event name concept in vscode. It assumpts that managing the event name is not a good idea. Event Name should be clearly defined in your system, can not be freely managed by the end user. 

```ts
import { Event, Emitter, IDisposable } from 'util-kit';

const someEmitter: Emitter<string> = new Emitter<string>();

function handler(value: string) { ... }

// register event handler
const subscription: IDisposable = someEmitter.event(handler);

// fire the event
someEmitter.fire('event value');

// remove and dispose the event handler
subscription.dispose();
```

In vscode's code style, it is preferred to split the event and fire apart. 
```ts
import { Event, Emitter, IDisposable } from 'util-kit';

const _onDidChange: Emitter<string> = new Emitter<string>();
const onDidChange: Event<string> = _onDidChange.event;

function handler(value: string) { ... }
// register event handler
const subscription: IDisposable = onDidChange(handler);

// fire the event
_onDidChange.fire('event value');

// remove and dispose the event handler
subscription.dispose();
```















