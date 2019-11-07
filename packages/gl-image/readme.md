# gl-image
gl-image is a util library based on webgl for image filter functions.   
This project is inspired by (@evanw)[https://github.com/evanw/glfx.js].

Here is the main difference between glfx.js and gl-image.js:
glfx.js just support one shader program at one time.
But in many use case, we need to do multiple filters to one image, and every operation can be redoable.
So gl-image do sth more to support multiple filters.

And it is realy simple.

# install
```bash
npm install --S gl-image
```

# how to use
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


})

```


this document will be updated later!
