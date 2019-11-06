import { 
  initTexture, initVertex, initFilter, initShaders,
  initFramebufferObject, setUniforms
} from "./gl-utils"
import { createFilter } from './filter';

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


export default class GLImage {

  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private width: number = 0;
  private height: number = 0;
  private texture: WebGLTexture;
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
      // alpha: true,
      // premultipliedAlpha: false,
      // depth: false,
      // stencil: false,
      // antialias: false,
      preserveDrawingBuffer: true
    };

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

  }

  private setupFilters() {
    this.filters.push(createFilter('default'));
    this.filters.push(createFilter('brightness_contrast'));
    this.filters.push(createFilter('hue_saturation'));
  }
  
  filter(uniformName: string, value: number) {
    const target = this.filters.find((item: any) => {
      const { uniforms } = item;
      const keys = Object.keys(uniforms);
      if (keys.indexOf(uniformName) > -1) {
        return true;
      }
      return false;
    })
    if (!target) {
      return;
    }
    target.uniforms[uniformName].value = value;
    this.draw();
  }


  draw = () => {
    this.filters.forEach((item: any, index: number) => {
      this.gl.useProgram(item.program);
      setUniforms(this.gl, item.program, item.uniforms);
  
      this.drawScene(item.program as WebGLProgram, index);
    });
  }

  drawScene(program: WebGLProgram, index: number) {  
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