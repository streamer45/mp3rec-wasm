const recorder = new Recorder({
  workerURL: '/dist/recorder.worker.js',
});

recorder.init().then(() => {
  console.log('recorder initialized');
}).catch((err) => {
  console.log(err);
});

function start() {
  console.log('start');
  recorder.start().then(() => {
    console.log('recorder started');
  }).catch((err) => {
    console.log(err);
  });
}

function stop() {
  console.log('stop');
  recorder.stop().then(({blob, duration}) => {
    console.log(duration);
    const url = URL.createObjectURL(blob);
    document.getElementById('recording').innerHTML = `<audio controls="controls">
        <source src="${url}" type="audio/mpeg"></source>
       </audio>`;
  });
}
