// Navigazione con le frecce "da TV" per i siti aperti in Edge da Salotto.
// Il canale di controllo (cdp.cjs) la inserisce in ogni pagina. Rispetto alla navigazione spaziale di Edge:
// - nelle file (caroselli) destra/sinistra vanno anche oltre il bordo e fanno scorrere il carosello;
// - su/giù passano alla fila sopra/sotto e la portano al centro;
// - dentro un campo di testo su/giù escono dal campo; con un video grande le frecce restano al sito.
(() => {
  if (window.__salottoNav) return;
  window.__salottoNav = true;

  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), [role=button], [role=link], [role=tab], [role=menuitem], [contenteditable=""], [contenteditable=true]';
  const DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const testo = (el) => el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(button|submit|reset|checkbox|radio|range|color|file|image)$/i.test(el.type)));

  function visibile(el) {
    if (el.disabled || el.closest('[inert],[aria-hidden=true]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  }
  // Pulsantini sovrapposti a un elemento più grande (es. "maggiori informazioni" sopra una copertina): si saltano.
  function sovrapposto(el, r, tutti) {
    return tutti.some((o) => o.el !== el && o.r.width * o.r.height > r.width * r.height * 1.5
      && r.left >= o.r.left - 2 && r.right <= o.r.right + 2 && r.top >= o.r.top - 2 && r.bottom <= o.r.bottom + 2);
  }
  function candidati() {
    const lista = [];
    for (const el of document.querySelectorAll(SEL)) if (visibile(el)) lista.push({ el, r: el.getBoundingClientRect() });
    return lista.filter((o) => !sovrapposto(o.el, o.r, lista));
  }
  const W = () => innerWidth, H = () => innerHeight;
  const dentroSchermoX = (r) => r.right > 0 && r.left < W();

  function migliore(da, dir, lista) {
    const c = { x: da.left + da.width / 2, y: da.top + da.height / 2 };
    let best = null, punti = Infinity;
    for (const o of lista) {
      const r = o.r;
      const p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      let principale, laterale;
      if (dir === 'right' || dir === 'left') {
        // stessa fila: deve sovrapporsi in verticale; può essere anche fuori dallo schermo (carosello)
        const sovrap = Math.min(r.bottom, da.bottom) - Math.max(r.top, da.top);
        if (sovrap < Math.min(r.height, da.height) * 0.3) continue;
        principale = dir === 'right' ? r.left - da.left : da.right - r.right;
        if (principale <= 1) continue;
        laterale = Math.abs(p.y - c.y);
      } else {
        // altra fila: solo ciò che si vede in orizzontale (non i titoli nascosti dei caroselli)
        if (!dentroSchermoX(r)) continue;
        principale = dir === 'down' ? r.top - da.top : da.bottom - r.bottom;
        if (principale <= 1 || (dir === 'down' ? r.top < da.bottom - da.height * 0.5 : r.bottom > da.top + da.height * 0.5)) continue;
        laterale = Math.abs(p.x - c.x);
      }
      const s = principale + laterale * (dir === 'up' || dir === 'down' ? 0.5 : 2);
      if (s < punti) { punti = s; best = o.el; }
    }
    return best;
  }

  // Swiper (RaiPlay e molti altri): si fa scorrere fino alla scheda che contiene l'elemento.
  function scorriCarosello(el) {
    let sw = null;
    for (let p = el.parentElement; p; p = p.parentElement) if (p.swiper && p.swiper.slides) { sw = p.swiper; break; }
    if (sw) {
      // "successivo"/"precedente" rispettano i gruppi del carosello (es. RaiPlay scorre 7 titoli alla volta)
      const r = el.getBoundingClientRect();
      try {
        if (r.right > W() + 2) { sw.slideNext(); return true; }
        if (r.left < -2) { sw.slidePrev(); return true; }
      } catch { /* versione di Swiper diversa */ }
      return false;
    }
    return false;
  }
  function portaInVista(el, dir) {
    if (scorriCarosello(el)) return;
    const r = el.getBoundingClientRect();
    if (dir === 'up' || dir === 'down' || r.top < 0 || r.bottom > H()) {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    } else if (r.left < 0 || r.right > W()) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }
  // Carosello che non ha l'elemento successivo nella pagina: si preme la sua freccia "successivo"/"precedente".
  function frecciaCarosello(da, dir) {
    const re = dir === 'right' ? /next|succ|avanti|right|forward|destra/i : /prev|preced|indietro|left|back|sinistra/i;
    for (let p = da.parentElement, i = 0; p && i < 7; p = p.parentElement, i++) {
      const b = Array.from(p.querySelectorAll('button,[role=button],a,div,span')).find((x) => {
        const etichetta = (x.getAttribute('aria-label') || '') + ' ' + (typeof x.className === 'string' ? x.className : '');
        return re.test(etichetta) && !x.contains(da) && x.getBoundingClientRect().width > 0;
      });
      if (b) { b.click(); return true; }
    }
    return false;
  }
  // Carosello Swiper che contiene l'elemento (null se non c'è).
  function caroselloDi(el) {
    for (let p = el && el.parentElement; p; p = p.parentElement) if (p.swiper && p.swiper.slides) return p;
    return null;
  }
  // Dentro un carosello: una sola voce per scheda (la prima selezionabile), così destra/sinistra vanno di scheda in scheda.
  function vociCarosello(cont) {
    const voci = [];
    for (const sl of Array.from(cont.swiper.slides)) {
      const el = Array.from(sl.querySelectorAll(SEL)).find((x) => { const q = x.getBoundingClientRect(); return q.width >= 8 && q.height >= 8; });
      if (el) voci.push({ el, scheda: sl, r: el.getBoundingClientRect() });
    }
    return voci;
  }
  function videoGrande() {
    if (document.fullscreenElement) return true;
    return Array.from(document.querySelectorAll('video')).some((v) => {
      const r = v.getBoundingClientRect();
      return !v.paused && r.width * r.height > W() * H() * 0.6;
    });
  }
  function primo(lista) {
    // nulla selezionato: il primo elemento visibile, dall'alto a sinistra
    const vis = lista.filter((o) => dentroSchermoX(o.r) && o.r.bottom > 0 && o.r.top < H());
    vis.sort((a, b) => (a.r.top - b.r.top) || (a.r.left - b.r.left));
    return vis[0] && vis[0].el;
  }
  // Ultimo elemento selezionato dalle frecce: se il sito sposta la selezione da solo (anteprime, menu che si aprono
  // al passaggio) senza che si sia premuto OK, la freccia dopo riparte da qui.
  let ultimo = null, dopoInvio = false, quando = 0;
  function seleziona(el, dir) {
    ultimo = el; dopoInvio = false; quando = Date.now();
    try { el.focus({ preventScroll: true }); } catch { el.focus(); }
    if (document.activeElement !== el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
    portaInVista(el, dir);
  }

  // Se il sito toglie la selezione subito dopo una freccia (senza OK), la si rimette: il bordo bianco non sparisce.
  const rimetti = () => {
    if (!ultimo || dopoInvio || !ultimo.isConnected || Date.now() - quando > 1500) return;
    if (document.activeElement !== ultimo && visibile(ultimo)) { try { ultimo.focus({ preventScroll: true }); } catch { /* niente */ } }
  };
  addEventListener('focusin', (e) => { if (ultimo && e.target !== ultimo && !ultimo.contains(e.target)) setTimeout(rimetti, 0); }, true);
  addEventListener('focusout', (e) => { if (e.target === ultimo && !e.relatedTarget) setTimeout(rimetti, 60); }, true);

  addEventListener('keydown', (e) => {
    let att = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    if (e.key === 'Enter') dopoInvio = true;
    else if (DIR[e.key] && ultimo && att !== ultimo && !dopoInvio && ultimo.isConnected && visibile(ultimo)) att = ultimo;
    if (e.key === 'Enter' && att && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(att.tagName) && !att.isContentEditable) {
      e.preventDefault(); att.click(); return;
    }
    const dir = DIR[e.key];
    if (!dir || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (videoGrande()) return; // il lettore del sito usa le frecce (avanti/indietro, volume)
    if (att && testo(att) && (dir === 'left' || dir === 'right')) return; // cursore nel testo
    if (att && att.tagName === 'SELECT' && (dir === 'up' || dir === 'down')) return;
    const lista = candidati();
    if (!att) { const p = primo(lista); if (p) { e.preventDefault(); seleziona(p, dir); } return; }
    let prossimo = null;
    const car = caroselloDi(att);
    if (car && (dir === 'left' || dir === 'right')) {
      // nel carosello: la scheda prima/dopo quella attuale
      const voci = vociCarosello(car);
      // la scheda (dall'elenco di Swiper, i nomi delle classi cambiano da sito a sito) che contiene l'elemento attuale
      const i = voci.findIndex((o) => o.scheda.contains(att));
      if (i >= 0) {
        const j = dir === 'right' ? i + 1 : i - 1;
        if (voci[j]) { e.preventDefault(); e.stopPropagation(); seleziona(voci[j].el, dir); }
        else e.preventDefault(); // fine della fila: si resta qui (come sulle TV)
        return;
      }
    }
    if (!prossimo) prossimo = migliore(att.getBoundingClientRect(), dir, lista.filter((o) => o.el !== att && !o.el.contains(att)));
    if (prossimo) { e.preventDefault(); e.stopPropagation(); seleziona(prossimo, dir); return; }
    if ((dir === 'left' || dir === 'right') && frecciaCarosello(att, dir)) {
      e.preventDefault();
      setTimeout(() => { const n = migliore(att.getBoundingClientRect(), dir, candidati().filter((o) => o.el !== att)); if (n) seleziona(n, dir); }, 450);
      return;
    }
    // niente in quella direzione: si scorre la pagina come farebbe la freccia
    if (dir === 'up' || dir === 'down') { e.preventDefault(); scrollBy({ top: (dir === 'down' ? 1 : -1) * H() * 0.6, behavior: 'smooth' }); }
  }, true);
})();
