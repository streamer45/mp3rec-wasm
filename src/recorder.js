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
    this.bitRate = 64;
    this.maxDuration = 300;
    this._onCancel = null;
    this._onData = null;
    this._onDeinit = null;
    this._onMaxDuration = null;
  }

  _loadConfig(config) {
    if (!config) return;

    if (config.maxDuration) {
      if (typeof config.maxDuration !== 'number') {
        throw new Error('config.maxDuration should be a number');
      }

      if (config.maxDuration < 0 || config.maxDuration > 3600) {
        throw new Error('config.maxDuration should be in [0, 3600]');
      }

      this.maxDuration = Math.round(config.maxDuration);
    }

    if (config.bitRate) {
      if (typeof config.bitRate !== 'number') {
        throw new Error('config.bitRate should be a number');
      }

      if (config.bitRate < 32 || config.bitRate > 320) {
        throw new Error('config.bitRate should be in [32, 320]');
      }

      this.bitRate = Math.round(config.bitRate);
    }
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

  _stopCapture() {
    this.muteNode.disconnect(this.audioCtx.destination);
    this.procNode.disconnect(this.muteNode);
    this.srcNode.disconnect(this.procNode);
    this.procNode.onaudioprocess = null;
    this.mediaStream.getTracks()[0].stop();
    this.mediaStream = null;
  }

  _audioProcess(ev) {
    if (!this.startTime) this.startTime = new Date().getTime();
    if (this.worker) {
      const samples = ev.inputBuffer.getChannelData(0);
      const duration = new Date().getTime() - this.startTime;
      if (duration >= (this.maxDuration * 1000)) {
        if (this._onMaxDuration) return this._onMaxDuration();
        this.stop();
        throw new Error('maxDuration reached and callback not defined');
      }
      this.worker.postMessage(samples, [samples.buffer]);
    }
  }

  init(config) {
    if (this.worker) return Promise.reject(new Error('Recorder already initialized'));
    try {
      this._loadConfig(config);
    } catch (err) {
      return Promise.reject(err);
    }
    return new Promise((res, rej) => {
      const worker = new Worker(this.workerURL);
      worker.onmessage = (ev) => {
        if (ev.data instanceof Uint8Array) {
          const blob = new Blob([ev.data], {type: 'audio/mpeg'});
          const duration = this.stopTime - this.startTime;
          this.stopTime = 0;
          this.startTime = 0;
          if (this._onData) this._onData(blob, duration);
        } else if (ev.data === 'cancel') {
          if (this._onCancel) this._onCancel();
        } else if (ev.data === 'init') {
          this.worker = worker;
          res();
        } else if (ev.data === 'deinit') {
          this.worker = null;
          if (this._onDeinit) this._onDeinit();
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
        return Promise.reject(new Error('Recorder is not initialized'));
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        return Promise.reject(new Error('AudioCtx unsupported'));
      }
      this.audioCtx = new AudioContext();
      this.worker.postMessage({
        sampleRate: this.audioCtx.sampleRate,
        bitRate: this.bitRate,
        channels: 1,
        numSamples: this.numSamples,
        maxDuration: this.maxDuration,
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
    return new Promise((res, rej) => {
      if (!this.audioCtx || !this.worker) return rej(new Error('Recorder not initialized'));
      if (!this.mediaStream) return rej(new Error('Recorder not started'));
      this._onData = (blob, duration) => res({blob, duration});
      this._stopCapture();
      this.stopTime = new Date().getTime();
      this.worker.postMessage('stop');
    });
  }

  cancel() {
    return new Promise((res, rej) => {
      if (!this.audioCtx || !this.worker) return rej(new Error('Recorder not initialized'));
      if (!this.mediaStream) return rej(new Error('Recorder not started'));
      this._stopCapture();
      this.startTime = 0;
      this.stopTime = 0;
      this._onCancel = () => res();
      this.worker.postMessage('cancel');
    });
  }

  deinit() {
    return new Promise((res, rej) => {
      if (this.audioCtx) {
        this.audioCtx.close();
        this.audioCtx = null;
      }
      if (!this.worker) return rej(new Error('Recorder not initialized'));
      if (this.worker) {
        this._onDeinit = () => {
          this.startTime = 0;
          this.stopTime = 0;
          this._onMaxDuration = null;
          res();
        };
        this.worker.postMessage('deinit');
      }
    });
  }

  on(type, cb) {
    if (type === 'maxduration') {
      this._onMaxDuration = cb;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Recorder;
}
