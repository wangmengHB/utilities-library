import { numbers } from 'util-kit';
import { UNIFORMS, UNIFORMITEM } from './filter';

export function createTexture(gl: WebGLRenderingContext, image: HTMLImageElement | HTMLCanvasElement) {
  let texture = gl.createTexture();
  // Y flipped
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  return texture;
}

export function setUniforms(gl: WebGLRenderingContext, program: WebGLProgram, uniforms: UNIFORMS) {
  for (let name in uniforms) {
    if (!uniforms.hasOwnProperty(name)) {
      continue;
    } 
    let location = gl.getUniformLocation(program, name);
    if (location === null) {
      continue;
    }
    let value: any = (uniforms[name] as UNIFORMITEM).value;
    let range: any =  (uniforms[name] as UNIFORMITEM).range;
    
    if (Array.isArray(value)) {
      let next = value.slice();
      if (Array.isArray(range) && range.length === 2) {
        next = next.map(val => numbers.clamp(val, Math.min(range[0], range[1]), Math.max(range[0], range[1])))
      }
      switch (next.length) {
          case 1: gl.uniform1fv(location, new Float32Array(next)); break;
          case 2: gl.uniform2fv(location, new Float32Array(next)); break;
          case 3: gl.uniform3fv(location, new Float32Array(next)); break;
          case 4: gl.uniform4fv(location, new Float32Array(next)); break;
          case 9: gl.uniformMatrix3fv(location, false, new Float32Array(next)); break;
          case 16: gl.uniformMatrix4fv(location, false, new Float32Array(next)); break;
          default: throw 'dont\'t know how to load uniform "' + name + '" of length ' + next.length;
      }
    } else if (typeof value === 'number') {
      if (Array.isArray(range) && range.length === 2) {
        value = numbers.clamp(value, Math.min(range[0], range[1]), Math.max(range[0], range[1]));
      }
      gl.uniform1f(location, value);
    } else {
        throw new Error('attempted to set uniform "' + name + '" to invalid value ' + (value || 'undefined').toString());
    }
  }

}


export function initVertex(gl: WebGLRenderingContext) {
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER, 
    new Float32Array([ 0, 0, 0, 1, 1, 0, 1, 1 ]), 
    gl.STATIC_DRAW
  );
  return vertexBuffer;
}

export function initFilter(gl: WebGLRenderingContext, program: WebGLProgram) {

  let vertexAttribute = gl.getAttribLocation(program, 'vertex');
  gl.enableVertexAttribArray(vertexAttribute);
  gl.vertexAttribPointer(vertexAttribute, 2, gl.FLOAT, false, 0, 0);

  let texCoordAttribute = gl.getAttribLocation(program, '_texCoord');
  gl.enableVertexAttribArray(texCoordAttribute);
  gl.vertexAttribPointer(texCoordAttribute, 2, gl.FLOAT, false, 0, 0);

}

function loadShader(gl: WebGLRenderingContext, type: number, source: string) {
  let shader = gl.createShader(type);
  if (shader == null) {
    throw new Error('faided to create webgl shader!');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  let compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
      let error = gl.getShaderInfoLog(shader);
      console.log('Failed to compile shader: ' + error);
      gl.deleteShader(shader);
      return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vshader: string, fshader: string) {
  let vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshader);
  let fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
  if (!vertexShader || !fragmentShader) {
      return null;
  }
  let program = gl.createProgram();
  if (!program) {
      return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  let linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) {
      let error = gl.getProgramInfoLog(program);
      console.error('can NOT link gl program: ' + error);
      gl.deleteProgram(program);
      gl.deleteShader(fragmentShader);
      gl.deleteShader(vertexShader);
      return null;
  }
  return {
    program,
    vertexShader,
    fragmentShader,
  }
}

export function initShaders(gl: WebGLRenderingContext, shaderObj: any) {
  
  const result = createProgram(gl, shaderObj.vshader, shaderObj.fshader);
  if (!result) {
      console.log('can NOT create gl program');
      return false;
  }
  const { program, vertexShader, fragmentShader } = result;
  gl.useProgram(program);
  shaderObj.program = program;
  shaderObj.vertexShader = vertexShader;
  shaderObj.fragmentShader = fragmentShader;
  return true;
}


export function initFramebufferObject(gl: WebGLRenderingContext, width: number, height: number) {
  let fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return {
    fbo,
    texture
  };
}

/*
return an ImageData for other canvas2D drawing
 
*/
export function getImageData(gl: WebGLRenderingContext, width: number, height: number): ImageData {
 
 const pixels = new Uint8Array( width * height * 4);
 gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

 // FLIP Y Axis
 const halfHeight = Math.floor(height / 2);  // the | 0 keeps the result an int
 const bytesPerRow = width * 4;

 // make a temp buffer to hold one row
 const temp = new Uint8Array(width * 4);
 for (let y = 0; y < halfHeight; ++y) {
   let topOffset = y * bytesPerRow;
   let bottomOffset = (height - y - 1) * bytesPerRow;

   // make copy of a row on the top half
   temp.set(pixels.subarray(topOffset, topOffset + bytesPerRow));

   // copy a row from the bottom half to the top
   pixels.copyWithin(topOffset, bottomOffset, bottomOffset + bytesPerRow);

   // copy the copy of the top half row to the bottom half 
   pixels.set(temp, bottomOffset);
 }
 return new ImageData(new Uint8ClampedArray(pixels), width, height);
}