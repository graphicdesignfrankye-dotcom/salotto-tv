// Test di electron/tmdb.cjs con risposte finte di TMDB (niente rete).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Tmdb, RICERCA, appDelServizio } = require('../electron/tmdb.cjs');

const titolo = (i, extra = {}) => ({ id: i, title: 'Film ' + i, release_date: '2025-03-01', overview: 'Trama ' + i, vote_average: 7.46, poster_path: '/p' + i + '.jpg', backdrop_path: '/b' + i + '.jpg', ...extra });
const pagina = (da) => ({ results: Array.from({ length: 10 }, (_, i) => titolo(da + i)) });

function finto(chiamate) {
  return async (url, opz) => {
    const u = new URL(url);
    chiamate.push({ u, opz });
    const p = u.pathname.replace('/3/', '');
    let corpo;
    if (u.searchParams.get('api_key') === 'sbagliata') return { ok: false, status: 401, json: async () => ({}) };
    if (p === 'configuration') corpo = { images: {} };
    else if (p === 'watch/providers/movie') corpo = { results: [{ provider_id: 8, provider_name: 'Netflix' }, { provider_id: 1796, provider_name: 'Netflix basic with Ads' }, { provider_id: 119, provider_name: 'Amazon Prime Video' }, { provider_id: 337, provider_name: 'Disney Plus' }] };
    else if (p === 'movie/550') corpo = { ...titolo(550), runtime: 139, genres: [{ name: 'Dramma' }],
      'watch/providers': { results: { IT: { flatrate: [{ provider_name: 'Netflix', logo_path: '/n.jpg' }, { provider_name: 'Disney Plus' }], rent: [{ provider_name: 'Apple TV' }] } } },
      videos: { results: [{ site: 'YouTube', key: 'abcDEF12345', type: 'Teaser', iso_639_1: 'en' }, { site: 'YouTube', key: 'itaTRAILER1', type: 'Trailer', iso_639_1: 'it' }] } };
    else corpo = pagina(Number(u.searchParams.get('with_watch_providers') || u.searchParams.get('with_genres') || 1) * 100);
    return { ok: true, status: 200, json: async () => corpo };
  };
}

test('servizi di TMDB → app di Salotto', () => {
  assert.equal(appDelServizio('Netflix'), 'netflix');
  assert.equal(appDelServizio('Netflix basic with Ads'), null);
  assert.equal(appDelServizio('Amazon Prime Video'), 'prime');
  assert.equal(appDelServizio('Disney Plus'), 'disney');
  assert.equal(appDelServizio('Rai Play'), 'raiplay');
});

test('schermata: file per i servizi che si hanno, carosello e chiave nell\'indirizzo', async () => {
  const chiamate = [];
  global.fetch = finto(chiamate);
  const t = new Tmdb(() => 'chiave-di-prova-123456789');
  const r = await t.schermata('movie', ['netflix', 'youtube']);
  const titoli = r.file.map((f) => f.titolo);
  assert.equal(titoli[0], 'Di tendenza questa settimana');
  assert.ok(titoli.includes('Su Netflix'));
  assert.ok(!titoli.includes('Su Prime Video'), 'Prime non è nella home');
  assert.ok(titoli.includes('Azione') && titoli.includes('I più votati'));
  assert.equal(r.eroe.length, 6);
  assert.match(r.eroe[0].sfondo, /^https:\/\/image\.tmdb\.org\/t\/p\/w1280\/b/);
  assert.equal(r.file[0].voci[0].voto, 7.5);
  assert.ok(chiamate.every((c) => c.u.searchParams.get('api_key') === 'chiave-di-prova-123456789' && c.u.searchParams.get('language') === 'it-IT'));
  const netflix = chiamate.find((c) => c.u.searchParams.get('with_watch_providers') === '8');
  assert.equal(netflix.u.searchParams.get('watch_region'), 'IT');
  // seconda volta: dalla cache, nessuna nuova chiamata
  const n = chiamate.length;
  await t.schermata('movie', ['netflix']);
  assert.equal(chiamate.length, n);
});

test('token lungo: va nell\'intestazione, non nell\'indirizzo', async () => {
  const chiamate = [];
  global.fetch = finto(chiamate);
  const token = 'eyJ' + 'x'.repeat(200);
  const t = new Tmdb(() => token);
  assert.deepEqual(await t.prova(token), { ok: true });
  assert.equal(chiamate[0].u.searchParams.get('api_key'), null);
  assert.equal(chiamate[0].opz.headers.Authorization, 'Bearer ' + token);
});

test('chiave sbagliata', async () => {
  global.fetch = finto([]);
  const t = new Tmdb(() => '');
  const r = await t.prova('sbagliata');
  assert.equal(r.ok, false);
  assert.match(r.errore, /non valida/);
});

test('dettagli: dove guardarlo, trailer italiano, durata', async () => {
  global.fetch = finto([]);
  const t = new Tmdb(() => 'chiave-di-prova-123456789');
  const d = await t.dettagli('movie', 550);
  assert.deepEqual(d.dove.map((x) => x.app), ['netflix', 'disney']);
  assert.equal(d.trailer, 'itaTRAILER1');
  assert.equal(d.durata, '2 h 19 min');
  assert.deepEqual(d.noleggio, ['Apple TV']);
});

test('ricerca dentro le app', () => {
  assert.equal(RICERCA.netflix('Il padrino'), 'https://www.netflix.com/search?q=Il%20padrino');
  assert.equal(RICERCA.prime('A&B'), 'https://www.primevideo.com/search?phrase=A%26B');
});
