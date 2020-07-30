import { Point2D } from "./Point2D";

export type Matrix2X3Array = [ 
  number,   // m11
  number,   // m12
  number,   // m21
  number,   // m22
  number,   // dx
  number    // dy
];

export interface TRANSFORM_OPTIONS {
  angle: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  translateX: number;
  translateY: number;
  flipX: boolean;
  flipY: boolean;
}

const PI_BY_180 = Math.PI / 180;

export const radianToDegree = (radian: number) => radian / PI_BY_180;
export const degreeToRadian = (degree: number) => degree * PI_BY_180;

export function getIdentityMatrix2X3(): Matrix2X3Array {
  return [1, 0, 0, 1, 0, 0 ];
}

export function getIdentityTransformOptions(): TRANSFORM_OPTIONS {
  return {
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    skewY: 0,
    translateX: 0,
    translateY: 0,
    flipX: false,
    flipY: false
  };
}

export function getArrayFromDOMMatrix(a: DOMMatrix): Matrix2X3Array {
  return [a.a, a.b, a.c, a.d, a.e, a.f];
}


/**
 * Returns a transform matrix starting from an object of the same kind of
 * the one returned from qrDecompose, useful also if you want to calculate some
 * transformations from an object that is not enlived yet
 */
export function composeMatrix2X3(options: TRANSFORM_OPTIONS): Matrix2X3Array {
  let matrix: Matrix2X3Array = [1, 0, 0, 1, options.translateX || 0, options.translateY || 0];
  if (options.angle) {
    matrix = multiplyMatrix2X3(matrix, calcRotateMatrix2X3(options));
  }
  if (options.scaleX !== 1 || options.scaleY !== 1 ||
      options.skewX || options.skewY || options.flipX || options.flipY
  ) {
    matrix = multiplyMatrix2X3(matrix, calcDimensionsMatrix2X3(options));
  }
  return matrix;
}




/**
 * Decomposes standard 2x3 matrix into transform components
 * suppose skewY = 0, then decompse the matrix equation: 
 * a[0] === cos(angle) * scaleX
 * a[1] === sin(angle) * scaleX
 * a[0] * a[3] - a[2] * a[1] === scaleX * scaleY
 * a[0] * a[2] + a[1] * a[3] === (scaleX) ^ 2 * tan(skewX)
 * a[0] ^ 2 + a[1] ^ 2 === (scaleX) ^ 2
 * 
 * avoid divider is zero!
 */
export function decomposeMatrix2X3(a: Matrix2X3Array): TRANSFORM_OPTIONS {
  const angle = Math.atan2(a[1], a[0]);
  const denom = Math.pow(a[0], 2) + Math.pow(a[1], 2);
  if (denom === 0) {
    console.error(`can not decompose this matrix: [${a.toString()}]`);
  }
  // it is dangerous to calculate like this: 
  // const scaleX = a[1] / Math.sin(angle);
  // so change it to as below:
  const scaleX = Math.sign(a[1]) * Math.sign(Math.sin(angle)) * Math.sqrt(denom);
  const scaleY = (a[0] * a[3] - a[2] * a[1]) / scaleX;
  const skewX = Math.atan2(a[0] * a[2] + a[1] * a[3], denom);
  return {
    angle: radianToDegree(angle),
    scaleX: Math.abs(scaleX),
    scaleY: Math.abs(scaleY),
    skewX: radianToDegree(skewX),
    skewY: 0,
    flipX: scaleX > 0? false: true,
    flipY: scaleY > 0? false: true,
    translateX: a[4],
    translateY: a[5]
  };
}



/**
 * Multiply matrix A by matrix B to nest transformations
 * @param  {Array} a First transformMatrix
 * @param  {Array} b Second transformMatrix
 * @param  {Boolean} is2x2 flag to multiply matrices as 2x2 matrices
 * @return {Array} The product of the two transform matrices
 */
export function multiplyMatrix2X3(a: Matrix2X3Array, b: Matrix2X3Array ): Matrix2X3Array {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ];
}



/**
 * Apply transform t to point p
 * @param  {Point2D} p The point to transform
 * @param  {Array} t The transform
 * @param  {Boolean} [ignoreOffset] Indicates that the offset should not be applied
 * @return {Point2D} The transformed point
 */
export function transformPoint2D(
  p: Point2D, 
  t: Matrix2X3Array, 
  ignoreOffset: boolean = false
): Point2D {
  if (ignoreOffset) {
    return new Point2D(
      t[0] * p.x + t[2] * p.y,
      t[1] * p.x + t[3] * p.y
    );
  }
  return new Point2D(
    t[0] * p.x + t[2] * p.y + t[4],
    t[1] * p.x + t[3] * p.y + t[5]
  );
}



/**
 * Invert transformation t
 * 求逆变换矩阵：
 * 证明过程：
 * 1. 将原矩阵拆分为两个矩阵：变换矩阵 A * 平移矩阵 B
 * 因为平移矩阵的逆矩阵形式很简单 -dx, -dy, 最终的逆矩阵结果 B' * A'
 * 2. 求 A 的逆矩阵 A‘ （A * A‘） === E，(A' * A) === E
 * 3. 求出 A’ 矩阵变换后的平移点 
 * 4. 两个组合就是逆矩阵 
 * @param {Array} t The transform
 * @return {Array} The inverted transform
 */
export function invertMatrix2X3(t: Matrix2X3Array): Matrix2X3Array {
  // A 矩阵的秩
  if (t[0] * t[3] - t[1] * t[2] === 0) {
    console.error(`Can not invert this matrix because its rank is 0: [${t.toString()}]`);
  }
  const a = 1 / (t[0] * t[3] - t[1] * t[2]);
  // A 矩阵的逆矩阵 [a,b,c,d]' = (1/|A|) * [d,-c,-b,a]
  const r: Matrix2X3Array = [a * t[3], -a * t[1], -a * t[2], a * t[0], 0, 0];
  // 通过方程可以得到如下：
  r[4] = -a * (t[3] * t[4] - t[2] * t[5]);
  r[5] = -a * (-t[1] * t[4] + t[0] * t[5]);
  // 效果等效于：
  // const o: Point2D = transformPoint2D( new Point2D(t[4], t[5]), r, true);
  // r[4] = -o.x;
  // r[5] = -o.y;
  return r;
}



/**
 * Returns a transform matrix starting from an object of the same kind of
 * the one returned from qrDecompose, useful also if you want to calculate some
 * transformations from an object that is not enlived yet
 * @static
 * @memberOf fabric.util
 * @param  {Object} options
 * @param  {Number} [options.angle] angle in degrees
 * @return {Number[]} transform matrix
 */
export function calcRotateMatrix2X3(options: TRANSFORM_OPTIONS): Matrix2X3Array {
  if (!options.angle) {
    return getIdentityMatrix2X3();
  }
  const radian = degreeToRadian(options.angle);
  const cos = Math.cos(radian);
  const sin = Math.sin(radian);
  return [cos, sin, -sin, cos, 0, 0];
}



/**
 * Returns a transform matrix starting from an object of the same kind of
 * the one returned from qrDecompose, useful also if you want to calculate some
 * transformations from an object that is not enlived yet.
 * is called DimensionsTransformMatrix because those properties are the one that influence
 * the size of the resulting box of the object.
 * @param  {TRANSFORM_OPTIONS} options
 * @return {Matrix2X3Array} transform matrix
 */
export function calcDimensionsMatrix2X3(options: TRANSFORM_OPTIONS): Matrix2X3Array {
  const scaleX = typeof options.scaleX === 'undefined' ? 1 : options.scaleX;
  const scaleY = typeof options.scaleY === 'undefined' ? 1 : options.scaleY;
  let scaleMatrix: Matrix2X3Array = [
    options.flipX ? -scaleX : scaleX,
    0,
    0,
    options.flipY ? -scaleY : scaleY,
    0,
    0
  ];
      
  if (options.skewX) {
    const radianX = degreeToRadian(options.skewX);
    scaleMatrix = multiplyMatrix2X3(
      scaleMatrix,
      [1, 0, Math.tan(radianX), 1, 0, 0]
    );
  }
  if (options.skewY) {
    const radianY = degreeToRadian(options.skewY);
    scaleMatrix = multiplyMatrix2X3(
      scaleMatrix,
      [1, Math.tan(radianY), 0, 1, 0, 0],
    );
  }
  return scaleMatrix;
}


/**
 * Rotates `vector` with `angle` (radian unit)
 */
export function rotateVector2D(vector: Point2D, angle: number): Point2D {
  const radian = degreeToRadian(angle);
  let sin = Math.sin(radian),
      cos = Math.cos(radian),
      rx = vector.x * cos - vector.y * sin,
      ry = vector.x * sin + vector.y * cos;
  return new Point2D({
    x: rx,
    y: ry
  });
}


/**
 * Rotates `point` around `origin` with `angle` (radian unit)
 */
export function rotatePoint2D(point: Point2D, origin: Point2D, angle: number): Point2D {
  let vector = point.sub(origin);
  vector = rotateVector2D(vector, angle);
  return vector.add(origin);
}


/**
 * Returns coordinates of points's bounding rectangle (left, top, width, height)
 * @param {Array<Point2D>} points 4 points array, points will be changed
 * @param {Matrix2X3Array} [transform] an array of 6 numbers representing a 2x3 transform matrix
 * @return {Object} Object with left, top, width, height properties
 */
export function makeBoundingBoxFromPoints(points: Array<Point2D>, transform: Matrix2X3Array) {
  if (transform) {
    for (var i = 0; i < points.length; i++) {
      points[i] = transformPoint2D(points[i], transform);
    }
  }

  const xs = points.map((p: Point2D) => p.x);
  const ys = points.map((p: Point2D) => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const width = maxX - minX;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const height = maxY - minY;

  return {
    left: minX,
    top: minY,
    width: width,
    height: height
  };
}


/**
 * given a width and height, return the size of the bounding box
 * that can contains the box with width/height with applied transform
 * described in options.
 * Use to calculate the boxes around objects for controls.
 * @memberOf fabric.util
 * @param {Number} width
 * @param {Number} height
 * @param {TRANSFORM_OPTIONS} options
 * @return {Object.width} width of containing
 * @return {Object.height} height of containing
 */
export function sizeAfterTransform(width: number, height: number, options: TRANSFORM_OPTIONS) {
  const dimX = width / 2, dimY = height / 2;
  const points = [
    {
      x: -dimX,
      y: -dimY
    },
    {
      x: dimX,
      y: -dimY
    },
    {
      x: -dimX,
      y: dimY
    },
    {
      x: dimX,
      y: dimY
    }
  ].map((p: any) => new Point2D(p));
  const transformMatrix = calcDimensionsMatrix2X3(options);
  const bbox = makeBoundingBoxFromPoints(points, transformMatrix);
  return {
    width: bbox.width,
    height: bbox.height,
  };
}


