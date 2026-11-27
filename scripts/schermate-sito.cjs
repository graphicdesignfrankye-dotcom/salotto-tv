// Schermate per il sito (site/img): l'interfaccia di Salotto con dati di esempio inventati.
// Uso: npx electron scripts/schermate-sito.cjs
// Niente locandine vere: titoli e immagini sono disegnati qui, per non usare materiale protetto.
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const USCITA = path.join(__dirname, '..', 'site', 'img');
const TITOLI = [
  ['Nebbia sul lago', '#3a5a7a', '#0d1620'], ['Codice Aurora', '#7a2e5a', '#16080f'], ['Il faro', '#c26a2a', '#1c0d05'],
  ['Notte a Napoli', '#2e3a7a', '#090b1a'], ['Orbita', '#1f7a6a', '#06140f'], ['La casa sul fiume', '#6a7a2e', '#12160a'],
  ['Vento del Nord', '#4a6a8a', '#0b1218'], ['Mezzanotte', '#5a2e7a', '#0e0816'], ['Le stagioni', '#b8862e', '#1a1206'],
  ['Il giardino', '#2e7a3a', '#08150b'], ['Fuori campo', '#8a3a2e', '#180a08'], ['Onde', '#2e6a9a', '#07111a'],
  ['Città di vetro', '#5a7a9a', '#0c121a'], ["L'ultima estate", '#c24a3a', '#1c0a08'],
];
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;');
function locandina(i, larga) {
  const [t, a, b] = TITOLI[i % TITOLI.length];
  const w = larga ? 1280 : 342, h = larga ? 720 : 513;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="r" cx=".7" cy=".3" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/>
    <circle cx="${w * (0.25 + (i % 5) * 0.12)}" cy="${h * 0.38}" r="${Math.min(w, h) * 0.18}" fill="#fff" fill-opacity=".10"/>
    <path d="M0 ${h * 0.78} Q ${w * 0.3} ${h * (0.62 + (i % 3) * 0.04)} ${w * 0.6} ${h * 0.74} T ${w} ${h * 0.7} V ${h} H 0 Z" fill="#000" fill-opacity=".35"/>
    ${larga ? '' : `<text x="24" y="${h - 34}" fill="#fff" font-family="Georgia, serif" font-size="34" font-weight="700">${esc(t)}</text>`}
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
const voce = (i, tipo) => ({
  id: 100 + i, tipo, titolo: TITOLI[i % TITOLI.length][0], anno: String(2026 - (i % 4)), voto: 6.8 + (i % 5) * 0.3,
  trama: 'Una storia di esempio scritta per il sito di Salotto: qui c’è la trama del titolo, come la mostra la TV quando ti fermi sul carosello.',
  poster: locandina(i, false), sfondo: locandina(i, true),
});
const fila = (titolo, da, sezione) => ({ titolo, sezione, voci: Array.from({ length: 14 }, (_, k) => voce(da + k, k % 2 ? 'tv' : 'movie')) });

async function scatta(win, nome, js, attesa = 900) {
  await win.webContents.executeJavaScript(`(async () => { ${js} })()`);
  await new Promise((ok) => setTimeout(ok, attesa));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(USCITA, nome), img.resize({ width: 1600 }).toJPEG(86));
  console.log('salvata', nome);
}

app.whenReady().then(async () => {
  fs.mkdirSync(USCITA, { recursive: true });
  const win = new BrowserWindow({ width: 1600, height: 900, show: false, webPreferences: { offscreen: true } });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  await new Promise((ok) => setTimeout(ok, 800));
  const dati = { eroe: [0, 3, 4, 7, 9, 12].map((i) => voce(i, i % 2 ? 'tv' : 'movie')),
    home: [fila('Film di tendenza', 0, 'film'), fila('Serie TV di tendenza', 5, 'serie'), fila('Su Netflix', 9, 'servizi')],
    film: [fila('Di tendenza questa settimana', 0), fila('Su Netflix', 3), fila('Su Prime Video', 6), fila('Al cinema', 9), fila('Commedie', 11)] };
  await win.webContents.executeJavaScript(`(async () => {
    const d = ${JSON.stringify(dati)};
    api.tmdbHome = async () => ({ ok: true, eroe: d.eroe, file: d.home });
    api.tmdbSchermata = async () => ({ ok: true, eroe: d.eroe, file: d.film });
    api.tmdbDettagli = async (tipo, id) => { const v = [...d.eroe, ...d.film.flatMap((f) => f.voci)].find((x) => x.id === id);
      return { ok: true, ...v, generi: ['Dramma', 'Mistero'], durata: '1 h 54 min', stagioni: '', dove: [{ nome: 'Netflix', logo: '', app: 'netflix' }, { nome: 'Amazon Prime Video', logo: '', app: 'prime' }], noleggio: [], trailer: 'abcdefghijk' }; };
    await api.tmdbChiave('x'.repeat(32));
    imp = await api.impostazioni();
    document.body.classList.remove('mouse');
    await caricaHome(true);
  })()`);
  await scatta(win, 'home.jpg', `metti(document.querySelector('#home-eroe .eroe-tmdb'));`, 1500);
  await scatta(win, 'home-file.jpg', `metti(document.querySelector('#home-titoli [data-tmdb]'));`, 1200);
  await scatta(win, 'film.jpg', `metti(document.querySelector('.tab[data-schermata="film"]')); await new Promise((r) => setTimeout(r, 600)); metti(document.querySelector('#cat-movie .fila [data-tmdb]:nth-child(3)'));`, 1500);
  await scatta(win, 'titolo.jpg', `document.querySelector('#cat-movie .fila [data-tmdb]:nth-child(3)').click();`, 1500);
  await scatta(win, 'impostazioni.jpg', `chiudiPannello(); metti(document.querySelector('.tab[data-schermata="home"]')); impostazioniTV();`, 1200);
  await scatta(win, 'app.jpg', `chiudiPannello(); metti(document.querySelector('.tab[data-schermata="app"]')); await new Promise((r) => setTimeout(r, 300)); metti(document.querySelector('#griglia-app .f'));`, 1500);
  app.quit();
});
