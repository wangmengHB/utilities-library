import GLImage from '../src';
const dat = require('dat.gui');

const glImage = new GLImage();

console.log(dat);


// test image
const TEST_IMAGE = './person.jpg';
const image = new Image();
image.src = TEST_IMAGE;


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
}



glImage.loadImageSrc(TEST_IMAGE).then(() => {
  const gui: any = new dat.GUI();

  ['brightness', 'contrast', 'hue', 'saturation', 'vibrance_amount'].forEach((key: string) => {

    gui.add(state, key, -1, 1, 0.01).onChange(async (val: any) => {
      glImage.applyFilters(state);
    });

  });

  ['sepia_amount', 'vignette_amount', 'vignette_size'].forEach((key: string) => {

    gui.add(state, key, 0, 1, 0.01).onChange(async (val: any) => {
      glImage.applyFilters(state);
    });
  })

});












