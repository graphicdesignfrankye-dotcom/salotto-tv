// Prova a mano del canale di controllo con Edge (sul Mac, con Microsoft Edge installato):
//   node test/prova-canale-edge.cjs "$PWD"
// Apre Edge con gli stessi parametri di Salotto su una pagina locale e controlla tasti, testo e navigazione con le frecce.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { CanaleEdge } = require(path.join(process.argv[2] || process.cwd(), 'electron', 'cdp.cjs'));

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const PAGINA = `<!doctype html><title>prova</title>
<style>a{display:inline-block;margin:20px;padding:20px;border:1px solid}</style>
<input id="i"><div><a href="#uno">Uno</a><a href="#due">Due</a></div><div><a href="#tre">Tre</a><a href="#quattro">Quattro</a></div>
<script>window.tasti=[];window.selezione=[];addEventListener('keydown',e=>tasti.push(e.key));addEventListener('focusin',e=>selezione.push(e.target.textContent||e.target.id));</script>`;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((_q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(PAGINA); });
server.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-prova-'));
  const p = spawn(EDGE, ['--headless=new', '--remote-debugging-pipe', `--user-data-dir=${prof}`, '--no-first-run', url],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const c = new CanaleEdge(p.stdio[3], p.stdio[4], (m) => console.log('  log:', m), url);
  const fine = (codice) => { c.chiudi(); p.kill(); server.close(); process.exit(codice); };
  setTimeout(() => { console.error('tempo scaduto'); fine(2); }, 30000);
  try {
    await c.avvia();
    for (let i = 0; i < 50 && !c.pronto(); i++) await pausa(200);
    if (!c.pronto()) throw new Error('canale non collegato');
    await pausa(500);
    // 1) tasti e testo nel campo
    await c.valuta('document.getElementById("i").focus()');
    c.testo('ciao'); c.tasto('cancella');
    c.tastoFisico({ type: 'keyDown', key: 'x', code: 'KeyX' }); c.tastoFisico({ type: 'keyUp', key: 'x', code: 'KeyX' });
    await pausa(500);
    const campo = await c.valuta('document.getElementById("i").value');
    // 2) frecce: la selezione si sposta tra i link, Invio apre quello selezionato
    await c.valuta('document.activeElement.blur(); selezione.length = 0; tasti.length = 0');
    for (const t of ['down', 'down', 'right', 'down', 'ok']) { c.tasto(t); await pausa(250); }
    await pausa(500);
    const sel = await c.valuta('selezione');
    const hash = await c.valuta('location.hash');
    console.log('campo di testo:', JSON.stringify(campo), campo === 'ciax' ? 'OK' : 'SBAGLIATO');
    console.log('selezione con le frecce:', JSON.stringify(sel));
    const bordo = await c.valuta('getComputedStyle(document.activeElement).outlineWidth');
    console.log('Invio ha aperto:', JSON.stringify(hash), hash ? 'OK' : 'SBAGLIATO');
    console.log('bordo di selezione:', bordo, bordo === '4px' ? 'OK' : 'SBAGLIATO');
    fine(campo === 'ciax' && hash ? 0 : 1);
  } catch (e) { console.error('ERRORE', e.message); fine(1); }
});
