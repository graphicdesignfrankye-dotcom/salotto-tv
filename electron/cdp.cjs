// Canale di controllo con Edge (Chrome DevTools Protocol su pipe privata, come fa Playwright):
// Edge parte con --remote-debugging-pipe e Salotto gli parla sui descrittori 3 (scrittura) e 4 (lettura).
// Niente porta di rete: solo Salotto, che ha lanciato Edge, può usarlo.
// Serve a mandare i tasti direttamente alla pagina, anche quando la finestra di Edge non è "attiva" per Windows.
'use strict';
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
// Navigazione con le frecce "da TV" (caroselli compresi), inserita in ogni pagina.
const NAVIGAZIONE = fs.readFileSync(path.join(__dirname, 'navigazione-tv.js'), 'utf8');

// Tasti di Salotto → evento tastiera per la pagina.
const TASTI = {
  up: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  down: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  ok: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  invio: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  esc: { key: 'Escape', code: 'Escape', vk: 27 },
  cancella: { key: 'Backspace', code: 'Backspace', vk: 8 },
  tab: { key: 'Tab', code: 'Tab', vk: 9 },
  spazio: { key: ' ', code: 'Space', vk: 32, text: ' ' },
};

// Stile aggiunto alle pagine: l'elemento selezionato con le frecce ha un bordo bianco spesso.
const STILE_FUOCO = `(() => {
  const metti = () => {
    if (document.getElementById('salotto-fuoco')) return;
    const st = document.createElement('style');
    st.id = 'salotto-fuoco';
    st.textContent = ':focus-visible, a:focus, button:focus, [tabindex]:focus { outline: 4px solid #fff !important; outline-offset: 3px !important; box-shadow: 0 0 0 8px rgba(0,0,0,.55) !important; }';
    (document.head || document.documentElement).appendChild(st);
  };
  if (document.documentElement) metti(); else document.addEventListener('DOMContentLoaded', metti);
})();`;

class CanaleEdge extends EventEmitter {
  // scrivi = stream verso Edge (stdio[3]), leggi = stream da Edge (stdio[4])
  // sito = indirizzo dell'app: tra le pagine di Edge si sceglie quella dello stesso sito.
  constructor(scrivi, leggi, log = () => {}, sito = '') {
    super();
    try { this.host = new URL(sito).hostname.replace(/^www\./, ''); } catch { this.host = ''; }
    this.out = scrivi;
    this.log = log;
    this.id = 0;
    this.attese = new Map();
    this.sessione = null; // sessione della pagina principale
    this.chiuso = false;
    let resto = Buffer.alloc(0);
    leggi.on('data', (d) => {
      resto = Buffer.concat([resto, d]);
      let i;
      while ((i = resto.indexOf(0)) >= 0) { // ogni messaggio finisce con un byte zero
        const testo = resto.subarray(0, i).toString('utf8');
        resto = resto.subarray(i + 1);
        try { this.ricevi(JSON.parse(testo)); } catch { /* messaggio non valido */ }
      }
    });
    leggi.on('close', () => this.fine());
    leggi.on('error', () => this.fine());
    scrivi.on('error', () => this.fine());
  }
  fine() {
    if (this.chiuso) return;
    this.chiuso = true;
    for (const [, a] of this.attese) a.ko(new Error('canale chiuso'));
    this.attese.clear();
    this.emit('chiuso');
  }
  ricevi(m) {
    if (m.id && this.attese.has(m.id)) {
      const a = this.attese.get(m.id); this.attese.delete(m.id);
      if (m.error) a.ko(new Error(m.error.message)); else a.ok(m.result || {});
      return;
    }
    if (m.method === 'Target.targetCreated' || m.method === 'Target.targetInfoChanged') {
      if (!this.sessione && this.paginaVera(m.params.targetInfo)) this.aggancia(m.params.targetInfo);
    } else if (m.method === 'Target.detachedFromTarget' && m.params.sessionId === this.sessione) {
      this.sessione = null;
      this.cercaPagina();
    }
  }
  invia(method, params = {}, sessionId) {
    if (this.chiuso) return Promise.reject(new Error('canale chiuso'));
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((ok, ko) => {
      this.attese.set(id, { ok, ko });
      try { this.out.write(JSON.stringify(msg) + '\0'); } catch (e) { this.attese.delete(id); ko(e); }
      setTimeout(() => { if (this.attese.has(id)) { this.attese.delete(id); ko(new Error('nessuna risposta a ' + method)); } }, 8000);
    });
  }
  async avvia() {
    await this.invia('Target.setDiscoverTargets', { discover: true });
    await this.cercaPagina();
  }
  // Solo pagine web vere: Edge ha anche pagine sue interne (estensioni, edge://) che non vanno toccate.
  paginaVera(t) { return t && t.type === 'page' && /^https?:/i.test(t.url || ''); }
  async cercaPagina() {
    try {
      const { targetInfos } = await this.invia('Target.getTargets');
      const vere = (targetInfos || []).filter((t) => this.paginaVera(t));
      const stessoSito = vere.find((t) => this.host && (t.url || '').includes(this.host));
      const p = stessoSito || vere[0];
      if (p) await this.aggancia(p);
      else if (!this.chiuso && (this.tentativi = (this.tentativi || 0) + 1) < 40) setTimeout(() => !this.sessione && this.cercaPagina(), 500);
    } catch (e) { this.log('canale Edge: ' + e.message); }
  }
  async aggancia(info) {
    if (this.sessione || this.agganciando) return;
    this.agganciando = true;
    try {
      const { sessionId } = await this.invia('Target.attachToTarget', { targetId: info.targetId, flatten: true });
      this.sessione = sessionId;
      // La pagina si comporta come se avesse il fuoco (dentro Salotto la finestra di Edge non è mai attiva).
      await this.invia('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId).catch(() => {});
      // Riquadro di selezione ben visibile da lontano (come sulle TV), anche nelle pagine aperte dopo.
      await this.invia('Page.enable', {}, sessionId).catch(() => {});
      await this.invia('Page.addScriptToEvaluateOnNewDocument', { source: STILE_FUOCO }, sessionId).catch(() => {});
      await this.invia('Runtime.evaluate', { expression: STILE_FUOCO }, sessionId).catch(() => {});
      await this.invia('Page.addScriptToEvaluateOnNewDocument', { source: NAVIGAZIONE }, sessionId).catch(() => {});
      await this.invia('Runtime.evaluate', { expression: NAVIGAZIONE }, sessionId).catch(() => {});
      this.log('canale Edge: collegato alla pagina ' + String(info.url || '').slice(0, 120));
      this.emit('pronto');
    } catch (e) { this.log('canale Edge: ' + e.message); } finally { this.agganciando = false; }
  }
  pronto() { return !this.chiuso && Boolean(this.sessione); }

  // Un tasto di Salotto (up, down, ok, ...). Ritorna false se non è un tasto che il canale conosce.
  tasto(nome) {
    const t = TASTI[nome];
    if (!t || !this.pronto()) return false;
    const base = { key: t.key, code: t.code, windowsVirtualKeyCode: t.vk, nativeVirtualKeyCode: t.vk };
    const giu = t.text ? { type: 'keyDown', text: t.text, unmodifiedText: t.text, ...base } : { type: 'rawKeyDown', ...base };
    this.invia('Input.dispatchKeyEvent', giu, this.sessione).catch(() => {});
    this.invia('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, this.sessione).catch(() => {});
    return true;
  }
  // Tasto fisico della tastiera del PC (da before-input-event di Electron).
  tastoFisico(input) {
    if (!this.pronto()) return false;
    const mod = (input.alt ? 1 : 0) | (input.control ? 2 : 0) | (input.meta ? 4 : 0) | (input.shift ? 8 : 0);
    const testo = input.key && input.key.length === 1 && !input.control && !input.alt && !input.meta ? input.key : (input.key === 'Enter' ? '\r' : '');
    const base = { key: input.key, code: input.code, modifiers: mod };
    const vk = Object.values(TASTI).find((t) => t.key === input.key);
    if (vk) { base.windowsVirtualKeyCode = vk.vk; base.nativeVirtualKeyCode = vk.vk; }
    if (input.type === 'keyDown') {
      const ev = testo ? { type: 'keyDown', text: testo, unmodifiedText: testo, ...base } : { type: 'rawKeyDown', ...base };
      this.invia('Input.dispatchKeyEvent', ev, this.sessione).catch(() => {});
    } else if (input.type === 'keyUp') {
      this.invia('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, this.sessione).catch(() => {});
    }
    return true;
  }
  testo(s) {
    if (!this.pronto()) return false;
    this.invia('Input.insertText', { text: String(s) }, this.sessione).catch(() => {});
    return true;
  }
  indietro() {
    if (!this.pronto()) return false;
    this.invia('Runtime.evaluate', { expression: 'history.back()' }, this.sessione).catch(() => {});
    return true;
  }
  valuta(espressione) {
    return this.invia('Runtime.evaluate', { expression: espressione, returnByValue: true, awaitPromise: true }, this.sessione).then((r) => r.result && r.result.value);
  }
  chiudi() {
    try { this.out.end(); } catch { /* già chiuso */ }
    this.fine();
  }
}

module.exports = { CanaleEdge, TASTI, STILE_FUOCO, NAVIGAZIONE };
