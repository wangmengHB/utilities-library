import Texture from './texture';
import Shader from './shader';



export default class GLImage {

  gl: WebGLRenderingContext;
  _isInitialized = false;
  _texture: Texture | null = null;
  _spareTexture: Texture | null = null;
  _extraTexture: Texture | null = null;
  _flippedShader: Shader | null = null;
  canvas: HTMLCanvasElement;

  constructor() {
    this.canvas = document.createElement('canvas');
    const glOptions = {
      alpha: true,
      premultipliedAlpha: false,
      depth: false,
      stencil: false,
      antialias: false
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
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

  }

  getCanvas() {
    return this.canvas;
  }

  texture(element: HTMLImageElement | HTMLVideoElement) {
    return Texture.fromElement(element, this.gl);
  }

  initialize(width: number, height: number) {
    let type = this.gl.UNSIGNED_BYTE;

    // Go for floating point buffer textures if we can, it'll make the bokeh
    // filter look a lot better. Note that on Windows, ANGLE does not let you
    // render to a floating-point texture when linear filtering is enabled.
    // See http://crbug.com/172278 for more information.
    if (this.gl.getExtension('OES_texture_float') && this.gl.getExtension('OES_texture_float_linear')) {
        var testTexture = new Texture(this.gl, 100, 100, this.gl.RGBA, this.gl.FLOAT);
        try {
            // Only use gl.FLOAT if we can render to it
            testTexture.drawTo(() => { type = this.gl.FLOAT; });
        } catch (e) {
        }
        testTexture.destroy();
    }

    if (this._texture) {
      this._texture.destroy();
    } 
    if (this._spareTexture) {
      this._spareTexture.destroy();
    } 
    this.canvas.width = width;
    this.canvas.height = height;
    this._texture = new Texture(this.gl, width, height, this.gl.RGBA, type);
    this._spareTexture = new Texture(this.gl, width, height, this.gl.RGBA, type);
    this._extraTexture = this._extraTexture || new Texture(this.gl, 0, 0, this.gl.RGBA, type);
    this._flippedShader = this._flippedShader || new Shader(this.gl, undefined, '\
        uniform sampler2D texture;\
        varying vec2 texCoord;\
        void main() {\
            gl_FragColor = texture2D(texture, vec2(texCoord.x, 1.0 - texCoord.y));\
        }\
    ');
    this._isInitialized = true;
}



  /*
   Draw a texture to the canvas, with an optional width and height to scale to.
   If no width and height are given then the original texture width and height
   are used.
  */
  draw(texture: Texture, width: number, height: number) {
    if (!this._isInitialized || texture.width != this.canvas.width || texture.height != this.canvas.height) {
      this.initialize(width ? width : texture.width, height ? height : texture.height);
    }

    texture.use();
    this._texture!.drawTo(() => {
        Shader.getDefaultShader(this.gl).drawRect();
    });

    return this;
  }

  update() {
    if (!this._isInitialized) {
      return;
    }
    this._texture!.use();
    this._flippedShader!.drawRect();
    return this;
  }

  contents() {
    if (!this._isInitialized) {
      return;
    }
    var texture = new Texture(this.gl, this._texture!.width, this._texture!.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE);
    this._texture!.use();
    texture.drawTo(() => {
        Shader.getDefaultShader(this.gl).drawRect();
    });
    return texture;
  }

  getPixelArray() {
    if (!this._isInitialized) {
      return;
    }
    var w = this._texture!.width;
    var h = this._texture!.height;
    var array = new Uint8Array(w * h * 4);
    this._texture!.drawTo(() => {
        this.gl.readPixels(0, 0, w, h, this.gl.RGBA, this.gl.UNSIGNED_BYTE, array);
    });
    return array;
  }

  


}