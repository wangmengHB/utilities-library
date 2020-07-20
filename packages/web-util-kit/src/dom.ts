import { Point2D } from './geom/Point2D';


export interface Offset {
  left: number;
  top: number;
}

/**
 * 获取该元素相对于 client 的全部累加 scroll 量
 * 用于和 getBoundingClientRect 进行计算
 * 这两个值相加就能得到清除所有滚动后，元素左上角的 client 坐标位置。
 * @param {HTMLElement} element Element to operate on
 * @return {Object} Object with left/top values
 */
export function getClientScrollOffset(element: HTMLElement): Offset {
  let left = 0,
      top = 0;
  while (element && element.parentNode) {
    element = element.parentNode as HTMLElement;
    left += element.scrollLeft || 0;
    top += element.scrollTop || 0;
    if (element.nodeType === 1 && element.style.position === 'fixed') {
      break;
    }
  }
  return { left: left, top: top };
}


/**
 * Returns offset for a given element
 * 去除掉所有的滚动因素以后，获取元素相对于 client 的绝对 offset
 * 计算过程是 使用 getBoundingClientRect，再加上 绝对 scroll 量， 再加上自身的 border 和 padding 因素
 * @function
 * @param {HTMLElement} element Element to get offset for
 * @return {Object} Object with "left" and "top" properties
 */
export function getElementOffset(element: HTMLElement): Offset {
  let docElem,
      doc = element && element.ownerDocument,
      box = { left: 0, top: 0 },
      offset: any = { left: 0, top: 0 },
      scrollLeftTop,
      offsetAttributes: any = {
        borderLeftWidth: 'left',
        borderTopWidth:  'top',
        paddingLeft:     'left',
        paddingTop:      'top'
      };

  if (!doc) {
    return offset;
  }

  for (let attr in offsetAttributes) {
    offset[offsetAttributes[attr]] += parseInt(getElementStyle(element, attr) as string, 10) || 0;
  }

  docElem = doc.documentElement;
  if ( typeof element.getBoundingClientRect !== 'undefined' ) {
    box = element.getBoundingClientRect();
  }

  scrollLeftTop = getClientScrollOffset(element);

  return {
    left: box.left + scrollLeftTop.left - (docElem.clientLeft || 0) + offset.left,
    top: box.top + scrollLeftTop.top - (docElem.clientTop || 0)  + offset.top
  };
}


/**
 * Returns style attribute value of a given element
 * @memberOf fabric.util
 * @param {HTMLElement} element Element to get style attribute for
 * @param {String} attr Style attribute to get for element
 * @return {String} Style attribute value of the given element.
 */
export function getElementStyle(element: HTMLElement, attr: string): string | undefined {
  let style: any = (window as any).document.defaultView.getComputedStyle(element, null);
  return style ? style[attr] : undefined;
}


export function setElementStyle(element: HTMLElement, styles: CSSStyleDeclaration | string) {
  if ( !(element instanceof HTMLElement) || !styles) {
    return;
  }
  if (typeof styles === 'string') {
    element.style.cssText += ';' + styles;
    return;
  }

  const elementStyle = element.style;
  for (let property in styles) {
    elementStyle[property] = styles[property];
  }

}


/**
 * Returns pointer coordinates relative to canvas.
 * 通过 mouse event 获取 mouse 对应再画布上像素的坐标点 
 * 
 * @param {MouseEvent} e
 * @param {HTMLCanvasElement} targetCanvas 目标画布
 * @return {Point} object with "x" and "y" number values
 */
export function getPointFromEvent(e: MouseEvent, targetCanvas: HTMLCanvasElement ): Point2D {  
  
  if (!targetCanvas || !(targetCanvas instanceof HTMLCanvasElement)) {
    throw new Error('target canvas is not found.')
  }
    
  let scroll = getClientScrollOffset(targetCanvas);
  let offset = getElementOffset(targetCanvas);
  // 也可以直接通过 getBoundingClientRect - e.clienX, 再减去 border 和 padding 因素

  let pointer = {
    x: e.clientX - offset.left + scroll.left,
    y: e.clientY - offset.top + scroll.top ,
  };

  let bounds = targetCanvas.getBoundingClientRect();
  let boundsWidth = bounds.width || 0;
  let boundsHeight = bounds.height || 0;
  let cssScale;

  if (!boundsWidth || !boundsHeight ) {
    if ('top' in bounds && 'bottom' in bounds) {
      boundsHeight = Math.abs( bounds.top - bounds.bottom );
    }
    if ('right' in bounds && 'left' in bounds) {
      boundsWidth = Math.abs( bounds.right - bounds.left );
    }
  }
  
  if (boundsWidth === 0 || boundsHeight === 0) {
    // If bounds are not available (i.e. not visible), do not apply scale.
    cssScale = { width: 1, height: 1 };
  } else {
    cssScale = {
      width: targetCanvas.width / boundsWidth,
      height: targetCanvas.height / boundsHeight
    };
  }

  return new Point2D(pointer.x * cssScale.width, pointer.y * cssScale.height);

}

