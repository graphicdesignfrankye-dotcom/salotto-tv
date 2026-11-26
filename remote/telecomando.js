// Telecomando di Salotto sul telefono.
'use strict';
const $ = (s) => document.querySelector(s);
const CHIAVE = 'salotto-token';
let ws = null, pronto = false, attesa = 1000;

function stato(t, ok = false) { const el = $('#stato'); el.textContent = t; el.classList.toggle('ok', ok); }

function collega() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => {
    attesa = 1000;
    const token = localStorage.getItem(CHIAVE);
    if (token) ws.send(JSON.stringify({ token }));
    else mostraAccesso();
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.tipo === 'token') localStorage.setItem(CHIAVE, m.token);
    else if (m.tipo === 'ok') { pronto = true; $('#accesso').hidden = true; $('#telecomando').hidden = false; $('#nome-tv').textContent = m.nome || 'Salotto'; stato('collegato', true); }
    else if (m.tipo === 'pin') { localStorage.removeItem(CHIAVE); mostraAccesso(m.errato); }
  };
  ws.onclose = () => {
    pronto = false;
    stato('riconnessione…');
    setTimeout(collega, attesa);
    attesa = Math.min(attesa * 2, 10000);
  };
}
function mostraAccesso(errato) {
  $('#telecomando').hidden = true;
  $('#accesso').hidden = false;
  $('#errore-pin').hidden = !errato;
  $('#pin').value = '';
  $('#pin').focus();
}
$('#form-pin').addEventListener('submit', (e) => {
  e.preventDefault();
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ pin: $('#pin').value.trim() }));
});

function invia(cmd, extra = {}) {
  if (!pronto || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ cmd, ...extra }));
}
const vibra = () => navigator.vibrate && navigator.vibrate(12);

// Tasti: le frecce si ripetono tenendo premuto.
document.querySelectorAll('[data-cmd]').forEach((b) => {
  let ripeti, primo;
  const ferma = () => { clearTimeout(primo); clearInterval(ripeti); b.classList.remove('premuto'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const cmd = b.dataset.cmd;
    b.classList.add('premuto');
    vibra();
    invia(cmd);
    if (cmd === 'cancella' && campo.value) { campo.value = campo.value.slice(0, -1); prima = campo.value; }
    if (['up', 'down', 'left', 'right', 'volup', 'voldown', 'cancella'].includes(cmd)) {
      primo = setTimeout(() => { ripeti = setInterval(() => invia(cmd), 110); }, 450);
    }
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, ferma));
});

// Schede Frecce / Touchpad
document.querySelectorAll('[data-scheda]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-scheda]').forEach((x) => x.setAttribute('aria-selected', x === b));
  $('#frecce').hidden = b.dataset.scheda !== 'frecce';
  $('#mouse').hidden = b.dataset.scheda !== 'mouse';
}));

// Touchpad: un dito muove, tocco = clic, due dita = scorrimento.
const pad = $('#pad');
const tocchi = new Map();
let mossa = false, inizio = 0, accumuloRotella = 0, ultimoInvio = 0, accX = 0, accY = 0;
pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); tocchi.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (tocchi.size === 1) { mossa = false; inizio = Date.now(); } });
pad.addEventListener('pointermove', (e) => {
  const p = tocchi.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (Math.abs(dx) + Math.abs(dy) > 1) mossa = true;
  if (tocchi.size >= 2) {
    accumuloRotella += dy / 2;
    if (Math.abs(accumuloRotella) >= 10) { invia('rotella', { d: Math.round(-accumuloRotella / 10) * 120 }); accumuloRotella = 0; }
    return;
  }
  const v = Math.hypot(dx, dy), acc = v > 12 ? 2.6 : v > 5 ? 1.8 : 1.2;
  accX += dx * acc; accY += dy * acc;
  const ora = Date.now();
  if (ora - ultimoInvio > 16) { invia('mouse', { dx: Math.round(accX), dy: Math.round(accY) }); accX = 0; accY = 0; ultimoInvio = ora; }
});
const fine = (e) => {
  if (!tocchi.has(e.pointerId)) return;
  tocchi.delete(e.pointerId);
  if (tocchi.size === 0 && !mossa && Date.now() - inizio < 300) { vibra(); invia('clic'); }
};
pad.addEventListener('pointerup', fine);
pad.addEventListener('pointercancel', fine);

// Tastiera: quello che scrivi arriva subito sulla TV (anche le cancellazioni).
const campo = $('#testo');
let prima = '';
$('#apri-tastiera').addEventListener('click', () => {
  const t = $('#tastiera');
  t.hidden = !t.hidden;
  if (!t.hidden) { campo.value = ''; prima = ''; campo.focus(); }
});
campo.addEventListener('input', () => {
  const ora = campo.value;
  let comune = 0;
  while (comune < prima.length && comune < ora.length && prima[comune] === ora[comune]) comune++;
  for (let i = 0; i < prima.length - comune; i++) invia('cancella');
  if (ora.length > comune) invia('testo', { testo: ora.slice(comune) });
  prima = ora;
});
$('#tastiera').addEventListener('submit', (e) => {
  e.preventDefault();
  invia('invio');
  campo.value = ''; prima = '';
});

collega();
