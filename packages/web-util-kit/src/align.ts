

export function maxContentCenterImageInRect(
  imgWidth: number, imgHeight: number, 
  rectWidth: number, rectHeight: number
): { left: number, top: number, scaleX: number, scaleY: number} {
  let left = 0,  top = 0,  scaleX = 0, scaleY = 0;
  const rectRatio = rectWidth / rectHeight;
  const imgRatio = imgWidth / imgHeight;
  if (imgRatio <= rectRatio) {
    scaleX = scaleY = rectWidth / imgWidth;
    left = 0;
    top = (rectHeight - scaleY * imgHeight) / 2; 

  } else {
    scaleX = scaleY = rectHeight / imgHeight;
    top = 0;
    left = (rectWidth - scaleX * imgWidth) / 2; 
  }
  return {
    left, top, scaleX, scaleY
  };
}

export function maxContainCenterImageInRect(
  imgWidth: number, imgHeight: number, 
  rectWidth: number, rectHeight: number
): { left: number, top: number, scaleX: number, scaleY: number} {
  let left = 0,  top = 0,  scaleX = 0, scaleY = 0;
  const rectRatio = rectWidth / rectHeight;
  const imgRatio = imgWidth / imgHeight;

  if (imgRatio >= rectRatio) {
    scaleX = scaleY = rectWidth / imgWidth;
    left = 0;
    top = (rectHeight - scaleY * imgHeight) / 2; 
  } else {
    scaleX = scaleY = rectHeight / imgHeight;
    top = 0;
    left = (rectWidth - scaleX * imgWidth) / 2;
  }

  return {
    left, top, scaleX, scaleY
  };
}
