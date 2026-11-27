// Impostazioni in stile TV: pannello che entra da destra sopra la home, elenco di categorie,
// ogni categoria apre la sua pagina nello stesso pannello. Indietro: dalla pagina all'elenco, dall'elenco chiude.
// Usa le funzioni di app.js (apriPannello, metti, api, imp, avviso, ...).
'use strict';

const ICONE = {
  app: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  trasmissione: '<path d="M3 18a3 3 0 0 1 3 3M3 14a7 7 0 0 1 7 7M3 10a11 11 0 0 1 11 11"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
  telecomando: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><circle cx="12" cy="17.5" r="1.2"/><path d="M10 7h4"/>',
  sistema: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  energia: '<path d="M12 3v9"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  tmdb: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
  bluetooth: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
  cuffie: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  controller: '<path d="M7 9h10a4 4 0 0 1 4 4.5l-.6 3.2a2 2 0 0 1-3.4 1L15 16H9l-2 1.7a2 2 0 0 1-3.4-1L3 13.5A4 4 0 0 1 7 9z"/><path d="M8 12v2M7 13h2M16 12.5h.01M17.5 13.5h.01"/>',
  tastiera: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  cassa: '<rect x="6" y="2" width="12" height="20" rx="2"/><circle cx="12" cy="14" r="3.5"/><path d="M12 6h.01"/>',
  indietro: '<path d="M15 5l-7 7 7 7"/>',
};
const icona = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONE[n] || ''}</svg>`;

// Nome che Salotto dà a uxplay-windows (stessa regola di electron/airplay.cjs: niente spazi).
const nomeAirPlayDi = (n) => String(n || 'Salotto').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'Salotto';

const interruttore = (chiave, acceso, titolo, sotto, primo = false) => `
  <button class="f interruttore" role="switch" aria-checked="${acceso}" data-int="${chiave}" ${primo ? 'data-primo' : ''}>
    <span><b>${titolo}</b><small>${sotto}</small></span><span class="leva"></span>
  </button>`;

async function salvaInterruttore(b, chiave, valore) {
  b.setAttribute('aria-checked', valore);
  imp[chiave] = valore;
  await api.salva(chiave, valore);
}

// Apre il pannello laterale con il contenuto dato; "indietro" decide cosa fa il tasto Indietro.
function pannelloLaterale(html, dopo, indietro, larga = false) {
  const primaVolta = $('#pannello').hidden || !$('#scheda').classList.contains('laterale');
  apriPannello(html, (s) => {
    s.classList.add('laterale');
    if (larga) s.classList.add('larga');
    if (primaVolta) s.classList.add('entra');
    $('#pannello').classList.add('con-laterale');
    const su = s.querySelector('.imp-su');
    if (su && indietro) su.onclick = indietro;
    if (dopo) dopo(s);
  });
  indietroPannello = indietro;
}

// ---------- elenco delle categorie ----------
async function impostazioniTV(pagina, fuoco) {
  imp = await api.impostazioni();
  if (pagina && PAGINE[pagina]) { await PAGINE[pagina](fuoco); return; }
  const ap = await api.statoAirPlay();
  const trasm = [imp.dlna ? 'DLNA' : '', imp.airplay && ap.installato ? 'AirPlay' : ''].filter(Boolean).join(' e ') || 'Spenta';
  const voci = [
    ['app', 'App', `${imp.app.length} nella home · ordine e modifica`],
    ['home', 'Home', 'Cosa vedere nella home'],
    ['tmdb', 'Film e Serie TV', imp.tmdbAttivo ? 'Catalogo TMDB collegato' : 'Aggiungi la chiave TMDB'],
    ['trasmissione', 'Trasmissione', `${trasm} · “${escHtml(imp.nomeRicevitore)}”`],
    ['telecomando', 'Telecomando', imp.telefoniAbbinati ? `${imp.telefoniAbbinati} telefoni abbinati` : 'Usa il telefono come telecomando'],
    ['bluetooth', 'Bluetooth', 'Cuffie, casse, controller e tastiere'],
    ['sistema', 'Sistema', imp.avvioConWindows ? 'Si avvia all\'accensione del PC' : 'Avvio e tasto Home'],
    ['energia', 'Spegni e riavvia', 'Sospendi, riavvia, spegni, esci'],
    ['info', 'Informazioni', `Salotto ${escHtml(imp.versione || '')}`],
  ];
  pannelloLaterale(`
    <div class="imp-testa"><h1>Impostazioni</h1><span class="imp-ora" id="imp-ora"></span></div>
    <div class="imp-elenco">${voci.map(([k, t, s], i) => `
      <button class="f imp-voce" data-pagina="${k}" ${(fuoco ? fuoco === k : i === 0) ? 'data-primo' : ''}>
        <span class="imp-icona">${icona(k)}</span>
        <span class="imp-testo"><b>${t}</b><small>${s}</small></span>
        <span class="imp-freccia">›</span>
      </button>`).join('')}</div>`, (s) => {
    $('#imp-ora', s).textContent = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    s.querySelector('.imp-elenco').onclick = (e) => {
      const b = e.target.closest('[data-pagina]');
      if (b) impostazioniTV(b.dataset.pagina);
    };
  }, null);
}

// Intestazione delle pagine: freccia indietro + titolo.
const testaPagina = (titolo, sotto = '') => `
  <div class="imp-testa pagina"><span class="imp-su">${icona('indietro')}</span><div><h1>${titolo}</h1>${sotto ? `<p class="sotto">${sotto}</p>` : ''}</div></div>`;
const torna = (da) => () => impostazioniTV(null, da);

// ---------- pagine ----------
const PAGINE = {
  async app(fuoco) {
    pannelloLaterale(`
      ${testaPagina('App', 'Ordine nella home, modifica e rimozione')}
      ${interruttore('edgeDentro', imp.edgeDentro !== false, 'Netflix & co. dentro Salotto', 'Le app che usano Edge si aprono nella finestra di Salotto. Spegni se un\'app dà problemi', !fuoco)}
      <button class="f imp-voce piccola" data-p="store"><span class="imp-icona">${icona('app')}</span><span class="imp-testo"><b>Aggiungi app dallo Store</b></span><span class="imp-freccia">›</span></button>
      <h3>Nella home</h3>
      <div id="lista-app">${imp.app.map((a, i) => `
        <div class="voce">
          ${logoDi(a) ? imgLogo(a, 'pallino') : `<span class="pallino" style="background:${escHtml(a.colore)}"></span>`}
          <span class="testo">${escHtml(a.nome)}</span>
          <button class="f tasto" data-su="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Sposta su">▲</button>
          <button class="f tasto" data-giu="${i}" ${i === imp.app.length - 1 ? 'disabled' : ''} aria-label="Sposta giù">▼</button>
          <button class="f tasto" data-mod="${i}">Modifica</button>
          <button class="f tasto" data-via="${i}">Rimuovi</button>
        </div>`).join('')}</div>`, (s) => {
      s.querySelector('[data-int="edgeDentro"]').onclick = (e) => salvaInterruttore(e.currentTarget, 'edgeDentro', imp.edgeDentro === false);
      s.querySelector('[data-p="store"]').onclick = () => apriStore();
      s.querySelector('#lista-app').onclick = async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const lista = [...imp.app];
        let dopo = null;
        if (b.dataset.su) { const i = +b.dataset.su; [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; dopo = `[data-su="${i - 1}"]`; }
        else if (b.dataset.giu) { const i = +b.dataset.giu; [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]]; dopo = `[data-giu="${i + 1}"]`; }
        else if (b.dataset.via) {
          const i = +b.dataset.via;
          if (b.dataset.conferma !== '1') { b.dataset.conferma = '1'; b.textContent = 'Sicuro?'; b.classList.add('pericolo'); return; }
          lista.splice(i, 1); dopo = `[data-via="${Math.min(i, lista.length - 1)}"]`;
        } else if (b.dataset.mod) { editorApp(imp.app[+b.dataset.mod]); return; }
        await api.salva('app', lista);
        imp = await api.impostazioni(); disegnaApp();
        await PAGINE.app(dopo || true);
        const el = dopo && $(dopo);
        metti(el && !el.disabled ? el : focalizzabili()[0]);
      };
    }, torna('app'), true);
  },

  async trasmissione() {
    const ap = await api.statoAirPlay();
    const statoAp = !ap.windows ? 'Disponibile solo su Windows'
      : !ap.installato ? 'Serve uxplay-windows (gratuito): vedi “Trasmetti al PC” nella home'
        : `iPhone, iPad e Mac lo trovano come “${escHtml(nomeAirPlayDi(imp.nomeRicevitore))}”`;
    pannelloLaterale(`
      ${testaPagina('Trasmissione', 'Video, foto e musica dal telefono al PC')}
      ${interruttore('dlna', imp.dlna, 'Ricevitore DLNA', `App Android come Web Video Caster o BubbleUPnP trovano “${escHtml(imp.nomeRicevitore)}”`, true)}
      ${interruttore('airplay', imp.airplay, 'Ricevitore AirPlay', statoAp)}
      <div class="campo"><label for="nome-ric">Nome del ricevitore (come lo vede il telefono)</label><input class="f" id="nome-ric" value="${escHtml(imp.nomeRicevitore)}" maxlength="40"></div>`, (s) => {
      s.querySelector('[data-int="dlna"]').onclick = async (e) => { await salvaInterruttore(e.currentTarget, 'dlna', !imp.dlna); aggiornaChip(); };
      s.querySelector('[data-int="airplay"]').onclick = (e) => salvaInterruttore(e.currentTarget, 'airplay', !imp.airplay);
      const nome = s.querySelector('#nome-ric');
      nome.onchange = async () => { await api.salva('nomeRicevitore', nome.value); imp = await api.impostazioni(); aggiornaChip(); avviso('Nome del ricevitore salvato'); };
    }, torna('trasmissione'));
  },

  async telecomando() {
    const info = await api.infoTelecomando();
    pannelloLaterale(`
      ${testaPagina('Telecomando', 'Il telefono deve essere sulla stessa rete Wi‑Fi del PC')}
      <div class="imp-qr">${info.qr ? `<img class="qr" src="${info.qr}" alt="Codice QR">` : '<div class="qr"></div>'}
        <div><p class="sotto">Inquadra il codice, oppure apri<br><span class="indirizzo">${escHtml(info.url)}</span></p>
        <p class="sotto">PIN <span class="pin">${escHtml(info.pin)}</span></p></div></div>
      <p class="sotto" id="tel-collegati">${info.collegati ? `Telefoni collegati ora: <b>${info.collegati}</b>` : 'Nessun telefono collegato ora.'}</p>
      <button class="f imp-voce piccola" data-p="pin" data-primo><span class="imp-icona">${icona('telecomando')}</span><span class="imp-testo"><b>Nuovo PIN</b><small>Scollega tutti i telefoni abbinati</small></span></button>`, (s) => {
      s.querySelector('[data-p="pin"]').onclick = async () => { await api.nuovoPin(); await PAGINE.telecomando(); avviso('PIN cambiato: i telefoni vanno ricollegati'); };
    }, torna('telecomando'));
  },

  async bluetooth(fuoco, messaggio) {
    // Prima lo stato della radio (veloce), poi la pagina; l'elenco degli abbinati arriva dopo, quando Windows risponde.
    pannelloLaterale(`${testaPagina('Bluetooth')}<p class="sotto" data-primo>Controllo il Bluetooth…</p>`, null, torna('bluetooth'));
    const st = await api.bluetooth('radio');
    if (schedaBluetoothChiusa()) return;
    const tipoIcona = (c) => (/gamepad|game|controller|dualsense|dualshock|joy-con/i.test(c) ? 'controller' : /keyboard|tastiera|mouse|input/i.test(c) ? 'tastiera' : /headphone|headset|earbud|cuffie|airpods|buds/i.test(c) ? 'cuffie' : /audio|speaker|cassa|soundbar/i.test(c) ? 'cassa' : 'bluetooth');
    const riga = (d, attr) => `
      <button class="f imp-voce piccola" ${attr}="${escHtml(d.id)}">
        <span class="imp-icona">${icona(tipoIcona((d.categoria || '') + ' ' + (d.nome || '')))}</span>
        <span class="imp-testo"><b>${escHtml(d.nome)}</b><small>${attr === 'data-bt-abbinato' ? (d.connesso ? 'Collegato' : 'Abbinato, non collegato') + ' · OK due volte per dimenticarlo' : 'OK per abbinarlo'}</small></span>
      </button>`;
    pannelloLaterale(`
      ${testaPagina('Bluetooth', messaggio ? escHtml(messaggio) : (st.ok ? '' : escHtml('Non riesco a leggere il Bluetooth: ' + (st.errore || ''))))}
      ${st.ok && st.presente === false ? '<div class="imp-riga"><b>Nessun Bluetooth</b><span>Questo PC non ha il Bluetooth, oppure è disattivato nel BIOS o in Gestione dispositivi</span></div>' : ''}
      ${st.ok && st.presente !== false ? interruttore('bt', Boolean(st.acceso), 'Bluetooth', st.acceso ? 'Acceso' : 'Spento', !fuoco) : ''}
      ${st.acceso ? `<h3>Dispositivi abbinati</h3>
        <div class="imp-elenco" id="bt-abbinati"><p class="sotto">Cerco i dispositivi abbinati…</p></div>
        <h3>Nuovi dispositivi</h3>
        <div class="imp-elenco" id="bt-vicini"><p class="sotto">Metti il dispositivo in modalità abbinamento, poi premi Cerca.</p></div>
        <button class="f imp-voce piccola" data-p="cerca"><span class="imp-icona">${icona('bluetooth')}</span><span class="imp-testo"><b>Cerca dispositivi</b><small>Fino a 30 secondi</small></span></button>` : ''}
      <button class="f imp-voce piccola" data-p="windows"><span class="imp-icona">${icona('sistema')}</span><span class="imp-testo"><b>Impostazioni Bluetooth di Windows</b><small>Per i dispositivi che chiedono un PIN</small></span><span class="imp-freccia">›</span></button>`, (s) => {
      const int = s.querySelector('[data-int="bt"]');
      if (int) int.onclick = async () => {
        int.querySelector('small').textContent = 'Un momento…';
        const r = await api.bluetooth(st.acceso ? 'spegni' : 'accendi');
        await PAGINE.bluetooth('bt', r.ok ? (r.esito === 'Allowed' ? '' : r.messaggio) : r.errore);
      };
      s.querySelector('[data-p="windows"]').onclick = async () => {
        if (!(await api.impostazioniBluetoothWindows())) avviso('Disponibile solo su Windows');
      };
      const cerca = s.querySelector('[data-p="cerca"]');
      if (cerca) cerca.onclick = async () => {
        const vic = s.querySelector('#bt-vicini');
        vic.innerHTML = '<p class="sotto">Cerco… tieni il dispositivo vicino e in modalità abbinamento.</p>';
        cerca.disabled = true;
        const r = await api.bluetooth('cerca');
        cerca.disabled = false;
        if (!vic.isConnected) return;
        const lista = (r.dispositivi || []);
        vic.innerHTML = !r.ok ? `<p class="sotto">${escHtml('Ricerca non riuscita: ' + (r.errore || ''))}</p>`
          : lista.length ? lista.map((d) => riga(d, 'data-bt-vicino')).join('') : '<p class="sotto">Nessun dispositivo trovato. Controlla che sia in modalità abbinamento e riprova.</p>';
        const primo = vic.querySelector('.f');
        if (primo) metti(primo);
      };
      s.onclick = async (e) => {
        const nuovo = e.target.closest('[data-bt-vicino]');
        const vecchio = e.target.closest('[data-bt-abbinato]');
        if (nuovo) {
          nuovo.querySelector('small').textContent = 'Abbino… se il dispositivo chiede conferma, accettala';
          const r = await api.bluetooth('abbina', nuovo.dataset.btVicino);
          await PAGINE.bluetooth(null, r.ok ? r.messaggio : r.errore);
        } else if (vecchio) {
          if (vecchio.dataset.conferma !== '1') { vecchio.dataset.conferma = '1'; vecchio.querySelector('small').textContent = 'Premi OK di nuovo per dimenticarlo'; return; }
          vecchio.querySelector('small').textContent = 'Un momento…';
          const r = await api.bluetooth('dimentica', vecchio.dataset.btAbbinato);
          await PAGINE.bluetooth(null, r.ok ? r.messaggio : r.errore);
        }
      };
      if (fuoco === 'bt' && int) metti(int);
      const elenco = s.querySelector('#bt-abbinati');
      if (elenco) api.bluetooth('abbinati').then((r) => {
        if (!elenco.isConnected) return; // pagina già cambiata: questa risposta non serve più
        const lista = r.dispositivi || [];
        elenco.innerHTML = !r.ok ? `<p class="sotto">${escHtml('Non riesco a leggere i dispositivi: ' + (r.errore || ''))}</p>`
          : lista.length ? lista.map((d) => riga(d, 'data-bt-abbinato')).join('') : '<p class="sotto">Nessun dispositivo abbinato.</p>';
      });
    }, torna('bluetooth'));
  },

  async home(fuoco) {
    const h = sceltaHome();
    const senza = !imp.tmdbAttivo ? ' (serve la chiave TMDB)' : '';
    const voci = [
      ['carosello', 'Carosello in alto', 'Film e serie di tendenza a tutto schermo' + senza],
      ['film', 'Film di tendenza', 'Una fila di locandine' + senza],
      ['serie', 'Serie TV di tendenza', 'Una fila di locandine' + senza],
      ['servizi', 'Su Netflix, Prime Video, …', 'Una fila per ogni servizio che hai nella home' + senza],
      ['salotto', 'Fila Salotto', 'Telecomando, Trasmetti, Store, Impostazioni, Spegni'],
    ];
    pannelloLaterale(`
      ${testaPagina('Home', 'Scegli cosa vedere. “Le tue app” si vedono sempre; le Impostazioni sono anche nel tasto accanto all\'ora.')}
      ${voci.map(([k, t, s], i) => interruttore('home-' + k, h[k], t, s, fuoco ? fuoco === k : i === 0)).join('')}`, (s) => {
      s.onclick = async (e) => {
        const b = e.target.closest('[data-int^="home-"]'); if (!b) return;
        const k = b.dataset.int.slice(5);
        const nuove = { ...sceltaHome(), [k]: !sceltaHome()[k] };
        b.setAttribute('aria-checked', nuove[k]);
        imp.home = nuove;
        await api.salva('home', nuove);
        applicaHome();
      };
    }, torna('home'));
  },

  async tmdb(fuoco, messaggio) {
    pannelloLaterale(`
      ${testaPagina('Film e Serie TV', messaggio ? escHtml(messaggio) : '')}
      <div class="imp-riga"><b>Catalogo TMDB</b><span>${imp.tmdbAttivo ? 'Collegato: le schede Film e Serie TV sono pronte' : 'Nessuna chiave: le schede Film e Serie TV sono vuote'}</span></div>
      <div class="campo imp-campo"><label for="tmdb-chiave">${imp.tmdbAttivo ? 'Nuova chiave API (per cambiarla)' : 'Chiave API di TMDB'}</label>
        <input class="f" id="tmdb-chiave" data-primo autocomplete="off" spellcheck="false" placeholder="Incollala qui, anche dalla tastiera del telefono"></div>
      <div class="imp-elenco">
        <button class="f imp-voce piccola" data-p="salva"><span class="imp-icona">${icona('tmdb')}</span><span class="imp-testo"><b>Salva e prova</b><small>Salotto controlla subito che funzioni</small></span></button>
        ${imp.tmdbAttivo ? `<button class="f imp-voce piccola" data-p="togli"><span class="imp-testo"><b>Togli la chiave</b><small>Le schede Film e Serie TV tornano vuote</small></span></button>` : ''}
      </div>
      <p class="sotto">La trovi su themoviedb.org → Impostazioni → API, alla voce “Chiave API”. Va bene anche il “Token di accesso in lettura”. Resta salvata solo su questo PC.</p>
      <p class="sotto">Questo prodotto usa le API di TMDB ma non è approvato né certificato da TMDB.</p>`, (s) => {
      const campo = s.querySelector('#tmdb-chiave');
      s.querySelector('[data-p="salva"]').onclick = async (e) => {
        const b = e.currentTarget;
        if (!campo.value.trim()) { avviso('Prima incolla la chiave nel campo'); metti(campo); return; }
        b.querySelector('small').textContent = 'Provo la chiave…';
        const r = await api.tmdbChiave(campo.value);
        if (!r.ok) { b.querySelector('small').textContent = r.errore; return; }
        imp = await api.impostazioni();
        catalogoDaRifare();
        await PAGINE.tmdb(null, 'Chiave salvata: apri le schede Film o Serie TV');
      };
      const togli = s.querySelector('[data-p="togli"]');
      if (togli) togli.onclick = async () => {
        if (togli.dataset.conferma !== '1') { togli.dataset.conferma = '1'; togli.querySelector('small').textContent = 'Premi OK di nuovo per toglierla'; return; }
        await api.tmdbChiave('');
        imp = await api.impostazioni();
        catalogoDaRifare();
        await PAGINE.tmdb(null, 'Chiave tolta');
      };
    }, torna('tmdb'));
  },

  async sistema() {
    pannelloLaterale(`
      ${testaPagina('Sistema')}
      ${interruttore('avvioConWindows', imp.avvioConWindows, 'Avvia Salotto all\'accensione', 'Il PC si accende già in modalità TV', true)}
      <div class="imp-riga"><b>Tasto per tornare alla home</b><span>${escHtml(tastoLeggibile())} · oppure Home sul telefono</span></div>
      ${imp.piattaforma === 'win32' && !imp.edge ? '<div class="imp-riga"><b>Microsoft Edge non trovato</b><span>Le app “Edge” si aprono dentro Salotto: Netflix & co. potrebbero non funzionare</span></div>' : ''}`, (s) => {
      s.querySelector('[data-int="avvioConWindows"]').onclick = (e) => salvaInterruttore(e.currentTarget, 'avvioConWindows', !imp.avvioConWindows);
    }, torna('sistema'));
  },

  async energia() {
    pannelloLaterale(`
      ${testaPagina('Spegni e riavvia')}
      <div class="imp-elenco">
        <button class="f imp-voce piccola" data-e="sospendi" data-primo><span class="imp-testo"><b>Sospendi</b></span></button>
        <button class="f imp-voce piccola" data-e="riavvia"><span class="imp-testo"><b>Riavvia il PC</b></span></button>
        <button class="f imp-voce piccola" data-e="spegni"><span class="imp-testo"><b>Spegni il PC</b></span></button>
        <button class="f imp-voce piccola" data-e="esci"><span class="imp-testo"><b>Esci da Salotto</b><small>Torna al desktop di Windows</small></span></button>
      </div>`, (s) => {
      s.querySelector('.imp-elenco').onclick = async (e) => {
        const b = e.target.closest('[data-e]'); if (!b) return;
        const a = b.dataset.e;
        if ((a === 'spegni' || a === 'riavvia') && b.dataset.conferma !== '1') { b.dataset.conferma = '1'; b.querySelector('b').textContent = 'Premi ancora per confermare'; return; }
        if (!(await api.energia(a))) avviso('Disponibile solo su Windows');
      };
    }, torna('energia'));
  },

  async info() {
    const tel = await api.infoTelecomando();
    const righe = [
      ['Versione', `Salotto ${imp.versione || ''}`],
      ['Telecomando', tel.url],
      ['Ricevitore', imp.nomeRicevitore],
      ['Microsoft Edge', imp.edge ? 'Trovato' : (imp.piattaforma === 'win32' ? 'Non trovato' : '—')],
      ['App nella home', String(imp.app.length)],
    ];
    pannelloLaterale(`
      ${testaPagina('Informazioni')}
      ${righe.map(([k, v]) => `<div class="imp-riga"><b>${escHtml(k)}</b><span>${escHtml(v)}</span></div>`).join('')}
      <button class="f imp-voce piccola" data-primo data-p="ok"><span class="imp-testo"><b>Indietro</b></span></button>`, (s) => {
      s.querySelector('[data-p="ok"]').onclick = torna('info');
    }, torna('info'));
  },
};

// Se nel frattempo si è usciti dalla pagina Bluetooth, le risposte lente di Windows non la riaprono.
function schedaBluetoothChiusa() {
  const h = $('#scheda h1');
  return $('#pannello').hidden || !h || h.textContent !== 'Bluetooth';
}

azioni.impostazioni = () => impostazioniTV();
