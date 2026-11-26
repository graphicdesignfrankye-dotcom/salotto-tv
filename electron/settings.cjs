// Impostazioni di Salotto, salvate in %APPDATA%/Salotto/impostazioni.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Modalità di apertura di un'app:
//  - "edge":    Microsoft Edge a schermo intero (finestra app). Serve per Netflix & co. perché ha il DRM PlayReady.
//  - "interna": dentro Salotto (Chromium di Electron). Va bene per siti senza DRM, es. YouTube per TV.
//  - "link":    apre un indirizzo speciale con il programma di Windows associato (es. steam://open/bigpicture).
//  - "programma": avvia un .exe (campo "percorso").
const APP_PREDEFINITE = [
  { id: 'youtube', nome: 'YouTube', url: 'https://www.youtube.com/tv', modo: 'interna', agente: 'tv', colore: '#e5322d' },
  { id: 'netflix', nome: 'Netflix', url: 'https://www.netflix.com/browse', modo: 'edge', colore: '#b1060f' },
  { id: 'prime', nome: 'Prime Video', url: 'https://www.primevideo.com', modo: 'edge', colore: '#1a98ff' },
  { id: 'disney', nome: 'Disney+', url: 'https://www.disneyplus.com', modo: 'edge', colore: '#113ccf' },
  { id: 'raiplay', nome: 'RaiPlay', url: 'https://www.raiplay.it', modo: 'edge', colore: '#0a4ea2' },
  { id: 'mediaset', nome: 'Mediaset Infinity', url: 'https://mediasetinfinity.mediaset.it', modo: 'edge', colore: '#1c1c3c' },
  { id: 'dazn', nome: 'DAZN', url: 'https://www.dazn.com', modo: 'edge', colore: '#1a1a1a' },
  { id: 'spotify', nome: 'Spotify', url: 'https://open.spotify.com', modo: 'edge', colore: '#1db954' },
  { id: 'twitch', nome: 'Twitch', url: 'https://www.twitch.tv', modo: 'edge', colore: '#9146ff' },
];

const AGENTI = {
  // YouTube mostra l'interfaccia per TV (youtube.com/tv) solo ai televisori.
  tv: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36',
};

function predefinite() {
  return {
    nome: 'Salotto',
    app: APP_PREDEFINITE.map((a) => ({ ...a })),
    avvioConWindows: false,
    tastoHome: 'Control+Alt+H',
    porta: 8765,
    pin: String(crypto.randomInt(1000, 10000)),
    tokenTelefoni: [],
    dlna: true,
    airplay: true,
    edgeDentro: true, // le app che si aprono in Edge stanno dentro la finestra di Salotto
    nomeRicevitore: 'Salotto (PC)',
    tmdbChiave: '', // chiave di themoviedb.org per le schermate Film e Serie TV (resta solo su questo PC)
    uuid: crypto.randomUUID(),
  };
}

class Impostazioni {
  constructor(cartella) {
    this.file = path.join(cartella, 'impostazioni.json');
    this.dati = predefinite();
    try {
      const letti = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.dati = { ...this.dati, ...letti };
    } catch { /* primo avvio: restano le predefinite */ }
    this.salva();
  }
  get(k) { return this.dati[k]; }
  set(k, v) { this.dati[k] = v; this.salva(); }
  salva() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.dati, null, 2));
    fs.renameSync(tmp, this.file);
  }
  // Solo ciò che serve all'interfaccia (niente token dei telefoni, niente chiave TMDB).
  pubbliche() {
    const { tokenTelefoni, tmdbChiave, ...resto } = this.dati;
    return { ...resto, telefoniAbbinati: tokenTelefoni.length, tmdbAttivo: Boolean(tmdbChiave) };
  }
}

module.exports = { Impostazioni, AGENTI, APP_PREDEFINITE };
