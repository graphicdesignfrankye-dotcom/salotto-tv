// Schermate "Film" e "Serie TV" in stile Google TV: carosello grande in alto, file di locandine,
// scheda del titolo con "Guarda su …" e trailer. I dati arrivano da TMDB tramite il processo principale.
// Usa le funzioni di app.js (api, $, $$, metti, apriPannello, chiudiPannello, apri, imp, avviso, ...).
'use strict';

const cataloghi = { movie: null, tv: null, home: null };   // dati già caricati ("home": la home Per te)
const inCaricamento = { movie: null, tv: null };
const NOMI_TIPO = { movie: 'Film', tv: 'Serie TV' };
const SCHERMATA_DI = { movie: 'film', tv: 'serie', home: 'home' };
const contenitore = (tipo) => $({ movie: '#cat-movie', tv: '#cat-tv', home: '#home-eroe' }[tipo]);
let eroeIndice = { movie: 0, tv: 0, home: 0 }, timerEroe = null;
let homeCaricata = 0, homeInCorso = false;

// Home "Per te": carosello misto e file di film e serie sotto "Le tue app". Senza chiave TMDB resta la home di prima.
const HOME_BASE = { carosello: true, film: true, serie: true, servizi: true, salotto: true };
const sceltaHome = () => ({ ...HOME_BASE, ...(imp && imp.home) });
async function caricaHome(forza = false) {
  if (!imp || homeInCorso) return;
  $('#riga-salotto').hidden = !sceltaHome().salotto;
  if (!imp.tmdbAttivo) { $('#home-eroe').innerHTML = ''; $('#home-titoli').innerHTML = ''; $('#saluto-eroe').hidden = false; return; }
  if (cataloghi.home && !forza && Date.now() - homeCaricata < 3 * 60 * 60 * 1000) { avviaEroe('home'); return; }
  homeInCorso = true;
  const r = await api.tmdbHome();
  homeInCorso = false;
  if (!r.ok) { if (r.manca) imp.tmdbAttivo = false; return; } // la home resta senza titoli; l'errore è nel log
  cataloghi.home = r;
  homeCaricata = Date.now();
  disegnaHome();
}
// Dopo aver cambiato le scelte in Impostazioni → Home.
function applicaHome() {
  $('#riga-salotto').hidden = !sceltaHome().salotto;
  if (cataloghi.home && imp.tmdbAttivo) disegnaHome();
}
function disegnaHome() {
  const d = cataloghi.home;
  const h = sceltaHome();
  const fuoco = corrente && $('#home-titoli').contains(corrente) ? corrente.dataset.tmdb : null;
  const eroe = h.carosello ? d.eroe : [];
  const file = d.file.filter((f) => h[f.sezione] !== false);
  $('#home-eroe').innerHTML = eroe.length ? htmlEroe('home', eroe) : '';
  $('#saluto-eroe').hidden = Boolean(eroe.length);
  $('#home-titoli').innerHTML = file.map(htmlFila).join('') + (file.length || eroe.length ? CREDITI : '');
  eroeIndice.home = 0;
  if (eroe.length) mostraEroe('home', false);
  if (schermata === 'home') avviaEroe('home');
  if (fuoco) { const t = $(`#home-titoli [data-tmdb="${CSS.escape(fuoco)}"]`); if (t) metti(t); }
}
const CREDITI = '<p class="tmdb-crediti">Dati e immagini da TMDB · questo prodotto usa le API di TMDB ma non è approvato né certificato da TMDB</p>';
const htmlFila = (f) => `<section class="riga"><h2>${escHtml(f.titolo)}</h2><div class="fila">${f.voci.map(locandina).join('')}</div></section>`;
const htmlEroe = (tipo, eroe) => `<button class="f eroe-tmdb" data-eroe="${tipo}">
      <span class="eroe-sfondo"></span>
      <span class="eroe-testo"><span class="eroe-tipo"></span><b class="eroe-titolo"></b><span class="eroe-meta"></span><span class="eroe-trama"></span>
        <span class="eroe-azione">OK per i dettagli · ◀ ▶ per scorrere</span></span>
      <span class="eroe-punti">${eroe.map(() => '<i></i>').join('')}</span>
    </button>`;

// Chiamato da mostraSchermata (app.js) quando si apre la scheda Film o Serie TV.
async function mostraCatalogo(tipo, forza = false) {
  const box = contenitore(tipo);
  if (!imp.tmdbAttivo) { disegnaSenzaChiave(box); return; }
  if (cataloghi[tipo] && !forza) { avviaEroe(tipo); return; }
  if (!inCaricamento[tipo]) {
    box.innerHTML = `<div class="cat-attesa"><div class="apertura-punti"><i></i><i></i><i></i></div><p>Carico ${NOMI_TIPO[tipo].toLowerCase()}…</p></div>`;
    inCaricamento[tipo] = api.tmdbSchermata(tipo);
  }
  const r = await inCaricamento[tipo];
  inCaricamento[tipo] = null;
  if (!r.ok) {
    if (r.manca) { imp.tmdbAttivo = false; disegnaSenzaChiave(box); return; }
    box.innerHTML = `<div class="cat-vuoto"><h2>Non riesco a caricare ${NOMI_TIPO[tipo].toLowerCase()}</h2><p>${escHtml(r.errore || '')}</p>
      <button class="f tasto primario" data-cat-riprova="${tipo}">Riprova</button></div>`;
    return;
  }
  cataloghi[tipo] = r;
  disegnaCatalogo(tipo);
}

function disegnaSenzaChiave(box) {
  box.innerHTML = `<div class="cat-vuoto">
    <h2>Film e serie da tutte le tue app</h2>
    <p>Salotto usa il catalogo gratuito di TMDB: locandine, trame e su quale app guardarli in Italia.<br>Serve la tua chiave API di TMDB, una volta sola.</p>
    <button class="f tasto primario" data-cat-chiave>Aggiungi la chiave TMDB</button></div>`;
}

const locandina = (v) => `
  <button class="f tessera locandina" data-tmdb="${v.tipo}:${v.id}" title="${escHtml(v.titolo)}">
    ${v.poster ? `<img src="${escHtml(v.poster)}" alt="" loading="lazy" draggable="false">` : ''}
    <span class="nome">${escHtml(v.titolo)}</span>
  </button>`;

function disegnaCatalogo(tipo) {
  const d = cataloghi[tipo];
  const box = contenitore(tipo);
  if (!d.file.length) { box.innerHTML = '<div class="cat-vuoto"><h2>Nessun titolo</h2><p>TMDB non ha restituito niente: riprova più tardi.</p></div>'; return; }
  box.innerHTML = `
    ${d.eroe.length ? htmlEroe(tipo, d.eroe) : ''}
    ${d.file.map(htmlFila).join('')}
    ${CREDITI}`;
  eroeIndice[tipo] = 0;
  mostraEroe(tipo, false);
  avviaEroe(tipo);
}

function mostraEroe(tipo, anima = true) {
  const d = cataloghi[tipo];
  const el = contenitore(tipo).querySelector('.eroe-tmdb');
  if (!d || !el || !d.eroe.length) return;
  const v = d.eroe[eroeIndice[tipo]];
  const fondo = el.querySelector('.eroe-sfondo');
  const nuovo = document.createElement('img');
  nuovo.src = v.sfondo; nuovo.alt = ''; nuovo.draggable = false;
  fondo.appendChild(nuovo);
  const vecchi = [...fondo.querySelectorAll('img')].slice(0, -1);
  if (anima) nuovo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease' }).onfinish = () => vecchi.forEach((i) => i.remove());
  else vecchi.forEach((i) => i.remove());
  el.querySelector('.eroe-tipo').textContent = `${NOMI_TIPO[v.tipo] || ''} di tendenza`;
  el.querySelector('.eroe-titolo').textContent = v.titolo;
  el.querySelector('.eroe-meta').textContent = [v.anno, v.voto ? '★ ' + v.voto.toLocaleString('it-IT') : ''].filter(Boolean).join(' · ');
  el.querySelector('.eroe-trama').textContent = v.trama;
  el.dataset.tmdb = `${v.tipo}:${v.id}`;
  [...el.querySelectorAll('.eroe-punti i')].forEach((p, i) => p.classList.toggle('attivo', i === eroeIndice[tipo]));
  if (anima) el.querySelector('.eroe-testo').animate([{ opacity: 0, transform: 'translateX(-1.5rem)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'ease-out' });
}
function cambiaEroe(tipo, passo) {
  const d = cataloghi[tipo];
  if (!d || !d.eroe.length) return;
  eroeIndice[tipo] = (eroeIndice[tipo] + passo + d.eroe.length) % d.eroe.length;
  mostraEroe(tipo);
  avviaEroe(tipo);
}
// Il carosello scorre da solo ogni 9 secondi, solo mentre la sua schermata è visibile.
function avviaEroe(tipo) {
  clearInterval(timerEroe);
  timerEroe = setInterval(() => {
    const visibile = schermata === SCHERMATA_DI[tipo] && $('#pannello').hidden && $('#apertura').hidden;
    if (visibile) cambiaEroe(tipo, 1);
  }, 9000);
}
// Frecce sinistra/destra sul carosello: cambiano titolo invece di spostare il fuoco (chiamata da comando() in app.js).
function frecciaEroe(att, cmd) {
  // Su dalla prima fila sotto il carosello: si torna al carosello (non alle schede in alto).
  if (cmd === 'up' && att && att.closest) {
    const sch = att.closest('.schermata'), riga = att.closest('.riga');
    const eroe = sch && sch.querySelector('.eroe-tmdb');
    const prima = sch && [...sch.querySelectorAll('.riga')].find((r) => r.offsetParent !== null);
    if (eroe && riga && riga === prima && (eroe.compareDocumentPosition(riga) & Node.DOCUMENT_POSITION_FOLLOWING)) { metti(eroe); return true; }
  }
  if (!att || !att.classList || !att.classList.contains('eroe-tmdb')) return false;
  if (cmd === 'down') { // dal carosello si scende al primo titolo della prima fila, come su Google TV
    const primo = att.closest('.schermata').querySelector('.fila .f');
    if (primo) { metti(primo); return true; }
    return false;
  }
  if (cmd !== 'left' && cmd !== 'right') return false;
  cambiaEroe(att.dataset.eroe, cmd === 'right' ? 1 : -1);
  return true;
}

// ---------- scheda del titolo ----------
async function apriTitolo(tipo, id, tessera) {
  const base = Object.values(cataloghi).filter(Boolean).flatMap((c) => [...c.eroe, ...c.file.flatMap((f) => f.voci)]).find((v) => v.id === id && v.tipo === tipo);
  apriPannello(schedaTitolo(base || { titolo: '', tipo }, null), (s) => { s.classList.add('titolo-tmdb'); $('#pannello').classList.add('pieno'); });
  const r = await api.tmdbDettagli(tipo, id);
  if ($('#pannello').hidden || !$('#scheda').classList.contains('titolo-tmdb')) return; // nel frattempo si è chiuso
  if (!r.ok) { avviso('Non riesco a leggere i dettagli: ' + (r.errore || '')); return; }
  apriPannello(schedaTitolo(r, r), (s) => {
    s.classList.add('titolo-tmdb');
    $('#pannello').classList.add('pieno');
    s.onclick = (e) => {
      const b = e.target.closest('[data-guarda], [data-trailer], [data-p="chiudi"]');
      if (!b) return;
      if (b.dataset.p === 'chiudi') { chiudiPannello(); return; }
      chiudiPannello();
      if (b.dataset.trailer) guardaCon('youtube', { trailer: b.dataset.trailer });
      else guardaCon(b.dataset.guarda, { cerca: r.titolo });
    };
  });
}

function schedaTitolo(v, d) {
  const mie = new Set(imp.app.map((a) => a.id));
  const nomeApp = (id) => (imp.app.find((a) => a.id === id) || {}).nome;
  const meta = [v.anno, d && (d.durata || d.stagioni), v.voto ? '★ ' + v.voto.toLocaleString('it-IT') : '', d && d.generi.slice(0, 3).join(', ')].filter(Boolean).join(' · ');
  let azioni = '';
  if (d) {
    const guarda = d.dove.filter((p) => p.app && mie.has(p.app));
    const altrove = d.dove.filter((p) => !p.app || !mie.has(p.app));
    azioni = `
      <div class="tasti titolo-tasti">
        ${guarda.map((p, i) => `<button class="f tasto ${i === 0 ? 'primario' : ''}" data-guarda="${escHtml(p.app)}" ${i === 0 ? 'data-primo' : ''}>
          ${p.logo ? `<img class="logo-servizio" src="${escHtml(p.logo)}" alt="">` : ''}Guarda su ${escHtml(nomeApp(p.app) || p.nome)}</button>`).join('')}
        ${d.trailer && mie.has('youtube') ? `<button class="f tasto" data-trailer="${escHtml(d.trailer)}" ${guarda.length ? '' : 'data-primo'}>▶ Trailer</button>` : ''}
        <button class="f tasto" data-p="chiudi" ${guarda.length || (d.trailer && mie.has('youtube')) ? '' : 'data-primo'}>Indietro</button>
      </div>
      <p class="titolo-dove">${
        !d.dove.length ? 'Per ora non è in streaming in Italia.' + (d.noleggio.length ? ' A noleggio su ' + escHtml(d.noleggio.join(', ')) + '.' : '')
        : altrove.length ? (guarda.length ? 'Anche su ' : 'Disponibile su ') + escHtml(altrove.map((p) => p.nome).join(', ')) + (guarda.length ? '' : ': aggiungi l\'app dallo Store per aprirlo da qui') + '.'
        : ''}</p>
      <p class="titolo-nota">“Guarda su” apre l'app già sulla ricerca del titolo.</p>`;
  } else azioni = '<div class="titolo-attesa"><div class="apertura-punti"><i></i><i></i><i></i></div></div><button class="f tasto" data-p="chiudi" data-primo>Indietro</button>';
  return `
    <div class="titolo-sfondo">${v.sfondo ? `<img src="${escHtml(v.sfondo)}" alt="">` : ''}</div>
    <div class="titolo-corpo">
      <span class="eroe-tipo">${NOMI_TIPO[v.tipo] || ''}</span>
      <h1>${escHtml(v.titolo)}</h1>
      <p class="titolo-meta">${escHtml(meta)}</p>
      <p class="titolo-trama">${escHtml(v.trama || (d ? 'Trama non disponibile in italiano.' : ''))}</p>
      ${azioni}
    </div>`;
}

async function guardaCon(appId, extra) {
  const a = imp.app.find((x) => x.id === appId);
  if (!a) { avviso('App non presente nella home'); return; }
  mostraApertura(a, null);
  const r = await api.apri(appId, extra);
  if (!r.ok) { nascondiApertura(); avviso(r.errore || 'Non riesco ad aprire l\'app'); return; }
  if (imp.piattaforma !== 'win32') setTimeout(nascondiApertura, 2500);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tmdb], [data-cat-chiave], [data-cat-riprova]');
  if (!t || !$('#home').contains(t)) return;
  if (t.dataset.catChiave !== undefined) { impostazioniTV('tmdb'); return; }
  if (t.dataset.catRiprova) { mostraCatalogo(t.dataset.catRiprova, true); return; }
  const [tipo, id] = t.dataset.tmdb.split(':');
  apriTitolo(tipo, Number(id), t);
});

// Dopo aver salvato o tolto la chiave: si ricarica tutto.
function catalogoDaRifare() {
  cataloghi.movie = cataloghi.tv = cataloghi.home = null;
  caricaHome(true);
  if (schermata === 'film') mostraCatalogo('movie');
  if (schermata === 'serie') mostraCatalogo('tv');
}
