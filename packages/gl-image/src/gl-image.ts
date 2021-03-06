import { 
  createTexture, initVertex, initFilter, initShaders,
  initFramebufferObject, setUniforms
} from "./gl-utils"
import { createFilter, SUPPORTED_FILTERS } from './filter';
import { loadImage, loadFromImage } from 'web-util-kit';
import { GL_OPTIONS } from './const';



export interface FilterValues {
  [type: string]: number;
}


export default class GLImage {

  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null;
  
  private width: number = 0;
  private height: number = 0;
  private texture: WebGLTexture | null;
  private vertexBuffer: WebGLBuffer | null;
  private filters: any = [];

  private tempFramebuffers: any[] = [];
  private currentFramebufferIndex = 0;

  // because of preserveDrawingBuffer is false, so it is not convient for outside usage
  // this _resultCanvas is a 2D context canvas, it store the result for usage. 
  private _resultCanvas: HTMLCanvasElement;
  private _ctx2D: CanvasRenderingContext2D;


  constructor() {
    this._resultCanvas = document.createElement('canvas');
    this._ctx2D = this._resultCanvas.getContext('2d') as CanvasRenderingContext2D;
    this.canvas = document.createElement('canvas');
    try {
      this.gl = (
        this.canvas.getContext('webgl', GL_OPTIONS) ||
        this.canvas.getContext('experimental-webgl', GL_OPTIONS)
      ) as WebGLRenderingContext;
    } catch (e) {
      throw new Error('This browser does not support WebGL');
    }
    this.setupFilters();  
  }
  
  getCanvas() {
    return this._resultCanvas;
  }

  toDataURL(type: string | undefined, quality: any) {
    return this._resultCanvas.toDataURL(type, quality);
  }

  getImageData() {
    return this._ctx2D.getImageData(0, 0, this.width, this.height);
  }

  async loadImageSrc(src: string) {
    const img: HTMLImageElement = await loadImage(src);
    this.clear();
    this.initImage(img);   
    this.draw();
    return this;
  }

  async loadFromElement(target: HTMLImageElement | HTMLCanvasElement) {
    let img;
    if (target instanceof HTMLCanvasElement) {
      img = target;
    } else if (target instanceof HTMLImageElement) {
      img = await loadFromImage(target);
    }
    if (!img) {
      throw new Error('failed to load source, it must be an image or canvas.')
    }

    this.clear();
    this.initImage(img);   
    this.draw();
    return this;
  }


  applyFilter(type: string, value: number) {
    this.updateFilterUniformValue(type, value);
    this.draw();
  }

  applyFilters(values: FilterValues) {
    const types = Object.keys(values || {});
    types.forEach((type: string) => {
      this.updateFilterUniformValue(type, values[type]);
    });
    this.draw();
  }

  resetFilters() {
    const keys = Object.keys(SUPPORTED_FILTERS);
    const values = this.getAllFilterValues(keys.map(key => SUPPORTED_FILTERS[key]));
    const types = Object.keys(values || {});
    types.forEach((type: string) => {
      this.updateFilterUniformValue(type, values[type]);
    });
  }

  getAllFilterValues(filters?: any) {
    const res: any = {};
    const target = filters || this.filters || [];
    target.forEach((item: any) => {
      const uniforms = item.uniforms || {};
      const types = Object.keys(uniforms);
      types.forEach((type: string) => {
        if (['pixelate_step_w', 'pixelate_step_h'].indexOf(type) > -1) {
          return;
        }
        res[type] = uniforms[type].value;
      })
    })
    return res;
  }

  getFilterValueByName(type: string) {
    const all = this.getAllFilterValues();
    if (typeof all[type] === 'number') {
      return all[type]
    }
    return null;
  }

  draw() {
    if (!this.gl || !this.texture) {
      return;
    }
    this.gl.viewport(0, 0, this.width, this.height);
    this.filters.forEach((item: any, index: number) => {
      (this.gl as WebGLRenderingContext).useProgram(item.program);

      if (
        item.uniforms.pixelate_step_w && item.uniforms.pixelate_step_h &&
        this.width > 0 &&
        this.height > 0
      ) {
        item.uniforms.pixelate_step_w.value = 1 / this.width;
        item.uniforms.pixelate_step_h.value = 1 / this.height;
      }

      setUniforms(this.gl as WebGLRenderingContext, item.program, item.uniforms);
      this.drawScene(item.program as WebGLProgram, index);
    });
    // save the result in another canvas.
    this._ctx2D.drawImage(this.canvas, 0, 0);
  }

  private clear() {
    this.tempFramebuffers = [];
    this.currentFramebufferIndex = 0;
    if (!this.gl) {
      return;
    }

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    if (this.texture) {
      this.gl.deleteTexture(this.texture);   
      this.texture = null;
    }
    // clean programs in the filters
    this.filters.forEach((filter: any) => {
      if (filter.program) {
        this.gl!.deleteProgram(filter.program);
        filter.program = null;
      }
      if (filter.vertexShader) {
        this.gl!.deleteShader(filter.vertexShader);
        filter.vertexShader = null;
      }
      if (filter.fragmentShader) {
        this.gl!.deleteShader(filter.fragmentShader);
        filter.fragmentShader = null;
      }
    });
    this.gl.deleteBuffer(this.vertexBuffer);
    this.vertexBuffer = null;
    
  }


  private initImage(img: HTMLImageElement | HTMLCanvasElement) {
    this.width = this._resultCanvas.width = this.canvas.width = img.width;
    this.height = this._resultCanvas.height = this.canvas.height = img.height;

    if (!this.gl) {
      throw new Error('WebGL context does not exist!');
    }

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.texture = createTexture(this.gl, img) as WebGLTexture;
    this.vertexBuffer = initVertex(this.gl);
    this.filters.forEach((item: any) => {
      initShaders(this.gl as WebGLRenderingContext, item);
      initFilter(this.gl as WebGLRenderingContext, item.program);
    });
  }

  private updateFilterUniformValue(type: string, value: number) {
    const target = this.filters.find((item: any) => {
      const uniforms = item.uniforms || {};
      const keys = Object.keys(uniforms);
      if (keys.indexOf(type) > -1) {
        return true;
      }
      return false;
    })
    if (!target) {
      return;
    }
    target.uniforms[type].value = value;
  }

  private setupFilters() {
    this.filters = [];
    this.filters.push(createFilter('default'));
    this.filters.push(createFilter('brightness_contrast'));
    this.filters.push(createFilter('hue_saturation'));
    this.filters.push(createFilter('sepia'));
    this.filters.push(createFilter('vibrance'));
    this.filters.push(createFilter('vignette'));
    this.filters.push(createFilter('noise'));
    this.filters.push(createFilter('pixelate'));
  }

  private drawScene(program: WebGLProgram, index: number) {
    if (!this.gl) {
      return;
    }  
    let source = null
    let target = null
    // first render use origin image texture
    if (index === 0) {
      let u_Sampler = this.gl.getUniformLocation(program, 'texture');
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.uniform1i(u_Sampler, 0);
      source = this.texture;
    } else {
      // use last rendered texture in the last framebuffer
      source = this.getTempFramebuffer(this.currentFramebufferIndex).texture;
    }
    if (index === this.filters.length - 1) {
      target = null;
    } else {
      this.currentFramebufferIndex = (this.currentFramebufferIndex + 1) % 2;
      target = this.getTempFramebuffer(this.currentFramebufferIndex).fbo;
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, source);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private getTempFramebuffer(index: number) {
    if (!this.gl) {
      return;
    }
    this.tempFramebuffers[index] = (
      this.tempFramebuffers[index] || 
      initFramebufferObject(this.gl, this.width, this.height)
    );
    return this.tempFramebuffers[index]
  }

}
