import { objects } from 'util-kit';
import {defaultVertexSource, defaultFragmentSource} from './glsl/default';
import {
  GLSL_FS_brightnessContrast,
  GLSL_FS_hueSaturation,
  // GLSL_FS_sepia,
} from './glsl/adjust';

export interface UNIFORMS {
  [name: string]: UNIFORMITEM;
}

export interface UNIFORMITEM {
  value: number;
  range: [number, number];
} 


const MAP: any = Object.freeze({
  'default': {
    vshader: defaultVertexSource,
    fshader: defaultFragmentSource,
    uniforms: {},
  },
  'brightness_contrast': {
    vshader: defaultVertexSource,
    fshader: GLSL_FS_brightnessContrast,
    uniforms: {
      'brightness': {
        value: 0,
        range: [-1, 1],
      },
      'constrast': {
        value: 0,
        range: [-1, 1]
      },
    },
  },
  'hue_saturation': {
    vshader: defaultVertexSource,
    fshader: GLSL_FS_hueSaturation,
    uniforms: {
      'hue': {
        value: 0,
        range: [-1, 1],
      },
      'saturation': {
        value: 0,
        range: [-1, 1]
      },
    },
  }
});


export function createFilter(name: string) {
  if (!MAP[name]) {
    return null;
  }
  return objects.deepClone(MAP[name]);
}



