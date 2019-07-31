importScripts('encoder.js');

let enc;

let samples_ptr;
let samples;

let coded_ptr;
let coded;

let data;
let data_len = 0;

let start;

let initialized = false;

const MAX_NUM_SAMPLES = 16384;

Module.onRuntimeInitialized = () => {
  postMessage('init');
};

function init(config) {
  const bitRate = config.bitRate || 64;
  const sampleRate = config.sampleRate || 44100;
  const channels = config.channels || 1;
  const maxDuration = config.maxDuration || 5 * 60; // 5 minutes

  const data_sz = (bitRate / 8) * 1024 * maxDuration * 1.25; // enough space for maxDuration seconds recording

  console.log(data_sz);

  data = new Uint8Array(data_sz);

  enc = Module._encoder_create(sampleRate, channels, bitRate);
  console.log('enc ' + enc);

  samples_ptr = Module._malloc(MAX_NUM_SAMPLES * 4);
  samples = new Float32Array(Module.HEAPF32.buffer, samples_ptr);
  coded_ptr = Module._malloc(1.25 * MAX_NUM_SAMPLES + 7200);
  coded = new Uint8Array(Module.HEAPF32.buffer, coded_ptr);

  initialized = true;
}

function deinit() {
  Module._enc_destroy(enc);
  Module._free(samples_ptr);
  Module._free(coded_ptr);
}

onmessage = (ev) => {
  if (ev.data instanceof Float32Array) {
    if (!start) start = new Date().getTime();
    const nsamples = ev.data.length;
    samples.set(ev.data);
    const ret = Module._encoder_encode(enc, samples_ptr, samples_ptr, nsamples, coded_ptr, coded.length);

    if (ret > 0) {
      data.set(new Uint8Array(Module.HEAP8.buffer, coded_ptr, ret), data_len);
      data_len += ret;
    }

    console.log(data_len);

  } else if (ev.data === 'start') {
    console.log(ev.data);
  } else if (ev.data === 'stop') {

    console.log((new Date().getTime() - start) / 1000);

    const ret = Module._encoder_flush(enc, coded_ptr, coded.length);
    console.log('flushed ' + ret);

    if (ret > 0) {
      data.set(new Uint8Array(Module.HEAP8.buffer, coded_ptr, ret), data_len);
      data_len += ret;
    }

    const mp3 = data.subarray(0, data_len);

    const data_sz = data.length;

    postMessage(mp3, [mp3.buffer]);

    data = new Uint8Array(data_sz);
    data_len = 0;
    start = null;

    postMessage('stop');
  } else if (ev.data === 'destroy') {
    deinit();
    postMessage('destroy');
    self.close();
  } else if (ev.data instanceof Object) {
    if (!initialized) init(ev.data);
    else console.log('worker already initialized');
  }
};
