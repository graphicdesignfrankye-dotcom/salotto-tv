// Film e Serie TV per le schermate stile Google TV, dal catalogo di TMDB (themoviedb.org).
// La chiave resta nel processo principale: l'interfaccia riceve solo i dati già pronti.
// Accetta sia la "Chiave API" (corta) sia il "Token di accesso in lettura" (lungo, inizia con eyJ).
// "Dove guardarlo" usa i dati di JustWatch che TMDB fornisce per l'Italia.
'use strict';

const BASE = 'https://api.themoviedb.org/3/';
const IMG = 'https://image.tmdb.org/t/p/';
const DURATA_CACHE = 6 * 60 * 60 * 1000;

// Servizi di streaming di TMDB → app di Salotto (id del catalogo).
const SERVIZI = [
  ['netflix', /^netflix$/i],
  ['prime', /^amazon prime video$/i],
  ['disney', /^disney plus$/i],
  ['raiplay', /^rai ?play$/i],
  ['mediaset', /mediaset infinity/i],
  ['now', /^now( tv)?$/i],
  ['appletv', /^apple tv\+?( plus)?$/i],
  ['paramount', /^paramount\+?( plus)?$/i],
  ['timvision', /^timvision$/i],
  ['crunchyroll', /^crunchyroll$/i],
  ['dazn', /^dazn$/i],
  ['mubi', /^mubi$/i],
  ['rakuten', /^rakuten tv$/i],
  ['chili', /^chili$/i],
  ['plutotv', /^pluto tv$/i],
  ['skygo', /^sky go$/i],
];
const nomeBreve = (n) => n.replace(/^Amazon /, '').replace('Disney Plus', 'Disney+').replace(/^Rai ?Play$/i, 'RaiPlay');
// Due elenchi mescolati a turno (film, serie, film, ...), senza doppioni.
function alterna(a, b) {
  const fuori = [], visti = new Set();
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    for (const v of [a[i], b[i]]) if (v && !visti.has(v.tipo + v.id)) { visti.add(v.tipo + v.id); fuori.push(v); }
  }
  return fuori;
}
const appDelServizio = (nome) => (SERVIZI.find(([, re]) => re.test(String(nome || '').trim())) || [])[0] || null;

// Generi mostrati come file, nell'ordine (id di TMDB).
const GENERI = {
  movie: [[28, 'Azione'], [35, 'Commedie'], [16, 'Animazione'], [53, 'Thriller'], [27, 'Horror'], [10749, 'Romantici'], [99, 'Documentari']],
  tv: [[80, 'Crime'], [35, 'Commedie'], [18, 'Drammi'], [10765, 'Fantascienza e fantasy'], [16, 'Animazione'], [10764, 'Reality'], [99, 'Documentari']],
};

const anno = (d) => (d ? String(d).slice(0, 4) : '');
function voce(x, tipo) {
  const t = x.media_type === 'tv' || x.media_type === 'movie' ? x.media_type : tipo;
  return {
    id: x.id,
    tipo: t,
    titolo: x.title || x.name || '',
    anno: anno(x.release_date || x.first_air_date),
    trama: x.overview || '',
    voto: x.vote_average ? Math.round(x.vote_average * 10) / 10 : 0,
    poster: x.poster_path ? IMG + 'w342' + x.poster_path : '',
    sfondo: x.backdrop_path ? IMG + 'w1280' + x.backdrop_path : '',
  };
}

class Tmdb {
  constructor(leggiChiave, log = () => {}) {
    this.leggiChiave = leggiChiave;
    this.log = log;
    this.cache = new Map(); // indirizzo → { quando, dati }
    this.provider = {};     // tipo → [{ id, nome, app }]
  }
  attivo() { return Boolean(this.leggiChiave()); }
  dimentica() { this.cache.clear(); this.provider = {}; }

  async chiama(percorso, parametri = {}, chiave = this.leggiChiave()) {
    if (!chiave) throw new Error('manca la chiave TMDB');
    const u = new URL(percorso, BASE);
    const token = chiave.length > 60;
    if (!token) u.searchParams.set('api_key', chiave);
    u.searchParams.set('language', 'it-IT');
    for (const [k, v] of Object.entries(parametri)) u.searchParams.set(k, String(v));
    const indirizzo = u.toString();
    const c = this.cache.get(indirizzo);
    if (c && Date.now() - c.quando < DURATA_CACHE) return c.dati;
    const r = await fetch(indirizzo, {
      headers: { Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + chiave } : {}) },
      signal: AbortSignal.timeout(12000),
    });
    if (r.status === 401) throw new Error('chiave TMDB non valida');
    if (!r.ok) throw new Error('TMDB ha risposto ' + r.status);
    const dati = await r.json();
    this.cache.set(indirizzo, { quando: Date.now(), dati });
    return dati;
  }

  // Prova una chiave prima di salvarla.
  async prova(chiave) {
    try { await this.chiama('configuration', {}, chiave); return { ok: true }; } catch (e) { return { ok: false, errore: e.message }; }
  }

  async servizi(tipo) {
    if (this.provider[tipo]) return this.provider[tipo];
    const r = await this.chiama(`watch/providers/${tipo}`, { watch_region: 'IT' });
    this.provider[tipo] = (r.results || []).map((p) => ({ id: p.provider_id, nome: p.provider_name, app: appDelServizio(p.provider_name) })).filter((p) => p.app);
    return this.provider[tipo];
  }

  // Schermata Film (tipo "movie") o Serie TV ("tv"): carosello in alto e file orizzontali.
  // appUtente: id delle app nella home, per mostrare prima i servizi che si hanno.
  async schermata(tipo, appUtente = []) {
    const elenco = (r) => (r.results || []).filter((x) => x.poster_path).map((x) => voce(x, tipo));
    const scopri = (p) => this.chiama(`discover/${tipo}`, { watch_region: 'IT', sort_by: 'popularity.desc', 'vote_count.gte': 30, ...p }).then(elenco);
    const servizi = (await this.servizi(tipo).catch(() => [])).filter((s) => appUtente.includes(s.app));
    const visti = new Set();
    const richieste = [
      ['Di tendenza questa settimana', this.chiama(`trending/${tipo}/week`).then(elenco)],
      ...servizi.map((s) => [`Su ${nomeBreve(s.nome)}`,
        scopri({ with_watch_providers: s.id, with_watch_monetization_types: 'flatrate|free|ads' }), s.app]),
      [tipo === 'movie' ? 'Al cinema' : 'In onda ora', this.chiama(tipo === 'movie' ? 'movie/now_playing' : 'tv/on_the_air', { region: 'IT' }).then(elenco)],
      ['I più votati', this.chiama(`${tipo}/top_rated`, { region: 'IT' }).then(elenco)],
      ...GENERI[tipo].map(([g, nome]) => [nome, scopri({ with_genres: g })]),
    ];
    const file = [];
    for (const [titolo, p, app] of richieste) {
      try {
        const voci = (await p).slice(0, 20);
        if (voci.length >= 4) file.push({ titolo, app: app || null, voci });
      } catch (e) { this.log(`tmdb: fila "${titolo}": ${e.message}`); if (/chiave/.test(e.message)) throw e; }
    }
    // Carosello: i titoli di tendenza con un'immagine grande, senza ripetizioni.
    const eroe = (file[0] ? file[0].voci : []).filter((v) => v.sfondo && v.trama && !visti.has(v.id) && visti.add(v.id)).slice(0, 6);
    return { eroe, file };
  }

  // Home "Per te" come su Google TV: carosello misto film e serie, poi tendenze e una fila per ogni servizio che si ha.
  async home(appUtente = []) {
    const elenco = (tipo) => (r) => (r.results || [])
      .filter((x) => x.poster_path && (!x.media_type || x.media_type === 'movie' || x.media_type === 'tv')).map((x) => voce(x, tipo));
    const file = [];
    const aggiungi = async (titolo, p, app, sezione) => {
      try {
        const voci = (await p).slice(0, 20);
        if (voci.length >= 4) file.push({ titolo, app: app || null, sezione, voci });
      } catch (e) { this.log(`tmdb: fila "${titolo}": ${e.message}`); if (/chiave/.test(e.message)) throw e; }
    };
    const tutto = await this.chiama('trending/all/week').then(elenco('movie'));
    await aggiungi('Film di tendenza', this.chiama('trending/movie/week').then(elenco('movie')), null, 'film');
    await aggiungi('Serie TV di tendenza', this.chiama('trending/tv/week').then(elenco('tv')), null, 'serie');
    const [sm, st] = await Promise.all([this.servizi('movie').catch(() => []), this.servizi('tv').catch(() => [])]);
    const scopri = (tipo, s) => (s ? this.chiama(`discover/${tipo}`, { watch_region: 'IT', sort_by: 'popularity.desc', 'vote_count.gte': 30,
      with_watch_providers: s.id, with_watch_monetization_types: 'flatrate|free|ads' }).then(elenco(tipo)) : Promise.resolve([]));
    const app = [...new Set([...sm, ...st].map((s) => s.app))].filter((a) => appUtente.includes(a)).slice(0, 5);
    for (const a of app) {
      const m = sm.find((s) => s.app === a), t = st.find((s) => s.app === a);
      await aggiungi(`Su ${nomeBreve((m || t).nome)}`, Promise.all([scopri('movie', m), scopri('tv', t)]).then(([x, y]) => alterna(x, y)), a, 'servizi');
    }
    const eroe = tutto.filter((v) => v.sfondo && v.trama).slice(0, 6);
    return { eroe, file };
  }

  // Scheda di un titolo: dati, dove guardarlo in Italia e trailer.
  async dettagli(tipo, id) {
    const d = await this.chiama(`${tipo}/${id}`, { append_to_response: 'watch/providers,videos', include_video_language: 'it,en' });
    const it = ((d['watch/providers'] || {}).results || {}).IT || {};
    const dove = [];
    for (const gruppo of ['flatrate', 'free', 'ads']) {
      for (const p of it[gruppo] || []) {
        if (dove.some((x) => x.nome === p.provider_name)) continue;
        dove.push({ nome: p.provider_name, logo: p.logo_path ? IMG + 'w92' + p.logo_path : '', app: appDelServizio(p.provider_name) });
      }
    }
    const noleggio = [...new Set([...(it.rent || []), ...(it.buy || [])].map((p) => p.provider_name))].slice(0, 4);
    const video = ((d.videos || {}).results || []).filter((v) => v.site === 'YouTube' && /^[\w-]{6,20}$/.test(v.key));
    const trailer = video.find((v) => v.type === 'Trailer' && v.iso_639_1 === 'it') || video.find((v) => v.type === 'Trailer') || video[0];
    return {
      ...voce(d, tipo),
      generi: (d.genres || []).map((g) => g.name),
      durata: d.runtime ? `${Math.floor(d.runtime / 60)} h ${d.runtime % 60} min`.replace(/^0 h /, '') : '',
      stagioni: d.number_of_seasons ? `${d.number_of_seasons} ${d.number_of_seasons === 1 ? 'stagione' : 'stagioni'}` : '',
      dove,
      noleggio,
      trailer: trailer ? trailer.key : null,
    };
  }
}

// Ricerca dentro l'app del servizio (per "Guarda su …"): Salotto apre l'app già sul titolo cercato.
const RICERCA = {
  netflix: (q) => 'https://www.netflix.com/search?q=' + encodeURIComponent(q),
  prime: (q) => 'https://www.primevideo.com/search?phrase=' + encodeURIComponent(q),
  disney: (q) => 'https://www.disneyplus.com/search?q=' + encodeURIComponent(q),
  raiplay: (q) => 'https://www.raiplay.it/ricerca.html?q=' + encodeURIComponent(q),
  youtube: (q) => 'https://www.youtube.com/tv#/search?q=' + encodeURIComponent(q),
};

module.exports = { Tmdb, RICERCA, appDelServizio };
