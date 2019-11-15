import { objects } from 'util-kit';
import {defaultVertexSource, defaultFragmentSource} from './glsl/default';
import {
  GLSL_FS_brightnessContrast,
  GLSL_FS_hueSaturation,
  GLSL_FS_sepia,
  GLSL_FS_vibrance,
  GLSL_FS_vignette,
  GLSL_FS_noise,
} from './glsl/adjust';

export interface UNIFORMS {
  [name: string]: UNIFORMITEM;
}

export interface UNIFORMITEM {
  value: number;
  range: [number, number];
} 


export const SUPPORTED_FILTERS: any = Object.freeze({
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
      'contrast': {
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
  },
  'sepia': {
    vshader: defaultVertexSource,
    fshader: GLSL_FS_sepia,
    uniforms: {
      'sepia_amount': {
        value: 0,
        range: [0, 1],
      }
    },
  },
  'vibrance': {
    vshader: defaultVertexSource,
    fshader: GLSL_FS_vibrance,
    uniforms: {
      'vibrance_amount': {
        value: 0,
        range: [-1, 1],
      },
    },
  },
  'vignette': {
    vshader: defaultVertexSource,
    fshader: GLSL_FS_vignette,
    uniforms: {
      'vignette_amount': {
        value: 0,
        range: [0, 1],
      },
      'vignette_size': {
        value: 0,
        range: [0, 1]
      },
    },
  },
  'noise': {
    vshader: defaultVertexSource,
    fshader: GLSL_FS_noise,
    uniforms: {
      'noise_amount': {
        value: 0,
        range: [0, 1],
      },
    },
  },

});


export function createFilter(name: string) {
  if (!SUPPORTED_FILTERS[name]) {
    return null;
  }
  return objects.deepClone(SUPPORTED_FILTERS[name]);
}



