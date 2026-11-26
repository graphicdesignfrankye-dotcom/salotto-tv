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
    ['trasmissione', 'Trasmissione', `${trasm} · “${escHtml(imp.nomeRicevitore)}”`],
    ['telecomando', 'Telecomando', imp.telefoniAbbinati ? `${imp.telefoniAbbinati} telefoni abbinati` : 'Usa il telefono come telecomando'],
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

azioni.impostazioni = () => impostazioniTV();
