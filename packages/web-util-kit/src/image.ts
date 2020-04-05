
export function loadImage(imgSrc: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img: HTMLImageElement = new Image();
    img.onload = () => {
      resolve(img)
    }
    img.onerror = () => {
      reject(new Error(`image load error! src: ${imgSrc}`))
    }
    img.src = imgSrc
  });
}

// check an image is loaded
// https://stereochro.me/ideas/detecting-broken-images-js
// https://stackoverflow.com/questions/1977871/check-if-an-image-is-loaded-no-errors-with-jquery
export function isImageLoaded(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0 ) {
    return true;
  }
  return false;
}

/**
 * Change base64 to blob
 * @param {String} data - base64 string data
 * @returns {Blob} Blob Data
 */
export function base64ImageToBlob(data: string) {
  const rImageType = /data:(image\/.+);base64,/;
  let mimeString = '';
  let raw, uInt8Array, i;
  if (!rImageType.test(data)) {
    throw new Error('the base64 string has no mine type, can not convert to blob!');
  }

  raw = data.replace(rImageType, (header: string, imageType: string) => {
    mimeString = imageType;
    return '';
  });

  raw = atob(raw);
  const rawLength = raw.length;
  uInt8Array = new Uint8Array(rawLength); // eslint-disable-line

  for (i = 0; i < rawLength; i += 1) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], {type: mimeString});
}


/**
 * Returns true if context has transparent pixel
 * at specified location (taking tolerance into account)
 * @param {CanvasRenderingContext2D} ctx context
 * @param {Number} x x coordinate
 * @param {Number} y y coordinate
 * @param {Number} tolerance Tolerance
 */
export function isTransparent(
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  tolerance: number = 1
) {
  // If tolerance is > 0 adjust start coords to take into account.
  // If moves off Canvas fix to 0
  if (tolerance > 0) {
    if (x > tolerance) {
      x -= tolerance;
    } else {
      x = 0;
    }
    if (y > tolerance) {
      y -= tolerance;
    } else {
      y = 0;
    }
  }

  x = Math.floor(x);
  y = Math.floor(y);
  tolerance = Math.floor( tolerance * 2) || 1;

  let _isTransparent = true, 
    i = 3, 
    temp = 0,
    imageData = ctx.getImageData(x, y, tolerance, tolerance),
    l = imageData.data.length;
  // Split image data - for tolerance > 1, pixelDataSize = 4;
  for (i = 3; i < l; i += 4) {
    temp = imageData.data[i];
    _isTransparent = temp <= 0;
    if (_isTransparent === false) {
      break;
    }
  }
  return _isTransparent;
}
