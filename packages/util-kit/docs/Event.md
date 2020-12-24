# Event Emitter

Unlike other event emitter lib, this Event Emitter has some special design pattern:     
1. There is NO event name concept in vscode. It assumpts that managing the event name is not a good idea. Event Name should be clearly defined in your system, instead of freely managed by the end user.   
```ts
import { Event, Emitter, IDisposable } from 'util-kit';

const emitter: Emitter<string> = new Emitter<string>();

function handler(value: string) { ... }

// register event handler
const subscription: IDisposable = emitter.event(handler);

// fire the event
emitter.fire('event value');

// remove and dispose the event handler
subscription.dispose();
```

In vscode's code style, it is preferred to split the event and the fire apart. 
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



2. This Event Emitter will not block other handlers' execuation if any of them throw exception. 




3. Event is delivered in order.It means if any fire happens in a listener, it will invoke another cycle, push it to current delivery queue, and flush it immediately. For example:  
```ts
const a = new Emitter<string>();
const values: string[] = [];

a.event(function listener1(val) {
    console.log('hanlder 1 ', val);
    if (val === 'e1') {
        // invoke another cycle and push it in delivery queue.
        a.fire('e2');
        console.log(values) // ['e1', 'e2']
    }
});

a.event(function listener2(val) {
    console.log('hanlder 2 ', val);
    values.push(val);
});

a.fire('e1');

// assert that all events are delivered in order
console.log(values); // ['e1', 'e2']
```
Notice: fire event in any listener should be aware of dead loop, condition statement is MUST.    












## Emitter constructor: (options: EmitterOptions)
```ts
export interface EmitterOptions {
	onFirstListenerAdd?: Function;
	onFirstListenerDidAdd?: Function;
	onListenerDidAdd?: Function;
	onLastListenerRemove?: Function;
	leakWarningThreshold?: number;
}
```

## emitter.event(handler, context, disposalStore)



## 









