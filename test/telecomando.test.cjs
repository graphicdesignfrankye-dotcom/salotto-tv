const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { Impostazioni } = require('../electron/settings.cjs');
const { Telecomando } = require('../electron/remote.cjs');

// Coda dei messaggi: due messaggi nello stesso pacchetto non vanno persi.
function coda(ws) {
  const arrivati = [], attese = [];
  ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (attese.length) attese.shift()(m); else arrivati.push(m); });
  return () => (arrivati.length ? Promise.resolve(arrivati.shift()) : new Promise((ok) => attese.push(ok)));
}

test('PIN, token e comandi dal telefono', async () => {
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'salotto-'));
  const imp = new Impostazioni(cartella);
  const ricevuti = [];
  const t = new Telecomando(imp, (cmd, m) => ricevuti.push([cmd, m.testo]));
  const server = http.createServer((req, res) => { if (!t.http(req, res)) { res.writeHead(404); res.end(); } });
  server.on('upgrade', (req, s, h) => t.upgrade(req, s, h));
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  try {
    // la pagina del telecomando si apre; i file fuori cartella no
    const pagina = await new Promise((ok) => http.get(`http://127.0.0.1:${server.address().port}/`, (r) => ok(r.statusCode)));
    assert.equal(pagina, 200);
    const furbo = await new Promise((ok) => http.get(`http://127.0.0.1:${server.address().port}/..%2Fpackage.json`, (r) => ok(r.statusCode)));
    assert.equal(furbo, 404);

    let ws = new WebSocket(url);
    let prossimo = coda(ws);
    await new Promise((ok) => ws.on('open', ok));
    ws.send(JSON.stringify({ cmd: 'up' }));           // non autorizzato: ignorato
    let m = await prossimo();
    assert.equal(m.tipo, 'pin');
    ws.send(JSON.stringify({ pin: '0000' === imp.get('pin') ? '1111' : '0000' }));
    m = await prossimo(); assert.deepEqual(m, { tipo: 'pin', errato: true });
    ws.send(JSON.stringify({ pin: imp.get('pin') }));
    m = await prossimo(); assert.equal(m.tipo, 'token');
    const token = m.token;
    m = await prossimo(); assert.equal(m.tipo, 'ok');
    ws.send(JSON.stringify({ cmd: 'left' }));
    ws.send(JSON.stringify({ cmd: 'testo', testo: 'ciao' }));
    ws.send(JSON.stringify({ cmd: 'rm -rf' }));
    await new Promise((ok) => setTimeout(ok, 100));
    assert.deepEqual(ricevuti, [['left', undefined], ['testo', 'ciao']]);
    ws.close();

    // con il token non serve più il PIN
    ws = new WebSocket(url);
    prossimo = coda(ws);
    await new Promise((ok) => ws.on('open', ok));
    ws.send(JSON.stringify({ token }));
    m = await prossimo(); assert.equal(m.tipo, 'ok');
    assert.equal(t.collegati(), 1);
    ws.close();
    t.dimentica();
    assert.deepEqual(imp.get('tokenTelefoni'), []);
  } finally { server.closeAllConnections(); server.close(); fs.rmSync(cartella, { recursive: true, force: true }); }
});
