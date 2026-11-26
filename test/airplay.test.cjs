// arguments.txt di uxplay-windows: Salotto scrive il nome solo se il file è di serie o suo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AirPlay, eVideo } = require('../electron/airplay.cjs');

test('nome del ricevitore in arguments.txt', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'salotto-ap-'));
  process.env.APPDATA = path.join(base, 'roaming');
  process.env.ProgramData = path.join(base, 'programdata');
  const ap = new AirPlay(base);
  const file = ap.fileArgomenti();
  assert.strictEqual(ap.scriviArgomenti('Salotto (PC)'), true);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '-n Salotto-PC -nh', 'niente spazi né virgolette');
  assert.strictEqual(ap.scriviArgomenti('Salotto (PC)'), false, 'uguale: niente riavvio');
  assert.strictEqual(ap.scriviArgomenti('Città "100%"'), true);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '-n Citta-100 -nh', 'via accenti, virgolette e %');
  fs.writeFileSync(file, '-n Mio -nh -vs d3d11videosink');
  assert.strictEqual(ap.scriviArgomenti('Salotto'), false, 'file personalizzato: non si tocca');
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '-n Mio -nh -vs d3d11videosink');
  fs.writeFileSync(file, '-n uxplay-windows -nh');
  assert.strictEqual(ap.scriviArgomenti('Salotto'), true, 'file di serie: si scrive');
});

test('finestra del video', () => {
  assert.strictEqual(eVideo(''), false);
  assert.strictEqual(eVideo('uxplay-windows'), false);
  assert.strictEqual(eVideo('Direct3D11 renderer'), true);
});
