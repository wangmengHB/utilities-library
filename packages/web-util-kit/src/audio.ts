
// const MAX_CACHED_COUNT = 10;


export class AudioBufferLoader {

  cached: any = {};

  constructor(private context: AudioContext) { }

  async loadBuffer(url: string) {
    // Load buffer asynchronously
    if (this.cached[url]) {
      return this.cached[url];
    }

    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    


    return new Promise((resolve, reject) => {
      request.onload = () => {
        // Asynchronously decode the audio file data in request.response
        this.context.decodeAudioData(
          request.response,
          (buffer) => {
            if (!buffer) {
              reject(new Error('error decoding file data: ' + url));
              return;
            }
            // TODO use LRU cached
            this.cached[url] = buffer;
            resolve(buffer);

          },
          function(error) {
            reject(new Error('decodeAudioData error' + error));
          }
        );
      }

      request.onerror = function() {
        reject(new Error('BufferLoader: XHR error'));
      }

      request.send();
    });    
  }


}

