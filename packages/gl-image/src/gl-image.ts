import { 
  initTexture, initVertex, initFilter, initShaders,
  initFramebufferObject, setUniforms
} from "./gl-utils"
import { createFilter, SUPPORTED_FILTERS } from './filter';

function loadImage(imgSrc: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    let img: HTMLImageElement = new Image()
    img.onload = () => {
      resolve(img)
    }
    img.onerror = () => {
      reject(new Error('load error'))
    }
    img.src = imgSrc
  })
}

export interface FilterValues {
  [type: string]: number;
}


export default class GLImage {

  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private width: number = 0;
  private height: number = 0;
  private texture: WebGLTexture | null;
  private filters: any = [];

  private tempFramebuffers: any[] = [];
  private currentFramebufferIndex = 0;


  constructor() {
    this.canvas = document.createElement('canvas');  
  }

  getCanvas() {
    return this.canvas;
  }

  toDataUrl() {
    return this.canvas.toDataURL();
  }

  async loadImageSrc(src: string) {
    let img: HTMLImageElement = await loadImage(src);
    this.width = this.canvas.width = img.width;
    this.height = this.canvas.height = img.height;
    const glOptions = {
      alpha: true,
      premultipliedAlpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true
    };

    if (this.gl && this.texture) {
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      this.gl.deleteTexture(this.texture); 
      this.tempFramebuffers = [];
      this.currentFramebufferIndex = 0;
      this.texture = null;
    }

    try {
      this.gl = (
        this.canvas.getContext('webgl', glOptions) ||
        this.canvas.getContext('experimental-webgl', glOptions)
      ) as WebGLRenderingContext;
    } catch (e) {
        throw new Error('This browser does not support WebGL');
    }
    
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.texture = initTexture(this.gl, img) as WebGLTexture;
    this.setupFilters();
    initVertex(this.gl);
    this.filters.forEach((item: any) => {
      initShaders(this.gl, item);
      initFilter(this.gl, item.program);
    });
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
    const values = this.getAllFilterValues(SUPPORTED_FILTERS);
    const types = Object.keys(values || {});
    types.forEach((type: string) => {
      this.updateFilterUniformValue(type, values[type]);
    });
  }

  getAllFilterValues(filters?: any) {
    const res: any = {};
    const target = filters || this.filters;
    target.forEach((item: any) => {
      const uniforms = item.uniforms || {};
      const types = Object.keys(uniforms);
      types.forEach((type: string) => {
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

  draw(){
    this.gl.viewport(0, 0, this.width, this.height);
    this.filters.forEach((item: any, index: number) => {
      this.gl.useProgram(item.program);
      setUniforms(this.gl, item.program, item.uniforms);
      this.drawScene(item.program as WebGLProgram, index);
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
  }

  private drawScene(program: WebGLProgram, index: number) {  
    let source = null
    let target = null
    // 第一次渲染时使用图片纹理
    if (index === 0) {
      // 注意这里是在配置图像纹理中注释掉的步骤
      let u_Sampler = this.gl.getUniformLocation(program, 'texture');
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.uniform1i(u_Sampler, 0);
      source = this.texture;
    } else {
      // 后续渲染都使用上一次在缓冲中存储的纹理
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
    this.tempFramebuffers[index] = (
      this.tempFramebuffers[index] || 
      initFramebufferObject(this.gl, this.width, this.height)
    );
    return this.tempFramebuffers[index]
  }

}
