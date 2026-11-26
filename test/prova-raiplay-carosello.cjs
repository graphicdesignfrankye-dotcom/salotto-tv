// Prova a mano delle frecce sul carosello "Da non perdere" del vero RaiPlay (apre per ~30 s una finestra di Edge con profilo temporaneo).
// Uso: node test/prova-raiplay-carosello.cjs "$PWD" /percorso/foto.jpg
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path'); const os = require('os');
const { CanaleEdge } = require(process.argv[2] + '/electron/cdp.cjs');
const url = 'https://www.raiplay.it';
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-carf-'));
const p = spawn('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', ['--window-size=1600,900', '--app=' + url, '--remote-debugging-pipe', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const c = new CanaleEdge(p.stdio[3], p.stdio[4], () => {}, url);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const stato = `(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return (a.getAttribute('href')||a.tagName) + (r.left >= -2 && r.right <= innerWidth + 2 && r.top >= 0 && r.bottom <= innerHeight ? '  [sullo schermo]' : '  [FUORI: x=' + Math.round(r.left) + ' y=' + Math.round(r.top) + ']'); })()`;
(async () => {
  await c.avvia();
  for (let i = 0; i < 80 && !c.pronto(); i++) await pausa(200);
  await pausa(9000);
  await c.valuta(`[...document.querySelectorAll('button')].find(b=>/continua senza accettare/i.test(b.textContent))?.click()`);
  await pausa(1500);
  // si porta la selezione sul primo titolo di "Da non perdere"
  await c.valuta(`(() => { const h = [...document.querySelectorAll('h2')].find(e => /da non perdere/i.test(e.textContent)); let b = h; for (let i=0;i<8;i++){ b = b.parentElement; if (b.querySelectorAll('a[href]').length > 6) break; } const a = b.querySelector('a.card-item__link'); a.focus(); a.scrollIntoView({block:'center'}); })()`);
  await pausa(800);
  console.log('inizio  ', await c.valuta(stato));
  for (let i = 1; i <= 12; i++) { c.tasto('right'); await pausa(700); console.log('destra', String(i).padStart(2), await c.valuta(stato)); }
  for (let i = 1; i <= 3; i++) { c.tasto('left'); await pausa(700); console.log('sinistra', i, await c.valuta(stato)); }
  c.tasto('down'); await pausa(900); console.log('giù     ', await c.valuta(stato));
  const { data } = await c.invia('Page.captureScreenshot', { format: 'jpeg', quality: 50 }, c.sessione); fs.writeFileSync(process.argv[3], Buffer.from(data, 'base64'));
  c.tasto('up'); await pausa(900); console.log('su      ', await c.valuta(stato));
  c.chiudi(); p.kill(); process.exit(0);
})().catch((e) => { console.error('ERRORE', e.message); p.kill(); process.exit(1); });
setTimeout(() => { p.kill(); process.exit(2); }, 120000);
