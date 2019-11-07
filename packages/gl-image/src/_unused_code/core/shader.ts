
const defaultVertexSource = `
attribute vec2 vertex;
attribute vec2 _texCoord;
varying vec2 texCoord;
void main() {
    texCoord = _texCoord;
    gl_Position = vec4(vertex * 2.0 - 1.0, 0.0, 1.0);
}`;

const defaultFragmentSource = `
uniform sampler2D texture;
varying vec2 texCoord;
void main() {
    gl_FragColor = texture2D(texture, texCoord);
}`;

function compileSource(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error(`failed to this.gl.createShader(${type})`);
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw 'compile error: ' + gl.getShaderInfoLog(shader);
  }
  return shader;
}


export default class Shader {

  static getDefaultShader(gl: WebGLRenderingContext) {
    if (!(gl instanceof WebGL2RenderingContext)) {
      throw new Error('gl is not a webgl context!');
    }
    (gl as any).defaultShader = 
      (gl as any).defaultShader || 
      new Shader(gl);
    return (gl as any).defaultShader;
  }

  private gl: WebGLRenderingContext | null;
  vertexAttribute: any;
  texCoordAttribute: any;
  program: WebGLProgram | null;

  constructor(gl: WebGLRenderingContext, vertexSource?: string, fragmentSource?: string) {
    this.gl = gl;
    this.vertexAttribute = null;
    this.texCoordAttribute = null;
    this.program = this.gl.createProgram() as WebGLProgram;
    if (!this.program) {
      throw new Error('failed to this.gl.createProgram()');
    }
    vertexSource = vertexSource || defaultVertexSource;
    fragmentSource = fragmentSource || defaultFragmentSource;
    fragmentSource = 'precision highp float;' + fragmentSource; // annoying requirement is annoying
    this.gl.attachShader(this.program, compileSource(gl, this.gl.VERTEX_SHADER, vertexSource));
    this.gl.attachShader(this.program, compileSource(gl, this.gl.FRAGMENT_SHADER, fragmentSource));
    this.gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
        throw 'link error: ' + this.gl.getProgramInfoLog(this.program);
    }
  }

  dispose() {
    if (this.gl) {
      this.gl.deleteProgram(this.program);
    }
    this.gl = null;
    this.program = null;
  }

  destroy() {
    if (this.gl) {
      this.gl.deleteProgram(this.program);
    }
    this.gl = null;
    this.program = null;
  }

  uniforms (uniforms: any) {
    if (!this.gl || !this.program) {
      console.error('shader maybe disposed, gl and program not exist!');
      return this;
    }
    this.gl.useProgram(this.program);
    for (var name in uniforms) {
        if (!uniforms.hasOwnProperty(name)) continue;
        var location = this.gl.getUniformLocation(this.program, name);
        if (location === null) continue; // will be null if the uniform isn't used in the shader
        var value = uniforms[name];
        if (Array.isArray(value)) {
            switch (value.length) {
                case 1: this.gl.uniform1fv(location, new Float32Array(value)); break;
                case 2: this.gl.uniform2fv(location, new Float32Array(value)); break;
                case 3: this.gl.uniform3fv(location, new Float32Array(value)); break;
                case 4: this.gl.uniform4fv(location, new Float32Array(value)); break;
                case 9: this.gl.uniformMatrix3fv(location, false, new Float32Array(value)); break;
                case 16: this.gl.uniformMatrix4fv(location, false, new Float32Array(value)); break;
                default: throw 'dont\'t know how to load uniform "' + name + '" of length ' + value.length;
            }
        } else if (typeof value === 'number') {
            this.gl.uniform1f(location, value);
        } else {
            throw 'attempted to set uniform "' + name + '" to invalid value ' + (value || 'undefined').toString();
        }
    }
    // allow chaining
    return this;
  };

  // textures are uniforms too but for some reason can't be specified by this.gl.uniform1f,
  // even though floating point numbers represent the integers 0 through 7 exactly
  textures(textures: any) {
    if (!this.gl || !this.program) {
      console.error('shader maybe disposed, gl and program not exist!');
      return this;
    }
    this.gl.useProgram(this.program);
    for (let name in textures) {
        if (!textures.hasOwnProperty(name)) continue;
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, name), textures[name]);
    }
    // allow chaining
    return this;
  };

  drawRect(left?: number, top?: number, right?: number, bottom?: number) {
    if (!this.gl || !this.program) {
      console.error('shader maybe disposed, gl and program not exist!');
      return;
    }
    var undefined;
    var viewport = this.gl.getParameter(this.gl.VIEWPORT);
    top = top !== undefined ? (top - viewport[1]) / viewport[3] : 0;
    left = left !== undefined ? (left - viewport[0]) / viewport[2] : 0;
    right = right !== undefined ? (right - viewport[0]) / viewport[2] : 1;
    bottom = bottom !== undefined ? (bottom - viewport[1]) / viewport[3] : 1;
    if ((this.gl as any).vertexBuffer == null) {
        (this.gl as any).vertexBuffer = this.gl.createBuffer();
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, (this.gl as any).vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([ left, top, left, bottom, right, top, right, bottom ]), this.gl.STATIC_DRAW);
    if ((this.gl as any).texCoordBuffer == null) {
        (this.gl as any).texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, (this.gl as any).texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([ 0, 0, 0, 1, 1, 0, 1, 1 ]), this.gl.STATIC_DRAW);
    }
    if (this.vertexAttribute == null) {
        this.vertexAttribute = this.gl.getAttribLocation(this.program, 'vertex');
        this.gl.enableVertexAttribArray(this.vertexAttribute);
    }
    if (this.texCoordAttribute == null) {
        this.texCoordAttribute = this.gl.getAttribLocation(this.program, '_texCoord');
        this.gl.enableVertexAttribArray(this.texCoordAttribute);
    }
    this.gl.useProgram(this.program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, (this.gl as any).vertexBuffer);
    this.gl.vertexAttribPointer(this.vertexAttribute, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, (this.gl as any).texCoordBuffer);
    this.gl.vertexAttribPointer(this.texCoordAttribute, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  };

}