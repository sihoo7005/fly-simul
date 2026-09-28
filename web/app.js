let experiment;
let selected = 'bright';
let cellIndex = 0;
let frame = 0;
let timer;

const stimulusCanvas = document.querySelector('#stimulus');
const traceCanvas = document.querySelector('#trace');
const seek = document.querySelector('#seek');
const play = document.querySelector('#play');

function sample() { return experiment.stimuli[selected]; }

function canvasContext(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

function drawStimulus() {
  const { ctx, width, height } = canvasContext(stimulusCanvas);
  const values = sample().frames[frame];
  const scale = Math.min(width / 36, height / 30);
  experiment.coordinates.forEach(([u, v], index) => {
    const brightness = Math.max(0, Math.min(255, Math.round(values[index] * 255)));
    ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
    ctx.beginPath();
    ctx.arc(width / 2 + (u + v / 2) * scale, height / 2 - v * Math.sqrt(3) / 2 * scale,
      Math.max(1, scale * .53), 0, 2 * Math.PI);
    ctx.fill();
  });
}

function drawTrace() {
  const { ctx, width, height } = canvasContext(traceCanvas);
  const values = sample().voltage_change.map(row => row[cellIndex]);
  const max = Math.max(.001, ...values.map(Math.abs));
  const pad = 30, usable = width - 2 * pad, middle = height / 2;
  ctx.strokeStyle = '#536876';
  ctx.beginPath(); ctx.moveTo(pad, middle); ctx.lineTo(width - pad, middle); ctx.stroke();
  ctx.strokeStyle = '#88dcd4'; ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = pad + index * usable / Math.max(1, values.length - 1);
    const y = middle - value / max * (height / 2 - pad);
    index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  const markerX = pad + frame * usable / Math.max(1, values.length - 1);
  ctx.strokeStyle = '#f2ae87'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(markerX, 12); ctx.lineTo(markerX, height - 20); ctx.stroke();
  ctx.fillStyle = '#adc3d0'; ctx.font = '13px system-ui';
  ctx.fillText(`+${max.toFixed(2)}`, 2, 20);
  ctx.fillText('0', 8, middle - 5);
  ctx.fillText(`−${max.toFixed(2)}`, 2, height - 14);
}

function drawCells() {
  const container = document.querySelector('#cells');
  const scroll = container.scrollTop;
  const values = sample().voltage_change[frame];
  const maximum = Math.max(.001, ...values.map(Math.abs));
  const order = values.map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value);
  const items = document.createDocumentFragment();
  order.forEach(({ value, index }) => {
    const row = document.createElement('button');
    row.className = 'row';
    row.type = 'button';
    row.setAttribute('aria-current', String(index === cellIndex));
    const name = document.createElement('strong');
    name.textContent = experiment.cell_types[index];
    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.style.width = `${100 * Math.abs(value) / maximum}%`;
    if (value < 0) fill.className = 'negative';
    bar.append(fill);
    const number = document.createElement('span');
    number.className = 'value';
    number.textContent = `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
    row.append(name, bar, number);
    row.addEventListener('click', () => {
      cellIndex = index;
      document.querySelector('#selected-cell').textContent = experiment.cell_types[cellIndex];
      drawCells(); drawTrace();
    });
    items.append(row);
  });
  container.replaceChildren(items);
  container.scrollTop = scroll;
}

function draw() {
  if (!experiment) return;
  seek.value = frame;
  document.querySelector('#time').textContent = `${(frame * sample().dt).toFixed(2)}초`;
  drawStimulus(); drawTrace(); drawCells();
}

function stop() {
  clearInterval(timer); timer = undefined;
  play.textContent = '▶ 재생';
}

function select(key) {
  stop(); selected = key;
  frame = Math.min(sample().frames.length - 1, Math.round(sample().baseline_s / sample().dt));
  seek.max = sample().frames.length - 1;
  document.querySelectorAll('[data-stimulus]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.stimulus === key)));
  draw();
}

document.querySelectorAll('[data-stimulus]').forEach(button =>
  button.addEventListener('click', () => select(button.dataset.stimulus)));
seek.addEventListener('input', () => { stop(); frame = Number(seek.value); draw(); });
play.addEventListener('click', () => {
  if (timer) { stop(); return; }
  if (frame >= sample().frames.length - 1) frame = 0;
  play.textContent = 'Ⅱ 일시정지';
  timer = setInterval(() => {
    frame += 1;
    if (frame >= sample().frames.length - 1) { frame = sample().frames.length - 1; stop(); }
    draw();
  }, sample().dt * 1000);
});
window.addEventListener('resize', draw);

fetch('data/responses.json').then(response => {
  if (!response.ok) throw new Error('모델 결과를 불러오지 못했어.');
  return response.json();
}).then(data => {
  experiment = data;
  cellIndex = Math.max(0, data.cell_types.indexOf('L1'));
  document.querySelector('#selected-cell').textContent = data.cell_types[cellIndex];
  document.querySelector('#error').textContent = '';
  select('bright');
}).catch(error => document.querySelector('#error').textContent = error.message);
