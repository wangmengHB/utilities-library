import { numbers } from 'util-kit';

const { clamp } = numbers;
 


export class Point2D{

  public readonly type = 'point';
  public x: number = 0;
  public y: number = 0;

  constructor();
  constructor(point: Point2D);
  constructor(plainPoint: {x: number; y: number});
  constructor(x: number, y: number);
  constructor(arg1?: any, arg2?: any){
    if (arg1 instanceof Point2D) {
      this.x = arg1.x;
      this.y = arg1.y;
    } else if ( arg1 && typeof arg1.x === 'number' && typeof arg1.y === 'number') {
      this.x = arg1.x;
      this.y = arg1.y;
    }else if ( typeof arg1 === 'number' && typeof arg2 === 'number') {
      this.x = arg1;
      this.y = arg2;
    }
  }
  
  /*
    point can only be changed by the following API:
    setXY / setX / setY / setFromPoint2D / swap  
  */

  /**
   * Sets x/y of this point
   * @param {Number} x
   * @param {Number} y
   * @chainable
   */
  setXY(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Sets x of this point
   * @param {Number} x
   * @chainable
   */
  setX(x: number) {
    this.x = x;
    return this;
  }

  /**
   * Sets y of this point
   * @param {Number} y
   * @chainable
   */
  setY(y: number) {
    this.y = y;
    return this;
  }

  /**
   * Sets x/y of this point from another point
   * @param {Point2D} other
   * @chainable
   */
  setFromPoint2D(other: Point2D) {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  /**
   * Swaps x/y of this point and another point
   * @param {Point2D} other
   */
  swap(other: Point2D) {
    var x = this.x,
        y = this.y;
    this.x = other.x;
    this.y = other.y;
    other.x = x;
    other.y = y;
  }


  /*
    Point2D Operations are immutable and return a new Point2D.
  */

  /**
   * Adds another point to this one and returns another one
   * @param {Point2D} other
   * @return {Point2D} new Point2D instance with added values
   */
  add(other: Point2D | number ): Point2D {
    if (typeof other === 'number' && !Number.isNaN(other) && Number.isFinite(other) ) {
      return new Point2D(this.x + other, this.y + other);
    }  
    if (other instanceof Point2D) {
      return new Point2D(this.x + other.x, this.y + other.y);
    }
    // ignore invalid params
    return this;
  }

  /**
   * Subtracts another point from this point and returns a new one
   * @param {Point2D | number} other
   * @return {Point2D} new Point2D object with subtracted values
   */
  sub(other: Point2D | number): Point2D {
    if (typeof other === 'number' && !Number.isNaN(other) && Number.isFinite(other) ) {
      return new Point2D(this.x - other, this.y - other);
    }
    if (other instanceof Point2D) {
      return new Point2D(this.x - other.x, this.y - other.y);
    }
    // ignore invalid params
    return this;
  }


  /*
  因为 二维向量的叉乘结果得到是 z 轴方向的向量，没办法用 2D point 表示。
  所以 mul / div 目前支持标量的乘除，
  计算点乘的结果： p1.x * p2.x + p1.y * p2.y;
  利用点乘结果计算两个向量的夹角： cos(angel) = 点乘结果 / （（p1 到 0 点距离）* (p2 到 0 点距离) ）
  */
  /**
   * Multiplies this point by a value and returns a new one
   * @param {Number | Point2D} scalar
   * @return {Point2D}
   */
  mul(scalar: number): Point2D {
    return new Point2D(this.x * scalar, this.y * scalar);
  }

  /**
   * Divides this point by a value and returns a new one
   * TODO: rename in scalarDivide in 2.0
   * @param {Number} scalar
   * @return {Point2D}
   */
  div(scalar: number): Point2D {
    return new Point2D(this.x / scalar, this.y / scalar);
  }

  /**
   * Returns distance from this point and another one
   * @param {Point2D} other
   * @return {Number}
   */
  distanceFrom(other: Point2D): number {
    var dx = this.x - other.x,
        dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  

  /**
   * Returns new point which is the result of linear interpolation with this one and another one
   * @param {Point2D} other
   * @param {Number} t , position of interpolation, between 0 and 1 default 0.5
   * @return {Point2D}
   */
  lerp(other: Point2D, t?: number) {
    if (typeof t === 'undefined') {
      t = 0.5;
    }
    t = clamp(t, 0, 1);
    return new Point2D(this.x + (other.x - this.x) * t, this.y + (other.y - this.y) * t);
  }

  

  /**
   * Returns the point between this point and another one
   * @param {Point2D} other
   * @return {Point2D}
   */
  midPoint2DFrom(other: Point2D) {
    return this.lerp(other);
  }

  /**
   * Returns a new point which is the min of this and another one
   * 即，两个点围成矩形的左上点
   * @param {Point2D} other
   * @return {Point2D}
   */
  min(other: Point2D) {
    return new Point2D(Math.min(this.x, other.x), Math.min(this.y, other.y));
  }

  /**
   * Returns a new point which is the max of this and another one
   * 即，两个点围成矩形的，右下点
   * @param {Point2D} other
   * @return {Point2D}
   */
  max(other: Point2D) {
    return new Point2D(Math.max(this.x, other.x), Math.max(this.y, other.y));
  }




  /**
   * Returns true if this point is equal to another one
   * @param {Point2D} other
   * @return {Boolean}
   */
  eq(other: Point2D) {
    return (this.x === other.x && this.y === other.y);
  }

  /**
   * Returns true if this point is less than another one
   * @param {Point2D} other
   * @return {Boolean}
   */
  lt(other: Point2D) {
    return (this.x < other.x && this.y < other.y);
  }

  /**
   * Returns true if this point is less than or equal to another one
   * @param {Point2D} other
   * @return {Boolean}
   */
  lte(other: Point2D) {
    return (this.x <= other.x && this.y <= other.y);
  }

  /**

    * Returns true if this point is greater another one
    * @param {Point2D} other
    * @return {Boolean}
    */
  gt(other: Point2D) {
    return (this.x > other.x && this.y > other.y);
  }

  /**
   * Returns true if this point is greater than or equal to another one
   * @param {Point2D} other
   * @return {Boolean}
   */
  gte(other: Point2D) {
    return (this.x >= other.x && this.y >= other.y);
  }


  /**
   * Returns string representation of this point
   * @return {String}
   */
  toString() {
    return this.x + ',' + this.y;
  }

  
  /**
   * return a cloned instance of the point
   * @return {Point2D}
   */
  clone() {
    return new Point2D(this.x, this.y);
  }
  
}

