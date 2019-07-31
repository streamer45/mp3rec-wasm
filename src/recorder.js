class Recorder {
  constructor(config) {
    this.audioCtx = null;
    this.mediaStream = null;
    this.srcNode = null;
    this.procNode = null;
    this.muteNode = null;
    this.workerURL = (config && config.workerURL) ? config.workerURL : 'recorder.worker.js';
    this.worker = null;
    this.startTime = 0;
    this.stopTime = 0;
    this.numSamples = config.numSamples || 4096;
  }

  _startCapture() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
    }
    navigator.getUserMedia = (navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia);
    if (!navigator.getUserMedia) {
      return Promise.reject(new Error('unsupported'));
    }
    return new Promise((res, rej) => {
      navigator.getUserMedia({
        audio: true,
        video: false
      }, (stream) => {
        res(stream);
      }, (e) => {
        rej(e);
      });
    });
  }

  _audioProcess(ev) {
    if (!this.startTime) {
      this.startTime = new Date().getTime();
    }
    if (this.worker) {
      const samples = ev.inputBuffer.getChannelData(0);
      this.worker.postMessage(samples, [samples.buffer]);
    }
  }

  init() {
    if (this.worker) return Promise.reject(new Error('recorder already initialized'));
    return new Promise((res, rej) => {
      const worker = new Worker(this.workerURL);
      worker.onmessage = (ev) => {
        if (ev.data instanceof Uint8Array) {
          const blob = new Blob([ev.data], {type: 'audio/mpeg'});
          const duration = this.stopTime - this.startTime;
          this.stopTime = 0;
          this.startTime = 0;
          if (this._onData) this._onData(blob, duration);
        } else if (ev.data === 'init') {
          this.worker = worker;
          res();
        } else if (ev.data === 'destroy') {
          this.worker = null;
        }
      };
      worker.onerror = (err) => {
        console.log(err);
      };
    });
  }

  start() {
    if (!this.audioCtx) {
      if (!this.worker) {
        return Promise.reject(new Error('Worker is not initialized'));
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        return Promise.reject(new Error('AudioCtx unsupported'));
      }
      this.audioCtx = new AudioContext();
      this.worker.postMessage({
        sampleRate: this.audioCtx.sampleRate,
        bitRate: 64,
        channels: 1,
        numSamples: this.numSamples,
        maxDuration: 300, // 5 minutes
      });
    }
    return this._startCapture().then((stream) => {
      this.mediaStream = stream;
      this.srcNode = this.audioCtx.createMediaStreamSource(stream);
      this.procNode = this.audioCtx.createScriptProcessor(this.numSamples,
       this.srcNode.channelCount, 1);
      this.srcNode.connect(this.procNode);
      this.procNode.onaudioprocess = this._audioProcess.bind(this);
      this.muteNode = this.audioCtx.createGain();
      this.muteNode.gain.value = 0.0;
      this.procNode.connect(this.muteNode);
      this.muteNode.connect(this.audioCtx.destination);
    });
  }

  stop() {
    this.srcNode.disconnect(this.procNode);
    this.procNode.disconnect(this.muteNode);
    this.muteNode.disconnect(this.audioCtx.destination);
    this.mediaStream.getTracks()[0].stop();
    this.mediaStream = null;
    this.stopTime = new Date().getTime();
    this.worker.postMessage('stop');
  }

  destroy() {
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    if (this.worker) {
      this.worker.postMessage('destroy');
    }
  }

  on(event, cb) {
    if (event !== 'data') return;
    if (cb instanceof Function === false) return;
    this._onData = cb;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Recorder;
}
