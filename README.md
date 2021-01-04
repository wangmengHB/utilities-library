# utilities-library

This repo is a collection of multiple utilities npm packages managed by lerna, and each of them is published independently. It mainly focus on the common used utilities, data structures and algorithms.   

Unlike other language like C++, c#, etc, there is no powerful standard fundenmental libraries for javascript. So we have to develop a lot of utilities in our serveral applications. They are repeated and duplicated, imposible for management and reusagement. 

So this repo is to collect, manage and publish common utilities / data structures / algorithms together, in order to speed up our application development in the future.    



# packages

## [util-kit](https://github.com/wangmengHB/utilities-library/tree/master/packages/util-kit/readme.md)
`util-kit` is mainly from vscode's code base snippet, and it is an util npm both for browser and nodejs. What it has done have for vscode:     
1. re-organize the exports of vscode code base snippet for easily usage as a common utility npm.    
2. add documents and specifications for available utitilies.           

As a fan for vscode, I think vscode is the most awesome open source front-end project I've ever seen, and its code base has realy high quality. So I think What if we can reuse all this good stuff (the elegant `data structure / algrithom / design pattern` in vscode) in our own project? Maybe it is a good idea. So I do it for my personal usage, I hope it can also help you. 

```bash
npm install --S util-kit
```
```ts
import { 
	Emitter, PauseableEmitter, AsyncEmitter,
	EventBufferer, EventMultiplexer, 
	Event, 
	CancellationToken, asyncs,
	IWaitUntil,
} from 'util-kit';
```

For details, please see the [util-kit document](https://github.com/wangmengHB/utilities-library/tree/master/packages/util-kit/readme.md).





## [gl-image](https://github.com/wangmengHB/utilities-library/tree/master/packages/gl-image/readme.md)
`gl-image` is a util library based on webgl for image filter functions. It can just need 2-4 lines of codes to do the filter operation for image without knowing the existence of webgl. And it is run really fast. 

![demo1](https://raw.githubusercontent.com/wangmengHB/gl-image/master/demo/demo.jpg)

```bash
npm install --S gl-image
```
```ts
import GLImage from 'gl-image';

const glImage = new GLImage();
glImage.loadImageSrc(src).then(() => {
    // do filter for image
    glImage.applyFilter('brightness', 0.3);
    glImage.applyFilter('hue', -0.3);

    // output canvas
    glImage.getCanvas()

});
```
For details, see [the document of gl-image](https://github.com/wangmengHB/utilities-library/tree/master/packages/gl-image/readme.md).





## [web-util-kit](https://github.com/wangmengHB/utilities-library/tree/master/packages/web-util-kit/readme.md)
## [node-util-kit](https://github.com/wangmengHB/utilities-library/tree/master/packages/node-util-kit/readme.md)











