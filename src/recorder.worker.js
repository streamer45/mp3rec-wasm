importScripts('encoder.js');

const MAX_NUM_SAMPLES = 16384;

const state = {
  encoder: null,
  samples_ptr: null,
  coded_ptr: null,
  samples: null,
  coded: null,
  data: null,
  data_len: 0,
  start: null,
  initialized: false,
};

Module.onRuntimeInitialized = () => {
  postMessage('init');
};

function init(config) {
  const bitRate = config.bitRate || 64;
  const sampleRate = config.sampleRate || 44100;
  const channels = config.channels || 1;
  const maxDuration = config.maxDuration || 5 * 60; // 5 minutes
  const numSamples = config.numSamples || MAX_NUM_SAMPLES;
  const data_sz = (bitRate / 8) * 1024 * maxDuration * 1.25; // enough space for maxDuration seconds recording

  state.data = new Uint8Array(data_sz);
  state.encoder = Module._encoder_create(sampleRate, channels, bitRate);
  state.samples_ptr = Module._malloc(config.numSamples * 4);
  state.samples = new Float32Array(Module.HEAPF32.buffer, state.samples_ptr);
  state.coded_ptr = Module._malloc(1.25 * config.numSamples + 7200);
  state.coded = new Uint8Array(Module.HEAPF32.buffer, state.coded_ptr);
  state.initialized = true;
}

function deinit() {
  Module._enc_destroy(state.encoder);
  Module._free(state.samples_ptr);
  Module._free(state.coded_ptr);
  state.data = null;
  state.data_len = 0;
  state.start = null;
  state.initialized = false;
}

onmessage = (ev) => {
  if (ev.data instanceof Float32Array) {
    if (!state.start) state.start = new Date().getTime();
    const nsamples = ev.data.length;
    state.samples.set(ev.data);
    const ret = Module._encoder_encode(state.encoder, state.samples_ptr,
     state.samples_ptr, nsamples, state.coded_ptr, state.coded.length);

    if (ret > 0) {
      state.data.set(new Uint8Array(Module.HEAP8.buffer, state.coded_ptr, ret),
       state.data_len);
      state.data_len += ret;
    }

    console.log(state.data_len);

  } else if (ev.data === 'start') {
    console.log(ev.data);
  } else if (ev.data === 'stop') {

    console.log((new Date().getTime() - state.start) / 1000);

    const ret = Module._encoder_flush(state.encoder, state.coded_ptr, state.coded.length);
    console.log('flushed ' + ret);

    if (ret > 0) {
      state.data.set(new Uint8Array(Module.HEAP8.buffer, state.coded_ptr, ret), state.data_len);
      state.data_len += ret;
    }

    const mp3 = state.data.subarray(0, state.data_len);

    const data_sz = state.data.length;

    postMessage(mp3, [mp3.buffer]);

    state.data = new Uint8Array(data_sz);
    state.data_len = 0;
    state.start = null;

    postMessage('stop');
  } else if (ev.data === 'destroy') {
    deinit();
    postMessage('destroy');
    self.close();
  } else if (ev.data instanceof Object) {
    if (!state.initialized) init(ev.data);
    else console.log('worker already initialized');
  }
};
