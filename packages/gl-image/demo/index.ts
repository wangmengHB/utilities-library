import GLImage from '../src';
const dat = require('dat.gui');

const glImage = new GLImage();

// test image
const TEST_IMAGE_URL = './person.jpg';
const image = new Image();
image.src = TEST_IMAGE_URL;


const sourceNode = document.getElementById('source');
const target = document.getElementById('target');

sourceNode!.appendChild(image);
target!.appendChild(glImage.getCanvas());


const state = {
  brightness: 0,
  contrast: 0,
  hue: 0,
  saturation: 0,
  sepia_amount: 0,
  vibrance_amount: 0,
  vignette_amount: 0,
  vignette_size: 0,
  noise_amount: 0,
  pixelate_block_size: 0,
};

glImage.applyFilters(state);

glImage.loadFromElement(image).then(() => {
  const gui: any = new dat.GUI();

  ['brightness', 'contrast', 'hue', 'saturation', 'vibrance_amount'].forEach((key: string) => {

    gui.add(state, key, -1, 1, 0.01).onChange(async (val: any) => {
      glImage.applyFilters(state);
    });

  });

  ['pixelate_block_size'].forEach((key: string) => {
    gui.add(state, key, 0, 20, 0.1).onChange(async (val: any) => {
      glImage.applyFilters(state);
    });
  });

  ['sepia_amount', 'vignette_amount', 'vignette_size', 'noise_amount'].forEach((key: string) => {

    gui.add(state, key, 0, 1, 0.01).onChange(async (val: any) => {
      glImage.applyFilters(state);

      // because glImage use preserveDrawingBuffer: false inside
      // test if the output is correct in another event loop.
      setTimeout(() => {
        // copy image to another canvas
        const resultCanvas = glImage.getCanvas();
        const canvas = document.createElement('canvas');
        canvas.height = resultCanvas.height;
        canvas.width = resultCanvas.width;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        ctx.drawImage(resultCanvas, 0, 0);
        document.body.appendChild(canvas);
      }, 0)
      

    });
  })

});














