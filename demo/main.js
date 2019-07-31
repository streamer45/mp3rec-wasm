const recorder = new Recorder({
  workerURL: '/dist/recorder.worker.js',
});

function start() {
  console.log('start');
  recorder.start().then(() => {
    console.log('recorder started');
  });
  recorder.on('data', (data) => {
    const url = URL.createObjectURL(data);
    document.getElementById('recording').innerHTML = `<audio controls="controls">
        <source src="${url}" type="audio/mpeg"></source>
       </audio>`;
  });
}

function stop() {
  console.log('stop');
  recorder.stop();
}
