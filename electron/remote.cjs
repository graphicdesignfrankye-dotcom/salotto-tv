// Telecomando dal telefono: pagina web + WebSocket sulla rete di casa.
// Il primo collegamento chiede il PIN mostrato sulla TV; poi il telefono tiene un token.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const CARTELLA_PAGINA = path.join(__dirname, '..', 'remote');
const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const COMANDI = new Set(['up', 'down', 'left', 'right', 'ok', 'back', 'home', 'playpause', 'volup', 'voldown', 'mute', 'testo', 'cancella', 'invio', 'mouse', 'clic', 'rotella']);

function indirizzoLocale() {
  const tutti = [];
  for (const [nome, lista] of Object.entries(os.networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family === 'IPv4' && !i.internal) tutti.push({ nome, ip: i.address });
    }
  }
  // Prima le reti di casa, evitando le schede virtuali (VirtualBox, Hyper-V, WSL, Docker).
  const virtuale = /virtual|vbox|vmware|hyper-v|vethernet|wsl|docker|loopback/i;
  tutti.sort((a, b) => (virtuale.test(a.nome) - virtuale.test(b.nome)) || (!a.ip.startsWith('192.168.') - !b.ip.startsWith('192.168.')));
  return tutti.length ? tutti[0].ip : '127.0.0.1';
}

class Telecomando {
  // impostazioni: Impostazioni; suComando(cmd, dati): esegue il comando; suStato(n): telefoni collegati
  constructor(impostazioni, suComando, suStato = () => {}) {
    this.imp = impostazioni;
    this.suComando = suComando;
    this.suStato = suStato;
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on('connection', (ws) => this.collegato(ws));
  }

  // Ritorna true se ha gestito la richiesta HTTP.
  http(req, res) {
    const url = new URL(req.url, 'http://x');
    if (req.method !== 'GET') return false;
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!/^\/[a-z0-9_-]+\.(html|js|css|json|png|svg)$/i.test(p)) return false;
    const file = path.join(CARTELLA_PAGINA, p);
    if (!fs.existsSync(file)) return false;
    res.writeHead(200, { 'Content-Type': TIPI[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
    return true;
  }

  upgrade(req, socket, head) {
    if (new URL(req.url, 'http://x').pathname !== '/ws') { socket.destroy(); return; }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit('connection', ws, req));
  }

  collegati() { let n = 0; this.wss.clients.forEach((c) => { if (c.autorizzato) n++; }); return n; }

  collegato(ws) {
    ws.autorizzato = false;
    let tentativi = 0;
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!ws.autorizzato) {
        if (m.token && this.imp.get('tokenTelefoni').includes(m.token)) {
          ws.autorizzato = true;
        } else if (m.pin && String(m.pin) === String(this.imp.get('pin'))) {
          const token = crypto.randomBytes(24).toString('hex');
          this.imp.set('tokenTelefoni', [...this.imp.get('tokenTelefoni'), token].slice(-10));
          ws.autorizzato = true;
          ws.send(JSON.stringify({ tipo: 'token', token }));
        } else {
          tentativi++;
          ws.send(JSON.stringify({ tipo: 'pin', errato: Boolean(m.pin) }));
          if (tentativi >= 5) ws.close();
          return;
        }
        ws.send(JSON.stringify({ tipo: 'ok', nome: this.imp.get('nome') }));
        this.suStato(this.collegati());
        return;
      }
      if (m.cmd && COMANDI.has(m.cmd)) this.suComando(m.cmd, m);
    });
    ws.on('close', () => this.suStato(this.collegati()));
  }

  // Scollega tutti i telefoni (dopo un cambio di PIN).
  dimentica() {
    this.imp.set('tokenTelefoni', []);
    this.wss.clients.forEach((c) => c.close());
  }
}

module.exports = { Telecomando, indirizzoLocale, COMANDI };
