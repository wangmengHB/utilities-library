# gl-image
gl-image is a util library based on webgl for image filter functions.   
This project is inspired by [@evanw](https://github.com/evanw/glfx.js).

Here is the main difference between glfx.js and gl-image.js:
glfx.js just support one shader program at one time.
But in many use case, we need to do multiple filters to one image, and every operation can be redoable.
So gl-image do sth more to support multiple filters.

And it is realy simple for use.

# install
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
});
```
### filters supported 
| filter type name   | default value     | range       |
| :---------         | :-------          | :---------- |
| brightness         | 0                 | [-1, 1]     | 
| constrast          | 0                 | [-1, 1]     | 
| hue                | 0                 | [-1, 1]     | 
| saturation         | 0                 | [-1, 1]     | 
| sepia_amount       | 0                 | [0, 1]      | 
| vibrance_amount    | 0                 | [-1, 1]     | 
| vignette_amount    | 0                 | [0, 1]      | 
| vignette_size      | 0                 | [0, 1]      | 

note: default value means no filter effect.


# how to use

## use case 1. simple use
```ts
import GLImage from 'gl-image';

let glImage = new GLImage();

glImage.loadImageSrc(src).then(() => {

  // do single filter for image
  glImage.applyFilter('brightness', 0.3);
  glImage.applyFilter('hue', -0.3);

  // do batch filter for image
  glImage.applyFilters({
    'brightness': 0.3,
    'saturation': -0.7
  });

  // get the canvas element from glImage instance;
  // you can put it in the DOM for show
  const canvas = glImage.getCanvas();

  // or you can the base64 output data.
  const base64 = glImage.toDataUrl();

});
```
## use case 2: batch process images
```ts
import GLImage from 'gl-image';

const glImage = new GLImage();

const imageSrcList = ['xxx.png', 'yyy.png', ...];

async function processSingle(imageSrc) {
  await glImage.loadImageSrc(imageSrc);
  glImage.applyFilters({
    'brightness': 0.3,
    'saturation': -0.7
  });
  return glImage.toDataUrl();
}

async function batchProcess(imageSrcList) {
  const result = [];
  for (let i = 0; i < imageSrcList.length; i++) {
    const res = await processSingle(imageSrcList[i]);
    result.push(res);
  }
  return result;
}

batchProcess(imageSrcList).then((result) => {
  console.log(result);
})

```

