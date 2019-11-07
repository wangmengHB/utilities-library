import Shader from './shader';

let canvas: HTMLCanvasElement;

function getCanvas(texture: Texture) {
  if (!canvas) {
    canvas = document.createElement('canvas');
  } 
  canvas.width = texture.width;
  canvas.height = texture.height;
  let c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.clearRect(0, 0, canvas.width, canvas.height);
  return c;
}

export default class Texture {

  static fromElement(element: HTMLImageElement | HTMLVideoElement, gl: WebGLRenderingContext) {
    var texture = new Texture(gl, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE);
    texture.loadContentsOf(element);
    return texture;
  }

  gl: WebGLRenderingContext;
  id: WebGLTexture | null;
  width: number;
  height: number;
  format: number;   // gl.RGBA
  type: number;     // gl.UNSIGNED_BYTE

  constructor(gl: WebGLRenderingContext, width: number, height: number, format: number, type: number) {
    this.gl = gl;
    this.id = gl.createTexture() as WebGLTexture;
    this.width = width;
    this.height = height;
    this.format = format;
    this.type = type;

    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (width && height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, null);
    }
  }

  loadContentsOf(element: HTMLImageElement | HTMLVideoElement) {
    this.width = element.width || (element as HTMLVideoElement).videoWidth;
    this.height = element.height || (element as HTMLVideoElement).videoHeight;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.id);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.format, this.format, this.type, element);
  };

  initFromBytes(width: number, height: number, data: number[]) {
    this.width = width;
    this.height = height;
    this.format = this.gl.RGBA;
    this.type = this.gl.UNSIGNED_BYTE;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.id);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.type, new Uint8Array(data));
  }

  dispose() {
    this.gl.deleteTexture(this.id);
    this.id = null;
  }

  destroy() {
    this.gl.deleteTexture(this.id);
    this.id = null;
  };

  use(unit?: number) {
    this.gl.activeTexture(this.gl.TEXTURE0 + (unit || 0));
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.id);
  };

  unuse(unit: number) {
    this.gl.activeTexture(this.gl.TEXTURE0 + (unit || 0));
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  ensureFormat(width: number, height: number, format: number, type: number) {
    // allow passing an existing texture instead of individual arguments
    if (arguments.length == 1) {
        var texture = arguments[0];
        width = texture.width;
        height = texture.height;
        format = texture.format;
        type = texture.type;
    }

    // change the format only if required
    if (width != this.width || height != this.height || format != this.format || type != this.type) {
      this.width = width;
      this.height = height;
      this.format = format;
      this.type = type;
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.id);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, null);
    }
  };

  drawTo(callback: Function) {
    // start rendering to this texture
    (this.gl as any).framebuffer = (this.gl as any).framebuffer || this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, (this.gl as any).framebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.id, 0);
    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('incomplete framebuffer');
    }
    this.gl.viewport(0, 0, this.width, this.height);

    // do the drawing
    callback();

    // stop rendering to this texture
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  };


  fillUsingCanvas(callback: Function) {
    callback(getCanvas(this));
    this.format = this.gl.RGBA;
    this.type = this.gl.UNSIGNED_BYTE;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.id);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
    return this;
  }

  toImage(image: HTMLImageElement) {
    this.use();
    Shader.getDefaultShader(this.gl).drawRect();
    var size = this.width * this.height * 4;
    var pixels = new Uint8Array(size);
    var c = getCanvas(this);
    var data = c.createImageData(this.width, this.height);
    this.gl.readPixels(0, 0, this.width, this.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
    for (var i = 0; i < size; i++) {
        data.data[i] = pixels[i];
    }
    c.putImageData(data, 0, 0);
    image.src = canvas.toDataURL();
  }

  swapWith(other: Texture) {
    let temp;
    temp = other.gl; other.gl = this.gl; this.gl = temp;
    temp = other.id; other.id = this.id; this.id = temp;
    temp = other.width; other.width = this.width; this.width = temp;
    temp = other.height; other.height = this.height; this.height = temp;
    temp = other.format; other.format = this.format; this.format = temp;
  }



}