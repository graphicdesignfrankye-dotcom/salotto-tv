// Disegna l'icona di Salotto (televisore su sfondo viola-blu) e la salva come build/icon.ico.
// Installer e disinstallatore DEVONO usare la stessa icona: sul Mac electron-builder ricostruisce
// il disinstallatore con l'icona dell'installer, e se sono diverse il controllo di integrità fallisce.
'use strict';
const fs = require('fs');
const path = require('path');

function pixel(x, y) { // coordinate 0..1, ritorna [r,g,b,a] 0..1
  const sd = (px, py, cx, cy, hw, hh, r) => { // distanza con segno da rettangolo arrotondato
    const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  };
  if (sd(x, y, .5, .5, .5, .5, .22) > 0) return [0, 0, 0, 0];
  const t = (x + y) / 2;
  let c = [0x4f / 255 * (1 - t) + 0x8b / 255 * t, 0x6b / 255 * (1 - t) + 0x3d / 255 * t, 0xff / 255 * (1 - t) + 0xf5 / 255 * t];
  const schermo = sd(x, y, .5, .45, .3, .2, .06);
  const bordo = Math.abs(schermo) < .035;
  const piede = sd(x, y, .5, .735, .13, .025, .02) < 0;
  const gambo = sd(x, y, .5, .68, .025, .04, 0) < 0;
  const play = (() => { const px = x - .45, py = y - .45; return px > -0.07 && px < 0.08 && Math.abs(py) < (0.08 - px) * 0.75 + 0.0; })();
  if (bordo || piede || gambo || play) c = [1, 1, 1];
  else if (schermo < 0) c = c.map((v) => v * 0.55);
  return [...c, 1];
}

function immagine(n) { // BGRA dal basso in alto, con supercampionamento 4x4
  const px = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let s = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const p = pixel((x + (i + .5) / 4) / n, (y + (j + .5) / 4) / n);
      s = [s[0] + p[0] * p[3], s[1] + p[1] * p[3], s[2] + p[2] * p[3], s[3] + p[3]];
    }
    const a = s[3] / 16, o = ((n - 1 - y) * n + x) * 4;
    px[o] = a ? Math.round(s[2] / s[3] * 255) : 0; px[o + 1] = a ? Math.round(s[1] / s[3] * 255) : 0;
    px[o + 2] = a ? Math.round(s[0] / s[3] * 255) : 0; px[o + 3] = Math.round(a * 255);
  }
  const riga = Math.ceil(n / 32) * 4; // maschera AND (tutta a zero: conta l'alfa)
  const dib = Buffer.alloc(40);
  dib.writeUInt32LE(40, 0); dib.writeInt32LE(n, 4); dib.writeInt32LE(n * 2, 8); dib.writeUInt16LE(1, 12); dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(px.length + riga * n, 20);
  return Buffer.concat([dib, px, Buffer.alloc(riga * n)]);
}

const lati = [16, 24, 32, 48, 64, 128, 256];
const imm = lati.map(immagine);
const testa = Buffer.alloc(6 + 16 * lati.length);
testa.writeUInt16LE(1, 2); testa.writeUInt16LE(lati.length, 4);
let off = testa.length;
lati.forEach((n, i) => {
  const e = 6 + 16 * i;
  testa[e] = n === 256 ? 0 : n; testa[e + 1] = n === 256 ? 0 : n;
  testa.writeUInt16LE(1, e + 4); testa.writeUInt16LE(32, e + 6);
  testa.writeUInt32LE(imm[i].length, e + 8); testa.writeUInt32LE(off, e + 12);
  off += imm[i].length;
});
fs.writeFileSync(path.join(__dirname, 'icon.ico'), Buffer.concat([testa, ...imm]));
console.log('build/icon.ico', off, 'byte');
