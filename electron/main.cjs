// Salotto: trasforma il PC Windows in una TV.
// Finestra a schermo intero con le app (launcher), telecomando dal telefono, ricevitore DLNA.
const { app, BrowserWindow, WebContentsView, ipcMain, globalShortcut, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execFile } = require('child_process');
const QRCode = require('qrcode');
const { Impostazioni, AGENTI } = require('./settings.cjs');
const { Tastiera } = require('./keys.cjs');
const { Telecomando, indirizzoLocale } = require('./remote.cjs');
const { RicevitoreDLNA } = require('./dlna.cjs');
const { AirPlay } = require('./airplay.cjs');
const { Loghi } = require('./loghi.cjs');
const { CanaleEdge, STILE_FUOCO, NAVIGAZIONE } = require('./cdp.cjs');
// castLabs Electron (Electron for Content Security): Widevine per Netflix & co. dentro Salotto.
const { components } = require('electron');
let widevine = false, widevinePronto = Promise.resolve();
async function preparaWidevine() {
  if (!components) { log('Widevine: non disponibile (Electron senza castLabs)'); return; }
  try {
    await components.whenReady();
    widevine = true;
    log('Widevine pronto: ' + JSON.stringify(components.status()));
  } catch (e) { log('Widevine non pronto: ' + (e && e.message ? e.message : e)); }
}
const { Programmi } = require('./programmi.cjs');
const { Bluetooth } = require('./bluetooth.cjs');
const { Tmdb, RICERCA } = require('./tmdb.cjs');

const WINDOWS = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const IN_FINESTRA = process.argv.includes('--finestra');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('it.salotto.tv');

let win = null;          // finestra principale (launcher + lettore)
let vista = null;        // app "interna" aperta sopra il launcher
let attivo = 'launcher'; // 'launcher' | 'interna' | 'edge' | 'airplay'
let imp, tastiera, telecomando, dlna = null, server = null, porta = 0;
let airplay, loghi, sorveglianza = null, airplayInDisparte = false;
let videoAirPlay = null; // handle della finestra del video AirPlay incastrata in Salotto
let finestraEdge = null;  // handle della finestra di Edge incastrata in Salotto
let giroEdge = 0, controlloEdge = null;
let canaleEdge = null;
let processoBrowser = null; // Mac: il browser delle app con video protetti (Edge o Chrome), aperto a tutto schermo sopra Salotto
let programmi = null;
let tmdb = null;          // catalogo di film e serie (themoviedb.org)
let bluetooth = null;     // Bluetooth del PC (solo Windows)     // programmi del PC (menu Start) per la schermata "Programmi"    // canale di controllo con Edge (tasti direttamente alla pagina)
let fileLog;

function log(msg) {
  const riga = `${new Date().toISOString()} ${msg}\n`;
  if (!app.isPackaged) process.stdout.write(riga);
  try { fs.appendFileSync(fileLog, riga); } catch { /* niente log */ }
}

function invia(canale, ...dati) { if (win && !win.isDestroyed()) win.webContents.send(canale, ...dati); }

// ---------- finestra ----------
function creaFinestra() {
  win = new BrowserWindow({
    width: 1280, height: 720,
    fullscreen: !IN_FINESTRA,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d12',
    title: imp.get('nome'),
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.on('resize', () => {
    if (vista) vista.setBounds(contenuto());
    if (videoAirPlay && attivo === 'airplay') tastiera.adatta(videoAirPlay, handleSalotto());
    if (finestraEdge && attivo === 'edge') tastiera.adatta(finestraEdge, handleSalotto());
  });
  // Se l'utente chiude Edge (Alt+F4) torna sul launcher: lo segniamo.
  win.on('focus', () => {
    // Edge incastrato: quando Salotto torna attivo la tastiera deve andare a Edge, non alla home nascosta.
    if (attivo === 'edge' && finestraEdge) { tastiera.fuoco(finestraEdge); return; }
    // Edge separato chiuso dall'utente (Alt+F4): si torna sul launcher.
    if (attivo === 'edge') attivo = 'launcher';
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // Tastiera o telecomando USB del PC mentre Edge è dentro Salotto: Windows li dà a Salotto, li si gira a Edge.
  win.webContents.on('before-input-event', (e, input) => {
    if (attivo !== 'edge' || !canaleEdge || !canaleEdge.pronto()) return;
    e.preventDefault();
    if (input.type !== 'keyDown' && input.type !== 'keyUp') return;
    if (input.key === 'BrowserHome' || input.key === 'F10') { if (input.type === 'keyDown') vaiHome(); return; }
    if (input.key === 'BrowserBack') { if (input.type === 'keyDown') canaleEdge.indietro(); return; }
    canaleEdge.tastoFisico(input);
  });
  win.webContents.on('console-message', (e) => { if (e.level !== 'debug' && e.level !== 'info') log(`interfaccia [${e.level}] ${e.message}`); });
}

function handleSalotto() { const b = win.getNativeWindowHandle(); return (b.length >= 8 ? b.readBigUInt64LE(0) : BigInt(b.readUInt32LE(0))).toString(); }
function contenuto() { const [w, h] = win.getContentSize(); return { x: 0, y: 0, width: w, height: h }; }

function inPrimoPiano() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  // Windows non lascia rubare il fuoco a un processo in secondo piano: il trucco "sempre in primo piano" lo permette.
  win.setAlwaysOnTop(true);
  if (MAC) app.focus({ steal: true });
  win.focus();
  setTimeout(() => win && win.setAlwaysOnTop(false), 300);
  if (!IN_FINESTRA && !win.isFullScreen()) win.setFullScreen(true);
}

// ---------- apertura delle app ----------
function percorsoEdge() {
  if (MAC) {
    // Sul Mac: Edge, altrimenti Chrome o Brave (servono per i video protetti di Netflix & co.).
    const app = ['Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Google Chrome.app/Contents/MacOS/Google Chrome', 'Brave Browser.app/Contents/MacOS/Brave Browser'];
    const cartelle = ['/Applications', path.join(require('os').homedir(), 'Applications')];
    for (const a of app) for (const c of cartelle) { const p = path.join(c, a); if (fs.existsSync(p)) return p; }
    return null;
  }
  if (!WINDOWS) return null;
  const candidati = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  return candidati.find((p) => p && fs.existsSync(p)) || null;
}
const cartellaEdge = () => path.join(app.getPath('userData'), 'salotto-edge');

function powershell(comando) {
  return new Promise((ok) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], { windowsHide: true, timeout: 15000 }, (e, out) => ok(e ? '' : out)));
}

// Chiude le finestre di Edge aperte da Salotto (solo quelle col nostro profilo, non l'Edge dell'utente).
async function chiudiEdge() {
  fermaEdgeIncastrato();
  if (MAC) {
    const p = processoBrowser;
    if (!p || p.exitCode !== null) return;
    processoBrowser = null;
    p.kill('SIGTERM');
    for (let i = 0; i < 15 && p.exitCode === null && p.signalCode === null; i++) await new Promise((ok) => setTimeout(ok, 200));
    if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
    return;
  }
  if (!WINDOWS) return;
  const filtro = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*salotto-edge*' -and $_.CommandLine -notlike '*--type=*' }`;
  const pid = (await powershell(`${filtro} | ForEach-Object { $_.ProcessId }`)).split(/\s+/).filter(Boolean);
  if (!pid.length) return;
  // Prima con gentilezza (come chiudere la finestra), così Edge non chiede di "ripristinare le pagine".
  await new Promise((ok) => execFile('taskkill.exe', pid.flatMap((p) => ['/PID', p]), { windowsHide: true }, () => ok()));
  for (let i = 0; i < 10; i++) {
    await new Promise((ok) => setTimeout(ok, 300));
    const ancora = (await powershell(`${filtro} | ForEach-Object { $_.ProcessId }`)).trim();
    if (!ancora) return;
  }
  await powershell(`${filtro.replace(" -and $_.CommandLine -notlike '*--type=*'", '')} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`);
}

function chiudiVista() {
  if (!vista) return;
  try { win.contentView.removeChildView(vista); } catch { /* già tolta */ }
  try { vista.webContents.close(); } catch { /* già chiusa */ }
  vista = null;
}

function apriInterna(a, drm = false) {
  chiudiVista();
  vista = new WebContentsView({ webPreferences: { partition: `persist:app-${a.id}`, contextIsolation: true, sandbox: true } });
  vista.webContents.session.setPermissionRequestHandler((_wc, perm, cb) => cb(['fullscreen', 'mediaKeySystem'].includes(perm)));
  const wc = vista.webContents;
  if (a.agente && AGENTI[a.agente]) wc.setUserAgent(AGENTI[a.agente]);
  else if (a.agente) wc.setUserAgent(a.agente);
  // Video protetti: i siti devono vedere un Chrome normale (senza "Electron" nel nome).
  else if (drm) wc.setUserAgent(wc.getUserAgent().replace(/ (Electron|salotto-tv|Salotto)\/\S+/gi, ''));
  // Navigazione TV con le frecce (come in Edge): bordo bianco sull'elemento scelto e caroselli.
  if (drm) wc.on('dom-ready', () => { wc.executeJavaScript(STILE_FUOCO + '\n;' + NAVIGAZIONE).catch(() => {}); });
  wc.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) wc.loadURL(url); return { action: 'deny' }; });
  wc.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'BrowserHome' || input.key === 'F10')) { e.preventDefault(); vaiHome(); }
  });
  wc.on('render-process-gone', () => vaiHome());
  // La pagina si mostra quando è caricata (o dopo 6 secondi): intanto si vede l'animazione di apertura.
  const questa = vista;
  let mostrata = false;
  const mostra = () => {
    if (mostrata || vista !== questa) return;
    mostrata = true;
    win.contentView.addChildView(questa);
    questa.setBounds(contenuto());
    wc.focus();
    invia('app-aperta');
  };
  wc.once('did-finish-load', mostra);
  wc.once('did-fail-load', mostra);
  setTimeout(mostra, 6000);
  wc.loadURL(a.url);
  attivo = 'interna';
}

// extra (dalle schede di film e serie): { cerca: 'titolo' } apre l'app già sulla ricerca, { trailer: 'idYouTube' } apre il trailer.
async function apriApp(id, extra) {
  const salvata = imp.get('app').find((x) => x.id === id);
  if (!salvata) return { ok: false, errore: 'App non trovata' };
  const a = { ...salvata };
  if (extra && typeof extra === 'object') {
    if (id === 'youtube' && typeof extra.trailer === 'string' && /^[\w-]{6,20}$/.test(extra.trailer)) a.url = 'https://www.youtube.com/tv#/watch?v=' + extra.trailer;
    else if (typeof extra.cerca === 'string' && extra.cerca.trim() && RICERCA[id]) a.url = RICERCA[id](extra.cerca.trim().slice(0, 120));
  }
  log(`apro ${a.nome} (${a.modo})`);
  invia('player', 'stop');
  try {
    if (a.modo === 'link') { await shell.openExternal(a.url); return { ok: true }; }
    if (a.modo === 'programma' && MAC) {
      // Sul Mac: un'app .app (scelta a mano) o, per i programmi dello Store, quella con lo stesso nome in Applicazioni.
      const p = /\.app\/?$/i.test(a.percorso || '') ? a.percorso : path.join('/Applications', a.nome + '.app');
      if (!fs.existsSync(p)) return { ok: false, errore: `${a.nome} non è installato in Applicazioni` };
      const errore = await shell.openPath(p);
      return errore ? { ok: false, errore } : { ok: true };
    }
    if (a.modo === 'programma') {
      if (!a.percorso || !fs.existsSync(a.percorso)) return { ok: false, errore: 'Programma non trovato: ' + (a.percorso || '') };
      spawn(a.percorso, a.argomenti ? String(a.argomenti).split(' ').filter(Boolean) : [], { detached: true, stdio: 'ignore', cwd: path.dirname(a.percorso) }).unref();
      return { ok: true };
    }
    const edge = a.modo === 'edge' ? percorsoEdge() : null;
    // Widevine dentro Salotto: se scelto nelle Impostazioni, oppure se non c'è un browser adatto.
    if (a.modo === 'edge' && components && (imp.get('drmInterno') || !edge)) {
      await Promise.race([widevinePronto, new Promise((ok) => setTimeout(ok, 15000))]);
      if (widevine) { await chiudiEdge(); apriInterna(a, true); log(`${a.nome} dentro Salotto con Widevine`); return { ok: true }; }
      log('Widevine non pronto: uso il browser');
    }
    if (!edge) { apriInterna(a); return { ok: true, nota: a.modo === 'edge' ? 'Edge non disponibile: aperta dentro Salotto' : undefined }; }
    chiudiVista();
    await chiudiEdge();
    const args = [
      `--app=${a.url}`, '--start-fullscreen', `--user-data-dir=${cartellaEdge()}`,
      '--no-first-run', '--no-default-browser-check', '--hide-crash-restore-bubble', '--autoplay-policy=no-user-gesture-required',
    ];
    if (a.agente) args.push(`--user-agent=${AGENTI[a.agente] || a.agente}`);
    const dentro = WINDOWS && imp.get('edgeDentro') !== false;
    if (dentro) {
      await tastiera.preparaEdge(); // si annotano le finestre di Edge già aperte
      // Edge dentro Salotto non è mai la finestra "attiva" di Windows: i tasti passano dal canale di controllo.
      args.push('--remote-debugging-pipe');
      const p = spawn(edge, args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
      p.on('error', (e) => log('Edge non parte: ' + e.message));
      // Diagnosi: se Edge si chiude da solo, nel log restano codice di uscita e messaggi di errore.
      const partito = Date.now();
      let righeErr = 0;
      p.stderr.on('data', (d) => {
        for (const r of String(d).split(/\r?\n/)) if (r.trim() && righeErr++ < 12) log('Edge dice: ' + r.trim().slice(0, 300));
      });
      p.on('exit', (codice, segnale) => log(`Edge uscito: codice ${codice}${segnale ? ' ' + segnale : ''} dopo ${Date.now() - partito} ms`));
      log('Edge: ' + edge + ' ' + args.filter((x) => !x.startsWith('--user-agent')).join(' '));
      const c = new CanaleEdge(p.stdio[3], p.stdio[4], log, a.url);
      canaleEdge = c;
      c.on('chiuso', () => { if (canaleEdge === c) { canaleEdge = null; log('canale Edge: chiuso'); } });
      c.avvia().catch((e) => log('canale Edge: ' + e.message));
    } else if (MAC) {
      // Sul Mac la finestra del browser non si può mettere dentro Salotto: si apre a tutto schermo sopra.
      // Il canale di controllo serve per i tasti del telefono; la tastiera del Mac va direttamente alla pagina.
      args.push('--remote-debugging-pipe');
      const p = spawn(edge, args, { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
      processoBrowser = p;
      p.on('error', (e) => log('browser non parte: ' + e.message));
      p.on('exit', () => {
        if (processoBrowser !== p) return;
        processoBrowser = null;
        // Chiuso dall'utente (Cmd+Q): si torna alla home.
        if (attivo === 'edge') { attivo = 'launcher'; inPrimoPiano(); invia('home'); }
      });
      const c = new CanaleEdge(p.stdio[3], p.stdio[4], log, a.url);
      canaleEdge = c;
      c.on('chiuso', () => { if (canaleEdge === c) { canaleEdge = null; log('canale browser: chiuso'); } });
      c.avvia().catch((e) => log('canale browser: ' + e.message));
    } else spawn(edge, args, { detached: true, stdio: 'ignore' }).unref();
    attivo = 'edge';
    if (dentro) incastraEdge(a.nome);
    else setTimeout(() => invia('app-aperta'), 2500);
    return { ok: true };
  } catch (e) {
    log('errore apertura: ' + e.message);
    return { ok: false, errore: e.message };
  }
}

async function vaiHome() {
  // Se arriva un video AirPlay e si torna alla home, il video resta dietro finché il telefono non smette.
  if (attivo === 'airplay') { airplayInDisparte = true; if (videoAirPlay) tastiera.nascondi(videoAirPlay); }
  chiudiVista();
  const eraEdge = attivo === 'edge';
  attivo = 'launcher';
  inPrimoPiano();
  invia('home');
  if (eraEdge) await chiudiEdge();
  inPrimoPiano();
}

// ---------- telecomando ----------
const TASTI_ELECTRON = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'Enter', back: 'Escape', cancella: 'Backspace', invio: 'Enter' };

function tastoInVista(nome) {
  const keyCode = TASTI_ELECTRON[nome];
  if (!vista || !keyCode) return;
  vista.webContents.sendInputEvent({ type: 'keyDown', keyCode });
  if (keyCode === 'Enter') vista.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
  vista.webContents.sendInputEvent({ type: 'keyUp', keyCode });
}

function comando(cmd, m = {}) {
  if (cmd === 'home') { vaiHome(); return; }
  // Volume dal telefono sul Mac: volume di sistema.
  if (MAC && ['volup', 'voldown', 'mute'].includes(cmd)) {
    const s = { volup: 'set volume output volume ((output volume of (get volume settings)) + 6)',
      voldown: 'set volume output volume ((output volume of (get volume settings)) - 6)',
      mute: 'set volume output muted (not (output muted of (get volume settings)))' }[cmd];
    execFile('osascript', ['-e', s], () => {});
    return;
  }
  // Volume e play/pausa: tasti multimediali di Windows (valgono per tutto il PC).
  if (['volup', 'voldown', 'mute'].includes(cmd) && tastiera.tasto(cmd)) return;
  if (cmd === 'playpause' && attivo !== 'launcher' && tastiera.tasto('playpause')) return;
  // Mouse: solo su Windows (muove il puntatore vero).
  if (cmd === 'mouse') { tastiera.muovi(Number(m.dx) || 0, Number(m.dy) || 0); return; }
  if (cmd === 'clic') { tastiera.clic(); return; }
  if (cmd === 'rotella') { tastiera.rotella(Number(m.d) || 0); return; }

  if (attivo === 'airplay') {
    if (cmd === 'back') vaiHome();
    else if (TASTI_ELECTRON[cmd]) tastiera.tasto(cmd === 'back' ? 'esc' : cmd === 'cancella' ? 'backspace' : cmd === 'invio' ? 'ok' : cmd);
    return;
  }
  if (attivo === 'edge' && canaleEdge && canaleEdge.pronto()) {
    // Edge dentro Salotto: i tasti vanno alla pagina dal canale di controllo.
    if (cmd === 'testo') canaleEdge.testo(String(m.testo || '').slice(0, 500));
    else if (cmd === 'back') canaleEdge.indietro();
    else if (!canaleEdge.tasto(cmd)) tastiera.tasto(cmd);
    return;
  }
  if (attivo === 'edge' && WINDOWS && finestraEdge) {
    // Riserva: tasti mandati alla finestra di Edge (se il canale non è disponibile).
    if (cmd === 'testo') tastiera.testoA(finestraEdge, String(m.testo || '').slice(0, 500));
    else if (cmd === 'back') tastiera.indietroA(finestraEdge);
    else if (!tastiera.tastoA(finestraEdge, cmd)) tastiera.tasto(cmd);
    return;
  }
  if (attivo === 'edge' && WINDOWS) {
    if (cmd === 'testo') tastiera.testo(String(m.testo || '').slice(0, 500));
    else if (cmd === 'back') tastiera.tasto('browserBack');
    else if (cmd === 'cancella') tastiera.tasto('backspace');
    else if (cmd === 'invio') tastiera.tasto('ok');
    else tastiera.tasto(cmd);
    return;
  }
  if (attivo === 'interna' && vista) {
    if (cmd === 'testo') vista.webContents.insertText(String(m.testo || '').slice(0, 500));
    else if (cmd === 'playpause') { vista.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'MediaPlayPause' }); vista.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'MediaPlayPause' }); }
    else tastoInVista(cmd);
    return;
  }
  // Launcher: il comando va all'interfaccia, che gestisce da sé la navigazione.
  if (cmd === 'testo') { win.webContents.insertText(String(m.testo || '').slice(0, 500)); return; }
  invia('telecomando', cmd);
}

// ---------- server HTTP (telecomando + DLNA) ----------
function avviaServer(prima) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      if (dlna && dlna.http(req, res)) return;
      if (telecomando.http(req, res)) return;
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Non trovato');
    });
    s.on('upgrade', (req, socket, head) => telecomando.upgrade(req, socket, head));
    let tentativo = 0;
    s.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && tentativo < 10) { tentativo++; s.listen(prima + tentativo, '0.0.0.0'); return; }
      log('server: ' + e.message); ok(null);
    });
    s.on('listening', () => { porta = s.address().port; log(`telecomando su http://${indirizzoLocale()}:${porta}`); ok(s); });
    s.listen(prima, '0.0.0.0');
  });
}

function avviaDLNA() {
  fermaDLNA();
  if (!imp.get('dlna') || !server) return;
  dlna = new RicevitoreDLNA({ uuid: imp.get('uuid'), nome: imp.get('nomeRicevitore'), porta, ip: indirizzoLocale(), log });
  dlna.on('comando', (tipo, dati) => {
    if (tipo === 'carica') { chiudiVista(); if (attivo === 'edge') chiudiEdge(); attivo = 'launcher'; inPrimoPiano(); }
    invia('player', tipo, dati);
  });
  dlna.on('stato', (s) => invia('stato-dlna', { trasporto: s.trasporto, titolo: s.titolo }));
  dlna.avvia();
}
// ---------- Edge dentro Salotto ----------
// Stessa tecnica del video AirPlay: la finestra di Edge (a schermo intero) diventa figlia di quella di Salotto.
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

function fermaEdgeIncastrato() {
  giroEdge++;
  if (canaleEdge) { canaleEdge.chiudi(); canaleEdge = null; }
  clearInterval(controlloEdge); controlloEdge = null;
  finestraEdge = null;
}

async function incastraEdge(nome) {
  const mio = ++giroEdge;
  for (let i = 0; i < 100; i++) { // fino a ~20 secondi: Edge al primo avvio può essere lento
    await pausa(200);
    if (mio !== giroEdge || attivo !== 'edge') return;
    // Di solito basta cercare la finestra di Edge nuova (veloce); ogni tanto anche col profilo salotto-edge (più lento).
    let h = await tastiera.nuovaEdge();
    if ((!h || h === '0') && i % 10 === 9) h = await tastiera.finestraEdge();
    if (mio !== giroEdge || attivo !== 'edge') return;
    if (!h || h === '0') continue;
    const esito = await tastiera.incastra(h, handleSalotto());
    log(`Edge: ${nome} dentro Salotto: ${esito || 'nessuna risposta'}`);
    if (esito !== 'ok') { log('Edge: resta come finestra separata'); invia('app-aperta'); return; }
    finestraEdge = h;
    inPrimoPiano();
    tastiera.fuoco(h);
    setTimeout(() => { if (finestraEdge === h) tastiera.fuoco(h); }, 600);
    clearInterval(controlloEdge);
    controlloEdge = setInterval(() => controllaEdge(mio), 1500);
    invia('app-aperta');
    return;
  }
  log(`Edge: finestra di ${nome} non trovata, resta separata`);
  invia('app-aperta');
}

let controlloEdgeInCorso = false;
async function controllaEdge(mio) {
  if (controlloEdgeInCorso || mio !== giroEdge || !finestraEdge) return;
  controlloEdgeInCorso = true;
  try {
    const r = await tastiera.mantieni(finestraEdge, handleSalotto());
    if (mio !== giroEdge) return;
    if (r === 'sparita') {
      log('Edge: chiuso, torno alla home');
      fermaEdgeIncastrato();
      if (attivo === 'edge') { attivo = 'launcher'; inPrimoPiano(); invia('home'); }
    } else if (r && r.startsWith('rifatto')) log('Edge: era uscito da Salotto, rimesso dentro: ' + r);
  } finally { controlloEdgeInCorso = false; }
}

// ---------- AirPlay (uxplay-windows) ----------
function statoAirPlay() { return { attivo: Boolean(imp.get('airplay')), installato: airplay.installato(), windows: WINDOWS, mac: MAC }; }

async function avviaAirPlay() {
  clearInterval(sorveglianza); sorveglianza = null;
  if (!WINDOWS) return;
  if (!imp.get('airplay')) return; // spento in Salotto: non si sorveglia più (uxplay-windows resta com'è)
  const r = await airplay.avvia(imp.get('nomeRicevitore'));
  // Anche se il programma non si trova (o l'ha acceso l'utente), si controlla lo stesso se arriva un video.
  if (!r.ok) log('AirPlay: uxplay-windows non trovato, controllo comunque se arriva un video');
  sorveglianza = setInterval(controllaAirPlay, 2000);
}

// Ogni 2 secondi: se compare la finestra del video AirPlay, la si incastra dentro Salotto (senza bordi,
// a tutto schermo); quando il telefono smette la finestra sparisce e si torna alla home.
let controlloInCorso = false;
let senzaConnessioni = 0;     // controlli di fila senza connessioni con l'iPhone
let vistoConnesso = false;    // la connessione con l'iPhone è stata vista almeno una volta (sennò non ci si fida del conteggio)
let sessioneFinita = false;   // la finestra del video esiste ancora ma la trasmissione è finita
let ultimoStato = '';
async function controllaAirPlay() {
  if (controlloInCorso || !win) return;
  controlloInCorso = true;
  try {
    if (videoAirPlay) {
      const st = await tastiera.statoVideo(videoAirPlay);
      if (!st) return; // nessuna risposta: si riprova al giro dopo
      const riassunto = `${st.esiste ? 'esiste' : 'sparita'} ${st.visibile ? 'visibile' : 'nascosta'} conn=${st.connessioni}`;
      if (riassunto !== ultimoStato) { log('AirPlay: finestra del video ' + riassunto); ultimoStato = riassunto; }
      if (!st.esiste) { videoAirPlay = null; sessioneFinita = false; fineAirPlay('la finestra è sparita'); return; }
      if (st.connessioni > 0) vistoConnesso = true;
      senzaConnessioni = st.connessioni ? 0 : senzaConnessioni + 1;
      const chiusa = vistoConnesso && senzaConnessioni >= 2;
      if (sessioneFinita || airplayInDisparte) {
        // Video nascosto: se l'iPhone ricomincia a trasmettere nella stessa finestra, la si rimette dentro Salotto.
        if (sessioneFinita && st.connessioni > 0) { sessioneFinita = false; await mostraVideoAirPlay(videoAirPlay, 'ricomincia la trasmissione'); }
        else if (airplayInDisparte && chiusa) { airplayInDisparte = false; sessioneFinita = true; tastiera.nascondi(videoAirPlay); }
        else if (!sessioneFinita) { /* in disparte: resta nascosto */ }
      } else if (attivo === 'airplay') {
        if (!st.visibile) { sessioneFinita = true; fineAirPlay('finestra nascosta da uxplay-windows'); return; }
        if (chiusa) { sessioneFinita = true; tastiera.nascondi(videoAirPlay); fineAirPlay('l\'iPhone ha chiuso la connessione'); return; }
        // Il video può cambiare misura da solo (es. iPhone ruotato): lo si riporta grande quanto Salotto.
        tastiera.adatta(videoAirPlay, handleSalotto());
        return;
      }
      if (!sessioneFinita) return;
    }
    // Nuova finestra del video (anche se una vecchia è ancora nascosta dentro Salotto).
    const h = await tastiera.videoAirPlay();
    if (!h || h === '0' || h === videoAirPlay) return;
    videoAirPlay = h;
    sessioneFinita = false;
    await mostraVideoAirPlay(h, 'arriva un video');
  } finally { controlloInCorso = false; }
}

async function mostraVideoAirPlay(h, motivo) {
  log(`AirPlay: ${motivo}, lo metto dentro Salotto`);
  chiudiVista();
  if (attivo === 'edge') await chiudiEdge();
  airplayInDisparte = false;
  senzaConnessioni = 0;
  vistoConnesso = false;
  attivo = 'airplay';
  inPrimoPiano();
  const esito = await tastiera.incastra(h, handleSalotto());
  log('AirPlay: inserimento nel riquadro di Salotto: ' + (esito || 'nessuna risposta'));
  if (esito && esito.startsWith('errore 5')) {
    log('AirPlay: Windows blocca l\'inserimento: uxplay-windows ha più permessi di Salotto (avviato come amministratore?)');
    invia('avviso', 'Il video AirPlay non può entrare in Salotto: chiudi uxplay-windows e riaprilo normalmente, non come amministratore');
  }
}

function fineAirPlay(motivo) {
  log('AirPlay: fine del video (' + motivo + ')');
  airplayInDisparte = false;
  if (attivo === 'airplay') { attivo = 'launcher'; inPrimoPiano(); invia('home'); }
}

function fermaDLNA() { if (dlna) { dlna.ferma(); dlna.removeAllListeners(); dlna = null; } }

function registraTastoHome() {
  globalShortcut.unregisterAll();
  const t = imp.get('tastoHome');
  try { if (t && !globalShortcut.register(t, vaiHome)) log('tasto Home non registrato: ' + t); } catch (e) { log('tasto Home non valido: ' + e.message); }
}

// ---------- IPC dall'interfaccia ----------
const CHIAVI_MODIFICABILI = new Set(['nome', 'app', 'avvioConWindows', 'dlna', 'airplay', 'edgeDentro', 'nomeRicevitore', 'tastoHome', 'home', 'drmInterno']);

function appValida(a) {
  if (!a || typeof a !== 'object') return null;
  const modo = ['edge', 'interna', 'link', 'programma'].includes(a.modo) ? a.modo : 'edge';
  const pulita = {
    id: String(a.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'app' + Date.now(),
    nome: String(a.nome || 'App').slice(0, 40),
    url: String(a.url || '').slice(0, 2000),
    modo,
    colore: /^#[0-9a-f]{6}$/i.test(a.colore) ? a.colore : '#3b4252',
  };
  if (a.agente) pulita.agente = String(a.agente).slice(0, 400);
  if (a.sito && /^https?:\/\//i.test(a.sito)) pulita.sito = String(a.sito).slice(0, 300);
  if (modo === 'programma') { pulita.percorso = String(a.percorso || '').slice(0, 500); pulita.argomenti = String(a.argomenti || '').slice(0, 500); }
  else if (modo === 'link') { if (!/^[a-z][a-z0-9+.-]*:/i.test(pulita.url)) return null; }
  else if (!/^https?:\/\//i.test(pulita.url)) return null;
  return pulita;
}

function registraIPC() {
  ipcMain.handle('impostazioni', () => ({ ...imp.pubbliche(), piattaforma: process.platform, edge: Boolean(percorsoEdge()), versione: app.getVersion(), widevine: Boolean(components) }));
  ipcMain.handle('salva', (_e, chiave, valore) => {
    if (!CHIAVI_MODIFICABILI.has(chiave)) return false;
    if (chiave === 'app') {
      if (!Array.isArray(valore)) return false;
      const ids = new Set();
      valore = valore.map(appValida).filter((a) => a && !ids.has(a.id) && ids.add(a.id)).slice(0, 60);
      // Se un'app cambia indirizzo, il logo scaricato non vale più.
      for (const a of valore) { const v = imp.get('app').find((x) => x.id === a.id); if (v && (v.url !== a.url || v.sito !== a.sito)) loghi.dimentica(a.id); }
    }
    if (chiave === 'nome' || chiave === 'nomeRicevitore') valore = String(valore || '').trim().slice(0, 40) || imp.get(chiave);
    if (chiave === 'home') {
      if (!valore || typeof valore !== 'object') return false;
      valore = Object.fromEntries(['carosello', 'film', 'serie', 'servizi', 'salotto'].map((k) => [k, valore[k] !== false]));
    }
    if (chiave === 'avvioConWindows' || chiave === 'dlna' || chiave === 'airplay' || chiave === 'edgeDentro' || chiave === 'drmInterno') valore = Boolean(valore);
    imp.set(chiave, valore);
    if (chiave === 'avvioConWindows') app.setLoginItemSettings({ openAtLogin: valore });
    if (chiave === 'dlna' || chiave === 'nomeRicevitore') avviaDLNA();
    if (chiave === 'airplay' || chiave === 'nomeRicevitore') avviaAirPlay();
    if (chiave === 'tastoHome') registraTastoHome();
    return true;
  });
  ipcMain.handle('apri', (_e, id, extra) => apriApp(id, extra));
  // Film e Serie TV (TMDB)
  const tipoValido = (t) => t === 'movie' || t === 'tv';
  ipcMain.handle('tmdb-schermata', async (_e, tipo) => {
    if (!tipoValido(tipo)) return { ok: false, errore: 'tipo non valido' };
    if (!tmdb.attivo()) return { ok: false, manca: true };
    try { return { ok: true, ...(await tmdb.schermata(tipo, imp.get('app').map((a) => a.id))) }; } catch (e) { log('tmdb: ' + e.message); return { ok: false, errore: e.message }; }
  });
  ipcMain.handle('tmdb-home', async () => {
    if (!tmdb.attivo()) return { ok: false, manca: true };
    try { return { ok: true, ...(await tmdb.home(imp.get('app').map((a) => a.id))) }; } catch (e) { log('tmdb: ' + e.message); return { ok: false, errore: e.message }; }
  });
  ipcMain.handle('tmdb-dettagli', async (_e, tipo, id) => {
    if (!tipoValido(tipo) || !Number.isInteger(id) || id <= 0) return { ok: false, errore: 'titolo non valido' };
    try { return { ok: true, ...(await tmdb.dettagli(tipo, id)) }; } catch (e) { log('tmdb: ' + e.message); return { ok: false, errore: e.message }; }
  });
  ipcMain.handle('tmdb-chiave', async (_e, chiave) => {
    chiave = String(chiave || '').trim();
    if (!chiave) { imp.set('tmdbChiave', ''); tmdb.dimentica(); log('tmdb: chiave tolta'); return { ok: true }; }
    if (!/^[\w.-]{20,400}$/.test(chiave)) return { ok: false, errore: 'Non sembra una chiave TMDB: controlla di averla copiata tutta' };
    const r = await tmdb.prova(chiave);
    if (!r.ok) return { ok: false, errore: /non valida/.test(r.errore) ? 'TMDB dice che la chiave non è valida' : 'Non riesco a raggiungere TMDB: ' + r.errore };
    imp.set('tmdbChiave', chiave); tmdb.dimentica(); log('tmdb: chiave salvata');
    return { ok: true };
  });
  ipcMain.handle('esiste', (_e, p, nome) => {
    // Sul Mac i programmi dello Store (Kodi, VLC) si cercano in Applicazioni col loro nome.
    if (MAC) return typeof nome === 'string' && /^[\w .+-]{1,40}$/.test(nome) && fs.existsSync(path.join('/Applications', nome + '.app'));
    return typeof p === 'string' && /\.exe$/i.test(p) && fs.existsSync(p);
  });
  ipcMain.handle('home', () => vaiHome());
  ipcMain.handle('stato-airplay', () => statoAirPlay());
  // Schermata "Programmi": elenco dal menu Start; le icone mancanti arrivano dopo (evento programmi-icone).
  ipcMain.handle('programmi', () => {
    const { lista, mancanti } = programmi.elenco();
    if (mancanti.length) programmi.icone(mancanti).then((n) => n && invia('programmi-icone'));
    return lista;
  });
  // Bluetooth: solo queste azioni; l'id del dispositivo arriva dall'elenco che Salotto stesso ha mostrato.
  ipcMain.handle('bluetooth', (_e, azione, id) => {
    if (!['radio', 'abbinati', 'cerca', 'accendi', 'spegni', 'abbina', 'dimentica'].includes(azione)) return { ok: false, errore: 'azione non valida' };
    if ((azione === 'abbina' || azione === 'dimentica') && (typeof id !== 'string' || id.length > 300)) return { ok: false, errore: 'dispositivo non valido' };
    return bluetooth.esegui(azione, id);
  });
  ipcMain.handle('impostazioni-bluetooth-windows', () => (WINDOWS ? shell.openExternal('ms-settings:bluetooth')
    : MAC ? shell.openExternal('x-apple.systempreferences:com.apple.BluetoothSettings') : false));
  ipcMain.handle('apri-programma', async (_e, id) => {
    const p = programmi.percorso(id);
    if (!p) return { ok: false, errore: 'Programma non trovato' };
    log('apro il programma ' + path.basename(p));
    chiudiVista();
    if (attivo === 'edge') await chiudiEdge();
    attivo = 'launcher';
    const errore = await shell.openPath(p);
    return errore ? { ok: false, errore } : { ok: true };
  });
  // Mac: il ricevitore AirPlay è già nel sistema (Impostazioni → Generali → AirDrop e Handoff).
  ipcMain.handle('apri-sito-airplay', () => shell.openExternal(MAC ? 'x-apple.systempreferences:com.apple.AirDrop-Handoff-Settings.extension' : 'https://github.com/leapbtw/uxplay-windows/releases/latest'));
  // Loghi scaricati dai siti per le app che non hanno un logo già dentro Salotto.
  ipcMain.handle('loghi', (_e, ids) => {
    const fuori = {};
    if (!Array.isArray(ids)) return fuori;
    for (const id of ids.slice(0, 60)) {
      const a = imp.get('app').find((x) => x.id === id);
      if (!a) continue;
      const d = loghi.dataUrl(a.id);
      if (d) fuori[a.id] = d;
      else loghi.prendi(a).then((ok) => ok && invia('loghi-nuovi'));
    }
    return fuori;
  });
  ipcMain.handle('info-telecomando', async () => {
    const ip = indirizzoLocale();
    if (dlna && dlna.ip !== ip) avviaDLNA();
    const url = `http://${ip}:${porta}/`;
    return { url, pin: imp.get('pin'), qr: await QRCode.toDataURL(url, { margin: 1, width: 360 }), collegati: telecomando.collegati(), attivo: Boolean(server) };
  });
  ipcMain.handle('nuovo-pin', () => { imp.set('pin', String(require('crypto').randomInt(1000, 10000))); telecomando.dimentica(); return imp.get('pin'); });
  ipcMain.on('player-stato', (_e, s) => { if (dlna && s && typeof s === 'object') dlna.aggiorna({
    trasporto: ['STOPPED', 'PLAYING', 'PAUSED_PLAYBACK', 'TRANSITIONING', 'NO_MEDIA_PRESENT'].includes(s.trasporto) ? s.trasporto : dlna.stato.trasporto,
    posizione: Number(s.posizione) || 0, durata: Number(s.durata) || 0,
    volume: Number.isFinite(Number(s.volume)) ? Math.round(Number(s.volume)) : dlna.stato.volume, muto: Boolean(s.muto),
  }); });
  ipcMain.handle('energia', async (_e, azione) => {
    log('energia: ' + azione);
    if (azione === 'esci') { app.quit(); return true; }
    if (MAC) {
      const c = { sospendi: ['pmset', ['sleepnow']],
        riavvia: ['osascript', ['-e', 'tell application "System Events" to restart']],
        spegni: ['osascript', ['-e', 'tell application "System Events" to shut down']] }[azione];
      if (!c) return false;
      execFile(c[0], c[1], () => {});
      return true;
    }
    if (!WINDOWS) return false;
    const comandi = {
      sospendi: ['rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']],
      riavvia: ['shutdown.exe', ['/r', '/t', '0']],
      spegni: ['shutdown.exe', ['/s', '/t', '0']],
    };
    const c = comandi[azione];
    if (!c) return false;
    execFile(c[0], c[1], { windowsHide: true }, () => {});
    return true;
  });
}

// ---------- avvio ----------
app.whenReady().then(async () => {
  fileLog = path.join(app.getPath('userData'), 'salotto.log');
  imp = new Impostazioni(app.getPath('userData'));
  log(`avvio Salotto ${app.getVersion()} su ${process.platform}`);
  widevinePronto = preparaWidevine();
  tastiera = new Tastiera(app.getPath('userData'), log);
  tastiera.avvia();
  airplay = new AirPlay(app.getPath('userData'), log);
  loghi = new Loghi(app.getPath('userData'), log);
  programmi = new Programmi(app.getPath('userData'), log);
  bluetooth = new Bluetooth(app.getPath('userData'), log);
  tmdb = new Tmdb(() => imp.get('tmdbChiave'), log);
  telecomando = new Telecomando(imp, (cmd, m) => comando(cmd, m), (n) => invia('telefoni', n));
  registraIPC();
  // Le pagine delle app non possono chiedere permessi strani (webcam, posizione...): solo notifiche e media protetti.
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(['fullscreen', 'mediaKeySystem'].includes(perm)));
  creaFinestra();
  server = await avviaServer(imp.get('porta'));
  avviaDLNA();
  avviaAirPlay();
  registraTastoHome();
});

app.on('second-instance', () => inPrimoPiano());
app.on('will-quit', () => {
  log('chiusura');
  globalShortcut.unregisterAll();
  fermaDLNA();
  clearInterval(sorveglianza);
  tastiera && tastiera.chiudi();
  try { server && server.close(); server && server.closeAllConnections(); } catch { /* già chiuso */ }
  // Se qualcosa trattiene il processo, dopo 2 secondi esce comunque: Salotto non deve restare in sottofondo.
  setTimeout(() => app.exit(0), 2000).unref();
});
app.on('window-all-closed', () => app.quit());
