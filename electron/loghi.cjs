// Loghi delle app: prende l'icona ufficiale dal sito di ogni servizio (icone del manifest,
// apple-touch-icon, icone dichiarate nella pagina, favicon) e la tiene in una cartella,
// così la home mostra il logo vero anche senza rete. Funziona anche per le app aggiunte a mano.
'use strict';
const fs = require('fs');
const path = require('path');

const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';
const MAX_BYTE = 1024 * 1024;
const TIPI = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const RIPROVA_DOPO = 24 * 3600 * 1000; // se un sito non dà il logo, si riprova il giorno dopo

async function scarica(url, ms = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': AGENTE, 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5' }, redirect: 'follow', signal: c.signal });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTE * 3) return null;
    return { buf, tipo: (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(), url: r.url };
  } catch { return null; } finally { clearTimeout(t); }
}

const attr = (tag, nome) => { const m = tag.match(new RegExp(`\\b${nome}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')); return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null; };
const lato = (sizes) => { if (!sizes) return 0; if (/any/i.test(sizes)) return 512; return Math.max(0, ...String(sizes).split(/\s+/).map((s) => parseInt(s, 10) || 0)); };
const ass = (h, base) => { try { return new URL(h.replace(/&amp;/g, '&'), base).href; } catch { return null; } };

// Elenco dei candidati dalla pagina, dal più bello al meno bello.
async function candidati(sito) {
  const lista = [];
  const pag = await scarica(sito);
  const base = pag ? pag.url : sito;
  if (pag && /html/.test(pag.tipo)) {
    const html = pag.buf.toString('utf8').slice(0, 400000);
    for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
      const rel = (attr(tag, 'rel') || '').toLowerCase();
      const href = attr(tag, 'href');
      if (!href) continue;
      if (rel === 'manifest') {
        const man = await scarica(ass(href, base));
        if (!man) continue;
        try {
          const j = JSON.parse(man.buf.toString('utf8'));
          for (const i of j.icons || []) {
            if (!i.src) continue;
            const pur = String(i.purpose || 'any');
            if (/monochrome/.test(pur)) continue;
            lista.push({ url: ass(i.src, man.url), lato: lato(i.sizes), voto: /maskable/.test(pur) && !/any/.test(pur) ? 1 : 3 });
          }
        } catch { /* manifest non valido */ }
      } else if (rel.includes('apple-touch-icon')) {
        lista.push({ url: ass(href, base), lato: lato(attr(tag, 'sizes')) || 180, voto: 3 });
      } else if (/(^|\s)icon(\s|$)/.test(rel) && !rel.includes('mask')) {
        const tipo = attr(tag, 'type') || '';
        const l = lato(attr(tag, 'sizes')) || (/svg/.test(tipo) || /\.svg(\?|$)/i.test(href) ? 256 : 32);
        lista.push({ url: ass(href, base), lato: l, voto: 2 });
      }
    }
  }
  lista.push({ url: ass('/apple-touch-icon.png', base), lato: 180, voto: 1 });
  lista.push({ url: ass('/favicon.ico', base), lato: 32, voto: 0 });
  // Prima le icone grandi (almeno 96 px), poi a parità quelle più "da app".
  return lista.filter((c) => c.url && /^https?:/.test(c.url))
    .sort((a, b) => (b.lato >= 96) - (a.lato >= 96) || b.voto - a.voto || b.lato - a.lato)
    .filter((c, i, a) => a.findIndex((x) => x.url === c.url) === i);
}

function eImmagine(d) {
  if (!d || d.buf.length < 100 || d.buf.length > MAX_BYTE) return null;
  let est = TIPI[d.tipo];
  const b = d.buf;
  if (!est) {
    if (b[0] === 0x89 && b[1] === 0x50) est = 'png';
    else if (b[0] === 0 && b[1] === 0 && b[2] === 1) est = 'ico';
    else if (b[0] === 0xff && b[1] === 0xd8) est = 'jpg';
    else if (/^\s*(<\?xml|<svg)/i.test(b.slice(0, 200).toString('utf8'))) est = 'svg';
  }
  if (est === 'svg' && !/<svg/i.test(b.toString('utf8'))) return null;
  return est || null;
}

async function trovaLogo(sito) {
  for (const c of (await candidati(sito)).slice(0, 8)) {
    const d = await scarica(c.url);
    const est = eImmagine(d);
    if (est) return { buf: d.buf, est, da: c.url };
  }
  return null;
}

// Indirizzo del sito da cui prendere il logo: quello dell'app, oppure "sito" se l'app è un programma o un link speciale.
function sitoDi(a) {
  const u = a.sito || a.url;
  if (!u || !/^https?:\/\//i.test(u)) return null;
  try { const x = new URL(u); return x.protocol + '//' + x.host + '/'; } catch { return null; }
}

class Loghi {
  constructor(cartella, log = () => {}) {
    this.cartella = path.join(cartella, 'loghi');
    this.log = log;
    this.inCorso = new Map();
    fs.mkdirSync(this.cartella, { recursive: true });
  }
  file(id) {
    for (const est of ['png', 'svg', 'ico', 'jpg', 'webp', 'gif']) {
      const f = path.join(this.cartella, `${id}.${est}`);
      if (fs.existsSync(f)) return f;
    }
    return null;
  }
  // Logo già salvato, come data: URL (null se non c'è).
  dataUrl(id) {
    const f = this.file(id);
    if (!f) return null;
    const est = path.extname(f).slice(1);
    const mime = { svg: 'image/svg+xml', ico: 'image/x-icon', jpg: 'image/jpeg' }[est] || `image/${est}`;
    return `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
  }
  // Scarica il logo se manca (una volta sola per app; se non riesce riprova dopo un giorno).
  prendi(a) {
    const id = String(a.id || '').replace(/[^a-z0-9_-]/gi, '');
    const sito = sitoDi(a);
    if (!id || !sito || this.file(id)) return Promise.resolve(false);
    const segno = path.join(this.cartella, `${id}.manca`);
    try { if (Date.now() - fs.statSync(segno).mtimeMs < RIPROVA_DOPO && fs.readFileSync(segno, 'utf8') === sito) return Promise.resolve(false); } catch { /* mai provato */ }
    if (this.inCorso.has(id)) return this.inCorso.get(id);
    const p = trovaLogo(sito).then((l) => {
      if (!l) { fs.writeFileSync(segno, sito); this.log(`logo di ${id}: non trovato su ${sito}`); return false; }
      fs.writeFileSync(path.join(this.cartella, `${id}.${l.est}`), l.buf);
      try { fs.unlinkSync(segno); } catch { /* non c'era */ }
      this.log(`logo di ${id}: ${l.da}`);
      return true;
    }).catch((e) => { this.log(`logo di ${id}: ${e.message}`); return false; }).finally(() => this.inCorso.delete(id));
    this.inCorso.set(id, p);
    return p;
  }
  // Quando l'indirizzo di un'app cambia, il logo vecchio va buttato.
  dimentica(id) {
    for (const f of fs.readdirSync(this.cartella)) if (f.startsWith(id + '.')) try { fs.unlinkSync(path.join(this.cartella, f)); } catch { /* già tolto */ }
  }
}

module.exports = { Loghi, trovaLogo, sitoDi };
