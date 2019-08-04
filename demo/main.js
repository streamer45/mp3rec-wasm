const recorder = new Recorder({
  workerURL: '/dist/recorder.worker.js',
});

function init() {
  recorder.init({
    maxDuration: 10,
    bitRate: 64,
  }).then(() => {
    console.log('recorder initialized');
  }).catch((err) => {
    console.log(err);
  });
}

function deinit() {
  recorder.deinit().then(() => {
    console.log('recorder deinitialized');
  }).catch((err) => {
    console.log(err);
  });
}

function start() {
  console.log('start');
  recorder.on('maxduration', () => {
    console.log('reached max duration');
    stop();
  });
  recorder.start().then(() => {
    console.log('recorder started');
  }).catch((err) => {
    console.log(err);
  });
}

function stop() {
  console.log('stop');
  recorder.stop().then(({blob, duration}) => {
    console.log(blob);
    console.log(duration);
    const url = URL.createObjectURL(blob);
    document.getElementById('recording').innerHTML = `<audio controls="controls">
        <source src="${url}" type="audio/mpeg"></source>
       </audio>`;
  }).catch((err) => {
    console.log(err);
  });
}

function cancel() {
  console.log('cancel');
  recorder.cancel().then(() => {
    console.log('canceled');
  }).catch((err) => {
    console.log(err);
  });
}
