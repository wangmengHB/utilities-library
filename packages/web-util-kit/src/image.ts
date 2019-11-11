
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
