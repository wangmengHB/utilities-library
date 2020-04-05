
/**
 * Returns element scroll offsets
 * @param {HTMLElement} element Element to operate on
 * @return {Object} Object with left/top values
 */
export function getScrollLeftTop(element: HTMLElement) {
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
 * @function
 * @param {HTMLElement} element Element to get offset for
 * @return {Object} Object with "left" and "top" properties
 */
export function getElementOffset(element: HTMLElement) {
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
    offset[offsetAttributes[attr]] += parseInt(getElementStyle(element, attr), 10) || 0;
  }

  docElem = doc.documentElement;
  if ( typeof element.getBoundingClientRect !== 'undefined' ) {
    box = element.getBoundingClientRect();
  }

  scrollLeftTop = getScrollLeftTop(element);

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
export function getElementStyle(element: HTMLElement, attr: string) {
  let style: any = (window as any).document.defaultView.getComputedStyle(element, null);
  return style ? style[attr] : undefined;
}