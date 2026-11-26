// Salotto: launcher da TV. Navigazione con frecce/Invio/Esc (tastiera, telecomando USB o telefono).
'use strict';

// Nel browser (anteprima di sviluppo) non c'è Electron: un finto "tv" con dati di esempio.
const api = window.tv || (() => {
  const nulla = () => () => {};
  let dati = {
    nome: 'Salotto', versione: '0.0 (anteprima)', piattaforma: 'browser', edge: false, avvioConWindows: false, dlna: true, airplay: true, edgeDentro: true, nomeRicevitore: 'Salotto (PC)', tastoHome: 'Control+Alt+H', telefoniAbbinati: 0,
    app: [
      { id: 'youtube', nome: 'YouTube', url: 'https://www.youtube.com/tv', modo: 'interna', colore: '#e5322d' },
      { id: 'netflix', nome: 'Netflix', url: 'https://www.netflix.com/browse', modo: 'edge', colore: '#b1060f' },
      { id: 'prime', nome: 'Prime Video', url: 'https://www.primevideo.com', modo: 'edge', colore: '#1a98ff' },
      { id: 'disney', nome: 'Disney+', url: 'https://www.disneyplus.com', modo: 'edge', colore: '#113ccf' },
      { id: 'raiplay', nome: 'RaiPlay', url: 'https://www.raiplay.it', modo: 'edge', colore: '#0a4ea2' },
      { id: 'spotify', nome: 'Spotify', url: 'https://open.spotify.com', modo: 'edge', colore: '#1db954' },
    ],
  };
  return {
    impostazioni: async () => structuredClone(dati),
    salva: async (k, v) => { dati[k] = v; return true; },
    apri: async (id) => { console.log('apri', id); return { ok: true }; },
    esiste: async () => false,
    home: async () => {}, energia: async (a) => { console.log('energia', a); return false; },
    infoTelecomando: async () => ({ url: 'http://192.168.1.20:8765/', pin: '4821', qr: '', collegati: 0, attivo: true }),
    nuovoPin: async () => '1234', statoLettore: () => {},
    suTelecomando: nulla, suHome: nulla, suLettore: nulla, suTelefoni: nulla, suStatoDLNA: nulla,
    statoAirPlay: async () => ({ attivo: dati.airplay, installato: false, windows: false }), apriSitoAirPlay: async () => {},
    loghi: async () => ({}), suLoghiNuovi: nulla, suAvviso: nulla, suAppAperta: nulla,
    programmi: async () => ['Kodi', 'VLC media player', 'Steam', 'Spotify', 'Calcolatrice', 'Paint', 'Blocco note', 'Microsoft Edge', 'Esplora file', 'Xbox']
      .map((nome, i) => ({ id: 'p' + i, nome, icona: '' })),
    apriProgramma: async () => ({ ok: true }), suProgrammiIcone: nulla,
    bluetooth: async (azione, id) => {
      await new Promise((r) => setTimeout(r, azione === 'cerca' ? 1200 : 300));
      const bt = (window.__btFinto = window.__btFinto || { acceso: true, abbinati: [
        { id: 'a1', nome: 'Controller Xbox', abbinato: true, connesso: true, categoria: 'Input.Gamepad' },
        { id: 'a2', nome: 'Cuffie WH-1000XM5', abbinato: true, connesso: false, categoria: 'Audio.Headphones' }],
        vicini: [{ id: 'v1', nome: 'Soundbar JBL', abbinato: false, connesso: false, categoria: 'Audio.Speaker' },
          { id: 'v2', nome: 'Tastiera K380', abbinato: false, connesso: false, categoria: 'Input.Keyboard' }] });
      if (azione === 'radio') return { ok: true, presente: true, acceso: bt.acceso };
      if (azione === 'abbinati') { await new Promise((r) => setTimeout(r, 1500)); return { ok: true, dispositivi: bt.abbinati }; }
      if (azione === 'accendi' || azione === 'spegni') { bt.acceso = azione === 'accendi'; return { ok: true, esito: 'Allowed', messaggio: 'Fatto' }; }
      if (azione === 'cerca') return { ok: true, dispositivi: bt.vicini };
      if (azione === 'abbina') { const d = bt.vicini.find((x) => x.id === id); if (d && /Tastiera/.test(d.nome)) return { ok: true, esito: 'RequiredHandlerNotRegistered', messaggio: 'Questo dispositivo chiede un PIN: abbinalo dalle impostazioni di Windows' };
        bt.vicini = bt.vicini.filter((x) => x !== d); bt.abbinati.push({ ...d, abbinato: true }); return { ok: true, esito: 'Paired', messaggio: 'Abbinato' }; }
      if (azione === 'dimentica') { bt.abbinati = bt.abbinati.filter((x) => x.id !== id); return { ok: true, esito: 'Unpaired', messaggio: 'Dimenticato' }; }
      return { ok: false, errore: 'azione' };
    },
    impostazioniBluetoothWindows: async () => false,
    // Film e serie finti (locandine disegnate): il catalogo vero arriva da TMDB solo nell'app.
    tmdbChiave: async (k) => { await new Promise((r) => setTimeout(r, 500)); if (k && String(k).trim().length < 20) return { ok: false, errore: 'Non sembra una chiave TMDB: controlla di averla copiata tutta' }; dati.tmdbAttivo = Boolean(k); return { ok: true }; },
    tmdbSchermata: async (tipo) => {
      await new Promise((r) => setTimeout(r, 700));
      if (!dati.tmdbAttivo) return { ok: false, manca: true };
      const colori = ['#7a2e2e', '#2e4f7a', '#2e7a5a', '#6a2e7a', '#7a5a2e', '#2e6f7a', '#4a4a6a'];
      const img = (t, i, w, h) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colori[i % 7]}"/><stop offset="1" stop-color="#111"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="${w > h ? 62 : 80}%" fill="#fff" font-family="sans-serif" font-size="${w > h ? 64 : 34}" font-weight="700" text-anchor="middle">${t}</text></svg>`);
      const voce = (i) => ({ id: i + 1, tipo, titolo: (tipo === 'movie' ? 'Film ' : 'Serie ') + (i + 1), anno: String(2026 - (i % 6)), trama: 'Una trama di esempio per vedere come appare il testo nel carosello e nella scheda del titolo, lunga un paio di righe.', voto: 6 + (i % 4) / 2, poster: img(String(i + 1), i, 342, 513), sfondo: img((tipo === 'movie' ? 'Film ' : 'Serie ') + (i + 1), i, 1280, 720) });
      const file = ['Di tendenza questa settimana', 'Su Netflix', 'Su Prime Video', 'Su Disney+', tipo === 'movie' ? 'Al cinema' : 'In onda ora', 'I più votati', 'Commedie', 'Animazione']
        .map((titolo, f) => ({ titolo, voci: Array.from({ length: 14 }, (_, i) => voce(f * 14 + i)) }));
      return { ok: true, eroe: file[0].voci.slice(0, 6), file };
    },
    tmdbDettagli: async (tipo, id) => {
      await new Promise((r) => setTimeout(r, 500));
      const v = (await api.tmdbSchermata(tipo)).file.flatMap((f) => f.voci).find((x) => x.id === id);
      return { ok: true, ...v, generi: ['Commedia', 'Dramma'], durata: tipo === 'movie' ? '1 h 52 min' : '', stagioni: tipo === 'tv' ? '3 stagioni' : '',
        dove: [{ nome: 'Netflix', logo: '', app: 'netflix' }, { nome: 'Amazon Prime Video', logo: '', app: 'prime' }, { nome: 'NOW', logo: '', app: 'now' }], noleggio: [], trailer: 'abcdefghijk' };
    },
  };
})();

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let imp = null;
const MODI = {
  edge: ['Edge a schermo intero', 'Per Netflix, Prime, Disney+: video protetti in alta qualità'],
  interna: ['Dentro Salotto', 'Per siti senza video protetti (es. YouTube per TV)'],
  link: ['Collegamento', 'Indirizzi speciali, es. steam://open/bigpicture'],
  programma: ['Programma', 'Un .exe sul PC (es. Kodi, VLC)'],
};
const COLORI = ['#e5322d', '#b1060f', '#ff7a1a', '#e2b100', '#1db954', '#14a39a', '#1a98ff', '#113ccf', '#5b3cc4', '#9146ff', '#d63384', '#1c1c3c', '#3b4252'];

// ---------- avvisi ----------
let timerAvviso;
function avviso(testo, ms = 3200) {
  const el = $('#avviso');
  el.textContent = testo;
  el.classList.add('visibile');
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => el.classList.remove('visibile'), ms);
}

// ---------- orologio ----------
function orologio() {
  const d = new Date();
  $('#ora').textContent = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  $('#data').textContent = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const h = d.getHours();
  $('#saluto').textContent = h < 5 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

// ---------- navigazione spaziale ----------
function ambito() { return $('#pannello').hidden ? $('#home') : $('#scheda'); }
function focalizzabili() {
  return $$('.f', ambito()).filter((el) => !el.disabled && el.offsetParent !== null);
}
// L'elemento scelto si tiene a parte: resta evidenziato anche se la finestra non ha il fuoco di Windows.
let corrente = null;
function attuale_() { return corrente && document.contains(corrente) ? corrente : document.activeElement; }
function metti(el) {
  if (!el) return;
  if (corrente) corrente.classList.remove('fuoco');
  corrente = el;
  el.classList.add('fuoco');
  el.focus({ preventScroll: true });
  if (el.classList.contains('tab')) mostraSchermata(el.dataset.schermata);
  // Nelle file orizzontali la tessera scelta resta sempre intera, con un po' di margine (anche ingrandita).
  const fila = el.closest('.fila');
  if (fila) {
    const margine = fila.clientWidth * 0.08;
    const sx = el.offsetLeft, dx = sx + el.offsetWidth;
    let x = fila.scrollLeft;
    if (sx - margine < x) x = sx - margine;
    else if (dx + margine > x + fila.clientWidth) x = dx + margine - fila.clientWidth;
    fila.scrollTo({ left: Math.max(0, x), behavior: 'smooth' });
    const riga = el.closest('.catalogo .riga');
    if (riga) riga.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function sposta(dir) {
  const tutti = focalizzabili();
  if (!tutti.length) return;
  const att = attuale_();
  if (!tutti.includes(att)) { metti(tutti[0]); return; }
  const a = att.getBoundingClientRect();
  const ac = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  let migliore = null, punti = Infinity;
  for (const el of tutti) {
    if (el === att) continue;
    const r = el.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    let principale, laterale;
    if (dir === 'right') { if (r.left < a.right - 4 && c.x <= ac.x + 4) continue; principale = c.x - ac.x; laterale = Math.abs(c.y - ac.y); }
    if (dir === 'left') { if (r.right > a.left + 4 && c.x >= ac.x - 4) continue; principale = ac.x - c.x; laterale = Math.abs(c.y - ac.y); }
    if (dir === 'down') { if (r.top < a.bottom - 4 && c.y <= ac.y + 4) continue; principale = c.y - ac.y; laterale = Math.abs(c.x - ac.x); }
    if (dir === 'up') { if (r.bottom > a.top + 4 && c.y >= ac.y - 4) continue; principale = ac.y - c.y; laterale = Math.abs(c.x - ac.x); }
    if (principale <= 0) continue;
    // Le righe sopra/sotto pesano di più lo scarto laterale: si va "dritti".
    const p = principale + laterale * (dir === 'up' || dir === 'down' ? 0.6 : 3);
    if (p < punti) { punti = p; migliore = el; }
  }
  if (migliore) metti(migliore);
}

// ---------- loghi ----------
// Prima quelli già dentro Salotto (loghi/indice.js), poi quelli scaricati dal sito dell'app.
let loghiScaricati = {};
const logoDi = (a) => a.logo || (window.LOGHI || {})[a.id] || loghiScaricati[a.id] || null;
const imgLogo = (a, classe = 'logo-app') => { const src = logoDi(a); return src ? `<img class="${classe}" src="${escHtml(src)}" alt="" draggable="false">` : ''; };
async function caricaLoghi() {
  const mancano = imp.app.filter((a) => !(window.LOGHI || {})[a.id]).map((a) => a.id);
  if (!mancano.length) return;
  const nuovi = await api.loghi(mancano);
  if (Object.keys(nuovi).some((id) => nuovi[id] !== loghiScaricati[id])) { loghiScaricati = { ...loghiScaricati, ...nuovi }; disegnaApp(); }
}

// ---------- launcher ----------
function disegnaApp() {
  const fila = $('#fila-app');
  const idFuoco = corrente && corrente.dataset ? corrente.dataset.app : null;
  fila.innerHTML = imp.app.map((a) => `
    <button class="f tessera app ${logoDi(a) ? 'con-logo' : ''}" data-app="${escHtml(a.id)}" style="--colore:${escHtml(a.colore)}">
      ${imgLogo(a)}
      <span class="nome">${escHtml(a.nome)}</span>
      <span class="modo">${a.modo === 'edge' || a.modo === 'interna' ? '' : MODI[a.modo]?.[0] || ''}</span>
    </button>`).join('') || '<p class="sotto">Nessuna app: aggiungine qualcuna dallo Store.</p>';
  // Ridisegnando, il riquadro col fuoco non deve perderlo.
  if (idFuoco && schermata === 'home') { const t = fila.querySelector(`[data-app="${CSS.escape(idFuoco)}"]`); if (t) metti(t); }
  if (schermata === 'app') disegnaGrigliaApp();
  caricaLoghi();
}

// ---------- schermate (schede in alto, come sulle TV) ----------
let schermata = 'home';
function mostraSchermata(nome) {
  if (!nome || nome === schermata) return;
  schermata = nome;
  $$('#home .schermata').forEach((s) => { s.hidden = s.dataset.schermata !== nome; });
  $$('#schede .tab').forEach((t) => t.classList.toggle('attiva', t.dataset.schermata === nome));
  if (nome === 'app') disegnaGrigliaApp();
  if (nome === 'programmi') caricaProgrammi();
  if (nome === 'film' || nome === 'serie') mostraCatalogo(nome === 'film' ? 'movie' : 'tv');
}
const tessereApp = (lista) => lista.map((a) => `
  <button class="f tessera app ${logoDi(a) ? 'con-logo' : ''}" data-app="${escHtml(a.id)}" style="--colore:${escHtml(a.colore)}">
    ${imgLogo(a)}
    <span class="nome">${escHtml(a.nome)}</span>
    <span class="modo">${a.modo === 'edge' || a.modo === 'interna' ? '' : MODI[a.modo]?.[0] || ''}</span>
  </button>`).join('');
function disegnaGrigliaApp() {
  const g = $('#griglia-app');
  const idFuoco = corrente && g.contains(corrente) ? corrente.dataset.app : null;
  g.innerHTML = tessereApp(imp.app) + `
    <button class="f tessera strumento" data-azione="store"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>Aggiungi app</span><small>Dallo Store</small></button>`;
  if (idFuoco) { const t = g.querySelector(`[data-app="${CSS.escape(idFuoco)}"]`); if (t) metti(t); }
}

let programmi = null; // programmi del PC (dal menu Start), caricati la prima volta che si apre la scheda
async function caricaProgrammi(forza = false) {
  if (programmi && !forza) { disegnaProgrammi(); return; }
  $('#sotto-programmi').textContent = 'Cerco i programmi installati…';
  programmi = await api.programmi();
  disegnaProgrammi();
}
function disegnaProgrammi() {
  const g = $('#griglia-programmi');
  const idFuoco = corrente && g.contains(corrente) ? corrente.dataset.programma : null;
  $('#sotto-programmi').textContent = programmi.length
    ? `${programmi.length} programmi dal menu Start di Windows. OK per aprirli.`
    : (imp.piattaforma === 'win32' ? 'Nessun programma trovato nel menu Start.' : 'I programmi del PC si vedono solo su Windows.');
  g.innerHTML = programmi.map((p) => `
    <button class="f tessera programma" data-programma="${escHtml(p.id)}" title="${escHtml(p.nome)}">
      ${p.icona ? `<img class="icona-programma" src="${escHtml(p.icona)}" alt="" draggable="false">` : `<span class="icona-programma iniziale">${escHtml(p.nome.slice(0, 1))}</span>`}
      <span class="nome">${escHtml(p.nome)}</span>
    </button>`).join('');
  if (idFuoco) { const t = g.querySelector(`[data-programma="${CSS.escape(idFuoco)}"]`); if (t) metti(t); }
}
async function apriProgramma(id) {
  const p = (programmi || []).find((x) => x.id === id);
  if (!p) return;
  mostraApertura({ id: 'prog-' + id, nome: p.nome, colore: '#262b38', logo: p.icona }, $(`[data-programma="${CSS.escape(id)}"]`));
  const r = await api.apriProgramma(id);
  setTimeout(nascondiApertura, 2500);
  if (!r.ok) { nascondiApertura(); avviso(r.errore || 'Non riesco ad aprire il programma'); }
}

// ---------- apertura di un'app: animazione stile TV ----------
// Il riquadro dell'app si allarga fino a riempire lo schermo, poi logo e puntini finché l'app è pronta.
let fineApertura = null;
function mostraApertura(a, tessera) {
  const el = $('#apertura');
  el.style.setProperty('--colore', a.colore || '#222');
  $('#apertura-logo').innerHTML = logoDi(a) ? imgLogo(a, '') : `<span class="solo-nome">${escHtml(a.nome)}</span>`;
  $('#apertura-nome').textContent = logoDi(a) ? a.nome : '';
  el.hidden = false;
  const r = tessera ? tessera.getBoundingClientRect() : null;
  const W = window.innerWidth, H = window.innerHeight;
  const partenza = r ? `translate(${r.left}px, ${r.top}px) scale(${r.width / W}, ${r.height / H})` : 'scale(.92)';
  el.animate([
    { transform: partenza, borderRadius: '1.1rem', opacity: r ? 1 : 0 },
    { transform: 'none', borderRadius: '0', opacity: 1 },
  ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  $('.apertura-centro', el).animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }],
    { duration: 380, delay: 220, easing: 'ease-out', fill: 'backwards' });
  clearTimeout(fineApertura);
  fineApertura = setTimeout(nascondiApertura, 20000); // sicurezza: non resta mai bloccata
}
function nascondiApertura() {
  clearTimeout(fineApertura);
  const el = $('#apertura');
  if (el.hidden) return;
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-in' }).onfinish = () => { el.hidden = true; };
}

async function apri(id) {
  const a = imp.app.find((x) => x.id === id);
  if (!a) return;
  mostraApertura(a, $(`[data-app="${CSS.escape(id)}"]`));
  const r = await api.apri(id);
  if (!r.ok) { nascondiApertura(); avviso(r.errore || 'Non riesco ad aprire l\'app'); return; }
  if (r.nota) avviso(r.nota);
  // Link e programmi esterni: Salotto non sa quando sono pronti.
  if (a.modo === 'link' || a.modo === 'programma' || imp.piattaforma !== 'win32' && a.modo === 'edge') setTimeout(nascondiApertura, 2500);
}
function tastoLeggibile() { return (imp.tastoHome || '').replace('Control', 'Ctrl').replace(/\+/g, ' + '); }

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-app], [data-azione], [data-programma], .tab');
  if (!t || !$('#home').contains(t)) return;
  if (t.classList.contains('tab')) {
    // OK su una scheda: si scende al primo riquadro della schermata
    mostraSchermata(t.dataset.schermata);
    const primo = $(`#home .schermata[data-schermata="${t.dataset.schermata}"] .f`);
    if (primo) metti(primo);
    return;
  }
  if (t.dataset.programma) apriProgramma(t.dataset.programma);
  else if (t.dataset.app) apri(t.dataset.app);
  else azioni[t.dataset.azione]?.();
});

// ---------- pannelli ----------
let fuocoPrima = null, chiudiPannelloExtra = null;
let indietroPannello = null; // se c'è, il tasto Indietro fa questo invece di chiudere il pannello (pagine delle Impostazioni)
function apriPannello(html, dopo) {
  fuocoPrima = $('#pannello').hidden ? document.activeElement : fuocoPrima;
  indietroPannello = null;
  $('#scheda').innerHTML = html;
  $('#scheda').className = 'scheda';
  $('#scheda').onclick = null; // i gestori dei clic restano della pagina che li ha messi
  $('#pannello').className = 'pannello';
  $('#pannello').hidden = false;
  if (dopo) dopo($('#scheda'));
  const primo = $('#scheda [data-primo]') || focalizzabili()[0];
  metti(primo);
}
function chiudiPannello() {
  if ($('#pannello').hidden) return;
  if (chiudiPannelloExtra) { chiudiPannelloExtra(); chiudiPannelloExtra = null; }
  indietroPannello = null;
  $('#pannello').hidden = true;
  $('#scheda').innerHTML = '';
  // Se il riquadro di prima non c'è più (schermata ridisegnata), si torna alla scheda della schermata attuale.
  if (fuocoPrima && document.contains(fuocoPrima)) metti(fuocoPrima); else metti($(`#schede .tab[data-schermata="${schermata}"]`) || focalizzabili()[0]);
}

const azioni = {
  async telecomando() {
    const info = await api.infoTelecomando();
    apriPannello(`
      <h1>Telecomando dal telefono</h1>
      <p class="sotto">Il telefono deve essere sulla stessa rete Wi‑Fi del PC.</p>
      <div class="telecomando-griglia">
        ${info.qr ? `<img class="qr" src="${info.qr}" alt="Codice QR">` : '<div class="qr"></div>'}
        <div>
          <ol class="passi">
            <li>Inquadra il codice con la fotocamera, oppure apri<br><span class="indirizzo">${escHtml(info.url)}</span></li>
            <li>Scrivi il PIN: <span class="pin">${escHtml(info.pin)}</span></li>
            <li>Aggiungi la pagina alla schermata Home: diventa un'app.</li>
          </ol>
          <p class="sotto" id="tel-collegati">${info.collegati ? `Telefoni collegati ora: <b>${info.collegati}</b>` : 'Nessun telefono collegato ora.'}</p>
          ${info.attivo ? '' : '<p class="sotto">Il telecomando non è attivo: la porta di rete è occupata. Guarda il log.</p>'}
        </div>
      </div>
      <div class="tasti">
        <button class="f tasto primario" data-primo data-p="chiudi">Fatto</button>
        <button class="f tasto" data-p="pin">Nuovo PIN (scollega i telefoni)</button>
      </div>`, (s) => {
      s.querySelector('[data-p="chiudi"]').onclick = chiudiPannello;
      s.querySelector('[data-p="pin"]').onclick = async () => { await api.nuovoPin(); azioni.telecomando(); avviso('PIN cambiato: i telefoni vanno ricollegati'); };
    });
  },

  async trasmetti() {
    const ap = await api.statoAirPlay();
    // Stesso nome che Salotto dà a uxplay-windows (senza spazi: vedi electron/airplay.cjs).
    const nomeAirPlay = String(imp.nomeRicevitore || 'Salotto').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'Salotto';
    const statoAp = !ap.windows ? 'Disponibile solo su Windows.'
      : !ap.installato ? 'Serve <b>uxplay-windows</b>, gratuito: installalo una volta col tasto qui sotto, poi riapri Salotto.'
      : ap.attivo ? `L'iPhone lo trova come “${escHtml(nomeAirPlay)}” in Duplica schermo o col tasto AirPlay.` : 'Spento.';
    apriPannello(`
      <h1>Trasmetti al PC</h1>
      <p class="sotto">Salotto fa da ricevitore <b>DLNA</b>: molte app del telefono trovano “${escHtml(imp.nomeRicevitore)}” tra i dispositivi e ci mandano video, musica e foto.
      Il Chromecast di Google usa un sistema chiuso che un PC non può ricevere.</p>
      <button class="f interruttore" role="switch" aria-checked="${imp.dlna}" data-primo data-p="dlna">
        <span><b>Ricevitore attivo</b><small>Si vede come “${escHtml(imp.nomeRicevitore)}” sulla rete di casa</small></span><span class="leva"></span>
      </button>
      <h3>App che funzionano (Android)</h3>
      <ol class="passi">
        <li><b>Web Video Caster</b> o <b>BubbleUPnP</b>: video dai siti e dal telefono</li>
        <li><b>VLC</b>: menu ⋯ → Trasmetti a… (per i file del telefono)</li>
        <li>La galleria di molti Samsung/Xiaomi: “Smart View / Trasmetti” verso dispositivi DLNA</li>
      </ol>
      <h3>iPhone, iPad e Mac: AirPlay</h3>
      <button class="f interruttore" role="switch" aria-checked="${imp.airplay}" data-p="airplay">
        <span><b>Ricevitore AirPlay</b><small id="stato-airplay">${statoAp}</small></span><span class="leva"></span>
      </button>
      ${ap.windows && !ap.installato ? '<div class="tasti"><button class="f tasto" data-p="scarica-airplay">Apri la pagina di uxplay-windows</button></div>' : ''}
      <ol class="passi">
        <li>Centro di Controllo → <b>Duplica schermo</b> → “${escHtml(nomeAirPlay)}”: si vede tutto lo schermo dell'iPhone</li>
        <li>Foto, video e musica: tasto <b>AirPlay</b> nell'app</li>
        <li>Netflix, Prime Video e Disney+ di solito non si vedono in AirPlay (schermo nero): aprili da Salotto</li>
      </ol>
      <p class="sotto">La prima volta Windows chiede se Salotto può usare la rete: scegli <b>Reti private</b>.</p>
      <div class="tasti"><button class="f tasto primario" data-p="chiudi">Fatto</button></div>`, (s) => {
      s.querySelector('[data-p="chiudi"]').onclick = chiudiPannello;
      const sw = s.querySelector('[data-p="dlna"]');
      sw.onclick = async () => { imp.dlna = !imp.dlna; sw.setAttribute('aria-checked', imp.dlna); await api.salva('dlna', imp.dlna); aggiornaChip(); };
      const swa = s.querySelector('[data-p="airplay"]');
      swa.onclick = async () => {
        imp.airplay = !imp.airplay; swa.setAttribute('aria-checked', imp.airplay); await api.salva('airplay', imp.airplay);
        if (ap.installato) avviso(imp.airplay ? 'AirPlay acceso' : 'Salotto non usa più AirPlay. Per spegnere del tutto uxplay-windows usa la sua icona vicino all\'orologio', 6000);
      };
      const sc = s.querySelector('[data-p="scarica-airplay"]');
      if (sc) sc.onclick = async () => { await api.apriSitoAirPlay(); avviso('Pagina aperta nel browser: scarica il file .msi e installalo, poi riapri Salotto', 7000); };
    });
  },

  aggiungi(app) { editorApp(app); },
  store() { apriStore(); },

  // impostazioni(): in impostazioni.js (pannello laterale stile TV)

  energia() {
    apriPannello(`
      <h1>Spegni</h1>
      <p class="sotto">Cosa vuoi fare?</p>
      <div class="tasti">
        <button class="f tasto" data-primo data-e="sospendi">Sospendi</button>
        <button class="f tasto" data-e="riavvia">Riavvia il PC</button>
        <button class="f tasto pericolo" data-e="spegni">Spegni il PC</button>
        <button class="f tasto" data-e="esci">Esci da Salotto</button>
        <button class="f tasto primario" data-e="annulla">Annulla</button>
      </div>`, (s) => {
      s.onclick = async (e) => {
        const b = e.target.closest('[data-e]'); if (!b) return;
        const a = b.dataset.e;
        if (a === 'annulla') { chiudiPannello(); return; }
        if ((a === 'spegni' || a === 'riavvia') && b.dataset.conferma !== '1') { b.dataset.conferma = '1'; b.textContent = 'Premi ancora per confermare'; return; }
        const ok = await api.energia(a);
        if (!ok) avviso('Disponibile solo su Windows');
      };
    });
  },
};

function editorApp(esistente) {
  const nuova = !esistente;
  const a = esistente ? { ...esistente } : { id: '', nome: '', url: 'https://', modo: 'edge', colore: COLORI[Math.floor(Math.random() * COLORI.length)] };
  apriPannello(`
    <h1>${nuova ? 'Aggiungi app' : 'Modifica ' + escHtml(a.nome)}</h1>
    <p class="sotto">Puoi scrivere anche dal telefono: apri il telecomando e usa la tastiera.</p>
    <div class="campo"><label for="ed-nome">Nome</label><input class="f" id="ed-nome" data-primo value="${escHtml(a.nome)}" maxlength="40" placeholder="Es. Crunchyroll"></div>
    <div class="campo"><label>Come si apre</label><div class="scelte" id="ed-modo">${Object.entries(MODI).map(([k, [t, d]]) =>
      `<button class="f scelta ${k === a.modo ? 'sel' : ''}" data-modo="${k}">${t}<small>${d}</small></button>`).join('')}</div></div>
    <div class="campo" id="ed-campo-url"><label for="ed-url">Indirizzo</label><input class="f" id="ed-url" value="${escHtml(a.url)}" placeholder="https://..."></div>
    <div class="campo" id="ed-campo-percorso"><label for="ed-percorso">Percorso del programma</label><input class="f" id="ed-percorso" value="${escHtml(a.percorso || '')}" placeholder="C:\\Program Files\\Kodi\\kodi.exe"></div>
    <div class="campo"><label>Colore</label><div class="colori" id="ed-colori">${COLORI.map((c) =>
      `<button class="f colore ${c === a.colore ? 'sel' : ''}" data-colore="${c}" style="background:${c}" aria-label="Colore ${c}"></button>`).join('')}</div></div>
    <div class="tasti">
      <button class="f tasto primario" data-p="salva">Salva</button>
      <button class="f tasto" data-p="annulla">Annulla</button>
    </div>`, (s) => {
    const mostra = () => {
      s.querySelector('#ed-campo-url').hidden = a.modo === 'programma';
      s.querySelector('#ed-campo-percorso').hidden = a.modo !== 'programma';
    };
    mostra();
    s.querySelector('#ed-modo').onclick = (e) => {
      const b = e.target.closest('[data-modo]'); if (!b) return;
      a.modo = b.dataset.modo; $$('#ed-modo .scelta').forEach((x) => x.classList.toggle('sel', x === b)); mostra();
    };
    s.querySelector('#ed-colori').onclick = (e) => {
      const b = e.target.closest('[data-colore]'); if (!b) return;
      a.colore = b.dataset.colore; $$('#ed-colori .colore').forEach((x) => x.classList.toggle('sel', x === b));
    };
    s.querySelector('[data-p="annulla"]').onclick = () => (nuova ? apriStore() : impostazioniTV('app'));
    s.querySelector('[data-p="salva"]').onclick = async () => {
      a.nome = s.querySelector('#ed-nome').value.trim();
      a.url = s.querySelector('#ed-url').value.trim();
      a.percorso = s.querySelector('#ed-percorso').value.trim();
      if (!a.nome) { avviso('Scrivi un nome'); metti(s.querySelector('#ed-nome')); return; }
      if (a.modo === 'programma' ? !a.percorso : !/^[a-z][a-z0-9+.-]*:\/?\/?\S+/i.test(a.url) || a.url === 'https://') { avviso('Indirizzo non valido'); return; }
      if (a.modo !== 'link' && a.modo !== 'programma' && !/^https?:\/\//i.test(a.url)) a.url = 'https://' + a.url.replace(/^\w+:\/\//, '');
      if (!a.id) a.id = (a.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app') + '-' + Date.now().toString(36);
      const lista = nuova ? [...imp.app, a] : imp.app.map((x) => (x.id === a.id ? a : x));
      await api.salva('app', lista);
      imp = await api.impostazioni();
      disegnaApp();
      if (nuova) { chiudiPannello(); metti($(`[data-app="${CSS.escape(a.id)}"]`)); avviso(`${a.nome} aggiunta`); }
      else impostazioniTV('app');
    };
  });
}

// ---------- Store: catalogo di servizi pronti (catalogo.js) ----------
const normalizza = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function apriStore() {
  const catalogo = window.CATALOGO || [];
  const presenti = () => new Set(imp.app.map((a) => a.id));
  const tessera = (v) => `
    <button class="f negozio" data-id="${escHtml(v.id)}" data-cerca="${escHtml(normalizza(v.nome + ' ' + v.descr))}">
      <span class="logo ${(window.LOGHI || {})[v.id] ? 'con-logo' : ''}" style="background:${escHtml(v.colore)}">${(window.LOGHI || {})[v.id] ? `<img src="${escHtml(window.LOGHI[v.id])}" alt="" draggable="false">` : escHtml(v.nome)}</span>
      <span class="info"><b>${escHtml(v.nome)}</b><small>${escHtml(v.descr)}</small></span>
      <span class="stato-app"></span>
    </button>`;
  apriPannello(`
    <div class="store-testa">
      <h1>Store</h1>
      <div class="campo cerca"><input class="f" id="cerca" placeholder="Cerca… (puoi scrivere dal telefono)" autocomplete="off"></div>
    </div>
    <p class="sotto">Premi OK su un'app per metterla nella home. Premila di nuovo per toglierla.</p>
    ${window.CATEGORIE.map(([cat, titolo]) => {
      const voci = catalogo.filter((v) => v.cat === cat);
      return voci.length ? `<section class="store-cat"><h3>${escHtml(titolo)}</h3><div class="store-griglia">${voci.map(tessera).join('')}</div></section>` : '';
    }).join('')}
    <section class="store-cat sempre"><h3>Non la trovi?</h3><div class="store-griglia">
      <button class="f negozio" data-p="mano"><span class="logo piu">+</span><span class="info"><b>Aggiungi a mano</b><small>Qualsiasi sito o programma del PC</small></span></button>
    </div></section>
    <p class="sotto" id="store-vuoto" hidden>Nessuna app trovata. Prova con "Aggiungi a mano".</p>
    <div class="tasti"><button class="f tasto primario" data-p="chiudi">Fatto</button></div>`, (s) => {
    s.classList.add('grande');
    const aggiornaStati = () => {
      const ci = presenti();
      $$('.negozio[data-id]', s).forEach((b) => {
        const dentro = ci.has(b.dataset.id);
        b.classList.toggle('presente', dentro);
        if (b.dataset.conferma !== '1') b.querySelector('.stato-app').textContent = dentro ? '✓ Nella home' : 'Aggiungi';
      });
    };
    aggiornaStati();
    s.querySelector('#cerca').addEventListener('input', (e) => {
      const q = normalizza(e.target.value).trim();
      let visibili = 0;
      $$('.store-cat', s).forEach((sez) => {
        if (sez.classList.contains('sempre')) return;
        let n = 0;
        $$('.negozio', sez).forEach((b) => { const ok = !q || b.dataset.cerca.includes(q); b.hidden = !ok; if (ok) n++; });
        sez.hidden = n === 0; visibili += n;
      });
      s.querySelector('#store-vuoto').hidden = visibili > 0;
    });
    s.querySelector('[data-p="chiudi"]').onclick = chiudiPannello;
    s.querySelector('[data-p="mano"]').onclick = () => editorApp();
    s.addEventListener('click', async (e) => {
      const b = e.target.closest('.negozio[data-id]'); if (!b) return;
      const v = catalogo.find((x) => x.id === b.dataset.id); if (!v) return;
      if (presenti().has(v.id)) {
        // Prima pressione: chiede conferma. Seconda: toglie dalla home.
        if (b.dataset.conferma !== '1') { b.dataset.conferma = '1'; b.querySelector('.stato-app').textContent = 'OK di nuovo per togliere'; return; }
        b.removeAttribute('data-conferma');
        await api.salva('app', imp.app.filter((a) => a.id !== v.id));
        avviso(`${v.nome} tolta dalla home`);
      } else {
        if (v.modo === 'programma' && !(await api.esiste(v.percorso))) {
          avviso(`${v.nome} non è installato su questo PC: scaricalo da ${v.scarica || 'internet'}, poi torna qui.`, 6000);
          return;
        }
        const { cat, descr, scarica, ...app } = v;
        await api.salva('app', [...imp.app, app]);
        avviso(`${v.nome} aggiunta alla home`);
      }
      imp = await api.impostazioni();
      disegnaApp();
      aggiornaStati();
    });
  });
}

// ---------- lettore (contenuti trasmessi via DLNA) ----------
const video = $('#video'), foto = $('#foto');
let hls = null, attuale = null, timerOsd, timerStato;

function mostraOsd() {
  $('#osd').classList.remove('nascosto');
  clearTimeout(timerOsd);
  timerOsd = setTimeout(() => { if (!video.paused || attuale?.tipo === 'immagine') $('#osd').classList.add('nascosto'); }, 3500);
}
function fmt(s) {
  if (!Number.isFinite(s)) return '0:00';
  s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
function statoTrasporto() {
  if (!attuale) return 'NO_MEDIA_PRESENT';
  if (attuale.tipo === 'immagine') return attuale.inCorso ? 'PLAYING' : 'STOPPED';
  if (!attuale.inCorso) return 'STOPPED';
  if (video.seeking || (video.readyState < 3 && !video.paused)) return 'TRANSITIONING';
  return video.paused ? 'PAUSED_PLAYBACK' : 'PLAYING';
}
function riferisci() {
  const durata = Number.isFinite(video.duration) ? video.duration : 0;
  api.statoLettore({ trasporto: statoTrasporto(), posizione: video.currentTime || 0, durata, volume: Math.round(video.volume * 100), muto: video.muted });
  $('#osd-pos').textContent = fmt(video.currentTime);
  $('#osd-dur').textContent = fmt(durata);
  $('#osd-avanzamento').style.width = durata ? `${(video.currentTime / durata) * 100}%` : '0';
  $('#osd-stato').textContent = { PLAYING: '▶', PAUSED_PLAYBACK: '❚❚', TRANSITIONING: 'Caricamento…', STOPPED: '■' }[statoTrasporto()] || '';
}
['play', 'pause', 'playing', 'waiting', 'seeked', 'durationchange', 'volumechange'].forEach((ev) => video.addEventListener(ev, riferisci));
video.addEventListener('ended', () => { if (attuale) attuale.inCorso = false; riferisci(); });
video.addEventListener('error', () => { console.warn('errore video', video.error && video.error.code, video.error && video.error.message, video.currentSrc); avviso('Questo formato non si può riprodurre'); if (attuale) attuale.inCorso = false; riferisci(); });

function scollegaSorgente() {
  if (hls) { hls.destroy(); hls = null; }
  video.pause(); video.removeAttribute('src'); video.load();
  foto.removeAttribute('src');
}
function carica(d) {
  scollegaSorgente();
  chiudiPannello();
  attuale = { ...d, inCorso: false };
  $('#lettore').hidden = false;
  $('#osd-titolo').textContent = d.titolo || 'Contenuto dal telefono';
  foto.hidden = d.tipo !== 'immagine';
  video.hidden = d.tipo === 'immagine';
  $('#copertina-audio').hidden = d.tipo !== 'audio';
  if (d.tipo === 'immagine') { foto.src = d.uri; attuale.inCorso = true; }
  else if ((/mpegurl/i.test(d.mime || '') || /\.m3u8(\?|$)/i.test(d.uri)) && window.Hls && Hls.isSupported() && !video.canPlayType('application/vnd.apple.mpegurl')) {
    hls = new Hls(); hls.loadSource(d.uri); hls.attachMedia(video);
  } else video.src = d.uri;
  mostraOsd(); riferisci();
}
function play() {
  if (!attuale) return;
  if (attuale.tipo === 'immagine') { attuale.inCorso = true; riferisci(); return; }
  if (!video.currentSrc && !hls) { const d = attuale; carica(d); }
  attuale.inCorso = true;
  $('#lettore').hidden = false;
  video.play().catch((e) => { console.warn('play non riuscito:', e.message); avviso('Riproduzione non riuscita: ' + e.message); });
  mostraOsd();
}
function stop() {
  if (attuale) attuale.inCorso = false;
  scollegaSorgente();
  $('#lettore').hidden = true;
  riferisci();
  metti(focalizzabili()[0]);
}
function lettoreAperto() { return !$('#lettore').hidden; }

api.suLettore((tipo, d = {}) => {
  if (tipo === 'carica') carica(d);
  else if (tipo === 'play') play();
  else if (tipo === 'pausa') { video.pause(); mostraOsd(); }
  else if (tipo === 'stop') { if (lettoreAperto() || attuale) stop(); }
  else if (tipo === 'vai') { if (Number.isFinite(d.secondi)) video.currentTime = d.secondi; mostraOsd(); }
  else if (tipo === 'volume') { video.volume = Math.max(0, Math.min(1, d.volume / 100)); }
  else if (tipo === 'muto') { video.muted = Boolean(d.muto); }
});
timerStato = setInterval(() => { if (attuale) riferisci(); }, 1000);

function tastoLettore(cmd) {
  mostraOsd();
  if (cmd === 'back') { stop(); return; }
  if (attuale?.tipo === 'immagine') return;
  if (cmd === 'ok' || cmd === 'playpause') { if (video.paused) play(); else video.pause(); }
  else if (cmd === 'left') video.currentTime = Math.max(0, video.currentTime - 10);
  else if (cmd === 'right') video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
  else if (cmd === 'up' || cmd === 'volup') video.volume = Math.min(1, video.volume + 0.1);
  else if (cmd === 'down' || cmd === 'voldown') video.volume = Math.max(0, video.volume - 0.1);
  else if (cmd === 'mute') video.muted = !video.muted;
}

// ---------- comandi (tastiera, telecomando USB, telefono) ----------
function comando(cmd) {
  if (lettoreAperto()) { tastoLettore(cmd); return; }
  const att = attuale_();
  const campo = att && att.tagName === 'INPUT';
  if (['up', 'down', 'left', 'right'].includes(cmd)) {
    if (frecciaEroe(att, cmd)) return;
    if (campo && (cmd === 'left' || cmd === 'right')) {
      const fine = cmd === 'left' ? att.selectionStart === 0 : att.selectionEnd === att.value.length;
      if (!fine) { const p = Math.max(0, (att.selectionStart || 0) + (cmd === 'left' ? -1 : 1)); att.setSelectionRange(p, p); return; }
    }
    sposta(cmd);
  } else if (cmd === 'ok' || cmd === 'invio') {
    if (campo) { att.dispatchEvent(new Event('change')); sposta('down'); }
    else if (att && att.classList.contains('f')) att.click();
    else metti(focalizzabili()[0]);
  } else if (cmd === 'back') {
    if (indietroPannello) indietroPannello();
    else if (!$('#pannello').hidden) chiudiPannello();
    else {
      // fuori dai pannelli: prima si torna alla scheda della schermata, poi alla Home
      const tab = $(`#schede .tab[data-schermata="${schermata}"]`);
      if (corrente !== tab) metti(tab);
      else if (schermata !== 'home') metti($('#schede .tab[data-schermata="home"]'));
    }
  } else if (cmd === 'cancella' && campo) {
    const s = att.selectionStart, e = att.selectionEnd;
    if (s !== e) att.setRangeText('', s, e, 'end'); else if (s > 0) att.setRangeText('', s - 1, s, 'end');
  }
}

const TASTI = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Escape: 'back', BrowserBack: 'back', GoBack: 'back', MediaPlayPause: 'playpause', ' ': 'playpause' };
document.addEventListener('keydown', (e) => {
  document.body.classList.remove('mouse');
  let cmd = TASTI[e.key];
  if (e.key === 'Backspace' && document.activeElement?.tagName !== 'INPUT') cmd = 'back';
  if (e.key === ' ' && !lettoreAperto()) cmd = null;
  if (!cmd) return;
  e.preventDefault();
  comando(cmd);
});
document.addEventListener('mousemove', () => document.body.classList.add('mouse'));
document.addEventListener('focusin', (e) => { if (e.target.classList && e.target.classList.contains('f') && e.target !== corrente) metti(e.target); });
$('#pannello').addEventListener('click', (e) => { if (e.target.id === 'pannello') chiudiPannello(); });

api.suTelecomando((cmd) => comando(cmd));
api.suHome(() => { nascondiApertura(); chiudiPannello(); if (!lettoreAperto()) metti($('#fila-app .f') || focalizzabili()[0]); });

let telefoni = 0, statoDlna = null;
function aggiornaChip() {
  $('#chip-telefono').hidden = !telefoni;
  $('#chip-telefono').textContent = telefoni > 1 ? `${telefoni} telefoni collegati` : 'Telefono collegato';
  $('#chip-dlna').hidden = !imp.dlna;
  $('#chip-dlna').textContent = statoDlna?.trasporto === 'PLAYING' ? 'In riproduzione dal telefono' : `Ricevitore: ${imp.nomeRicevitore}`;
}
api.suTelefoni((n) => {
  if (n > telefoni) avviso('Telefono collegato come telecomando');
  telefoni = n; aggiornaChip();
  const el = $('#tel-collegati'); if (el) el.innerHTML = n ? `Telefoni collegati ora: <b>${n}</b>` : 'Nessun telefono collegato ora.';
});
api.suStatoDLNA((s) => { statoDlna = s; aggiornaChip(); });
api.suLoghiNuovi(() => caricaLoghi());
api.suAvviso((t) => avviso(String(t || ''), 9000));
api.suAppAperta(() => nascondiApertura());
api.suProgrammiIcone(() => { if (programmi) caricaProgrammi(true); });

// ---------- avvio ----------
(async () => {
  imp = await api.impostazioni();
  $('#marchio').textContent = imp.nome;
  document.title = imp.nome;
  disegnaApp();
  aggiornaChip();
  orologio();
  setInterval(orologio, 10_000);
  $('#suggerimento').innerHTML = `Frecce e Invio per scegliere, <kbd>Esc</kbd> per tornare indietro. Da un'app torni qui con <kbd>${escHtml(tastoLeggibile())}</kbd> o col tasto Home del telefono.`;
  metti($('#fila-app .f') || focalizzabili()[0]);
})();
