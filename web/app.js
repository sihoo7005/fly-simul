const conditions = ['none', 'left', 'right'];
const colors = { none: '#78aee8', left: '#ffb353', right: '#79d9a2' };
const data = {};
const video = document.querySelector('#video');
const seek = document.querySelector('#seek');
const play = document.querySelector('#play');
const time = document.querySelector('#time');
const canvas = document.querySelector('#paths');
let selected = 'none';

function parseCsv(csv) {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const names = header.split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((value, index) => [names[index], Number(value)])));
}

function select(condition) {
  selected = condition;
  video.pause();
  video.src = `data/${condition}.mp4`;
  video.load();
  play.textContent = '▶ 재생';
  seek.value = 0;
  document.querySelectorAll('[data-condition]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.condition === condition));
  });
  update();
}

function currentRow() {
  const rows = data[selected] || [];
  if (!rows.length) return null;
  const fraction = video.duration ? video.currentTime / video.duration : 0;
  return rows[Math.min(rows.length - 1, Math.floor(fraction * rows.length))];
}

function update() {
  const fraction = video.duration ? video.currentTime / video.duration : 0;
  seek.value = Math.round(fraction * 1000);
  const row = currentRow();
  time.textContent = `${(row?.time_s || 0).toFixed(2)}초`;
  for (const side of ['left', 'right']) {
    const value = row?.[`red_${side}`] || 0;
    document.querySelector(`#${side}-value`).textContent = `${(value * 100).toFixed(2)}%`;
    document.querySelector(`#${side}-bar`).style.width = `${Math.min(100, value * 2500)}%`;
  }
  drawPaths();
}

function drawPaths() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const all = Object.values(data).flat();
  if (!all.length) return;
  const xs = all.map(row => row.x_mm);
  const ys = all.map(row => row.y_mm);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const span = Math.max(xmax - xmin, ymax - ymin, 0.1);
  const pad = 28;
  const scale = Math.min((width - 2 * pad) / span, (height - 2 * pad) / span);
  const x = row => width / 2 + (row.x_mm - (xmin + xmax) / 2) * scale;
  const y = row => height / 2 - (row.y_mm - (ymin + ymax) / 2) * scale;
  ctx.strokeStyle = '#344451';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, height - pad); ctx.lineTo(width - pad, height - pad);
  ctx.moveTo(pad, pad); ctx.lineTo(pad, height - pad);
  ctx.stroke();
  for (const condition of conditions) {
    const rows = data[condition] || [];
    if (!rows.length) continue;
    ctx.strokeStyle = colors[condition];
    ctx.globalAlpha = condition === selected ? 1 : 0.42;
    ctx.lineWidth = condition === selected ? 3 : 2;
    ctx.beginPath();
    rows.forEach((row, i) => i ? ctx.lineTo(x(row), y(row)) : ctx.moveTo(x(row), y(row)));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const row = currentRow();
  if (row) {
    ctx.fillStyle = colors[selected];
    ctx.beginPath(); ctx.arc(x(row), y(row), 6, 0, 2 * Math.PI); ctx.fill();
  }
}

document.querySelectorAll('[data-condition]').forEach(button => button.addEventListener('click', () => select(button.dataset.condition)));
play.addEventListener('click', () => video.paused ? video.play() : video.pause());
video.addEventListener('play', () => play.textContent = 'Ⅱ 일시정지');
video.addEventListener('pause', () => play.textContent = '▶ 재생');
video.addEventListener('timeupdate', update);
video.addEventListener('loadedmetadata', update);
seek.addEventListener('input', () => { if (video.duration) video.currentTime = video.duration * Number(seek.value) / 1000; update(); });
window.addEventListener('resize', drawPaths);

Promise.all(conditions.map(async condition => {
  const response = await fetch(`data/${condition}.csv`);
  if (!response.ok) throw new Error(`${condition} 기록을 불러오지 못했어.`);
  data[condition] = parseCsv(await response.text());
})).then(() => select('none')).catch(error => document.querySelector('#error').textContent = error.message);
