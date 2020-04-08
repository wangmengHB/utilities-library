import { getScrollLeftTop, getElementOffset } from './dom';

/**
 * Returns pointer coordinates relative to canvas.
 * Can return coordinates with or without viewportTransform.
 * ignoreZoom false gives back coordinates that represent
 * the point clicked on canvas element.
 * ignoreZoom true gives back coordinates after being processed
 * by the viewportTransform ( sort of coordinates of what is displayed
 * on the canvas where you are clicking.
 * ignoreZoom true = HTMLElement coordinates relative to top,left
 * ignoreZoom false, default = fabric space coordinates, the same used for shape position
 * To interact with your shapes top and left you want to use ignoreZoom true
 * most of the time, while ignoreZoom false will give you coordinates
 * compatible with the object.oCoords system.
 * of the time.
 * @param {Event} e
 * @param {Boolean} ignoreZoom
 * @return {Object} object with "x" and "y" number values
 */
export function getCoordinates(e: MouseEvent, targetCanvas: HTMLCanvasElement ) {  
  
  if (!targetCanvas || !(targetCanvas instanceof HTMLCanvasElement)) {
    throw new Error('the event must be targeted on the canvas element.')
  }
    
  let scroll = getScrollLeftTop(targetCanvas);
  let offset = getElementOffset(targetCanvas);
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

  return {
    x: pointer.x * cssScale.width,
    y: pointer.y * cssScale.height
  };
}