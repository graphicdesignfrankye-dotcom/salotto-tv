// Ricevitore DLNA / UPnP MediaRenderer: le app del telefono (BubbleUPnP, Web Video Caster, VLC, Gestione file
// di molti Android, foto e video della galleria...) vedono "Salotto (PC)" tra i dispositivi e ci mandano video,
// musica e foto. Il protocollo Chromecast di Google è chiuso: questo è lo standard aperto più diffuso.
const dgram = require('dgram');
const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const SSDP_IP = '239.255.255.250';
const SSDP_PORTA = 1900;
const DURATA = 1800;

const TIPI = {
  dispositivo: 'urn:schemas-upnp-org:device:MediaRenderer:1',
  avt: 'urn:schemas-upnp-org:service:AVTransport:1',
  rcs: 'urn:schemas-upnp-org:service:RenderingControl:1',
  cm: 'urn:schemas-upnp-org:service:ConnectionManager:1',
};

const FORMATI = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/mpeg',
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-flac', 'audio/wav', 'audio/x-wav',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/vnd.apple.mpegurl', 'application/x-mpegURL',
].map((t) => `http-get:*:${t}:*`).join(',');

// ---------- utilità XML ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const unesc = (s) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');

function argomento(corpo, nome) {
  const m = corpo.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`));
  return m ? unesc(m[1]) : '';
}

function tempo(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function secondi(t) {
  const p = String(t || '').trim().split(':').map(Number);
  if (p.some((x) => !Number.isFinite(x))) return NaN;
  return p.reduce((acc, x) => acc * 60 + x, 0);
}

// Titolo e tipo (video/audio/immagine) dai metadati DIDL-Lite mandati dal telefono.
function leggiMetadati(didl) {
  const titolo = argomento(didl || '', 'title');
  const classe = argomento(didl || '', 'class');
  const proto = ((didl || '').match(/protocolInfo="([^"]*)"/) || [])[1] || '';
  const mime = unesc(proto).split(':')[2] || '';
  let tipo = 'video';
  if (/imageItem/i.test(classe) || mime.startsWith('image/')) tipo = 'immagine';
  else if (/audioItem/i.test(classe) || mime.startsWith('audio/')) tipo = 'audio';
  return { titolo, tipo, mime };
}

// ---------- descrizioni dei servizi (SCPD) ----------
const IN = 'in', OUT = 'out';
const SERVIZI = {
  avt: {
    azioni: {
      SetAVTransportURI: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['CurrentURI', IN, 'AVTransportURI'], ['CurrentURIMetaData', IN, 'AVTransportURIMetaData']],
      SetNextAVTransportURI: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['NextURI', IN, 'NextAVTransportURI'], ['NextURIMetaData', IN, 'NextAVTransportURIMetaData']],
      GetMediaInfo: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['NrTracks', OUT, 'NumberOfTracks'], ['MediaDuration', OUT, 'CurrentMediaDuration'], ['CurrentURI', OUT, 'AVTransportURI'], ['CurrentURIMetaData', OUT, 'AVTransportURIMetaData'], ['NextURI', OUT, 'NextAVTransportURI'], ['NextURIMetaData', OUT, 'NextAVTransportURIMetaData'], ['PlayMedium', OUT, 'PlaybackStorageMedium'], ['RecordMedium', OUT, 'RecordStorageMedium'], ['WriteStatus', OUT, 'RecordMediumWriteStatus']],
      GetTransportInfo: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['CurrentTransportState', OUT, 'TransportState'], ['CurrentTransportStatus', OUT, 'TransportStatus'], ['CurrentSpeed', OUT, 'TransportPlaySpeed']],
      GetPositionInfo: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['Track', OUT, 'CurrentTrack'], ['TrackDuration', OUT, 'CurrentTrackDuration'], ['TrackMetaData', OUT, 'CurrentTrackMetaData'], ['TrackURI', OUT, 'CurrentTrackURI'], ['RelTime', OUT, 'RelativeTimePosition'], ['AbsTime', OUT, 'AbsoluteTimePosition'], ['RelCount', OUT, 'RelativeCounterPosition'], ['AbsCount', OUT, 'AbsoluteCounterPosition']],
      GetDeviceCapabilities: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['PlayMedia', OUT, 'PossiblePlaybackStorageMedia'], ['RecMedia', OUT, 'PossibleRecordStorageMedia'], ['RecQualityModes', OUT, 'PossibleRecordQualityModes']],
      GetTransportSettings: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['PlayMode', OUT, 'CurrentPlayMode'], ['RecQualityMode', OUT, 'CurrentRecordQualityMode']],
      GetCurrentTransportActions: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['Actions', OUT, 'CurrentTransportActions']],
      Stop: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID']],
      Play: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['Speed', IN, 'TransportPlaySpeed']],
      Pause: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID']],
      Seek: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['Unit', IN, 'A_ARG_TYPE_SeekMode'], ['Target', IN, 'A_ARG_TYPE_SeekTarget']],
      Next: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID']],
      Previous: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID']],
    },
    variabili: [
      ['TransportState', 'string', false, ['STOPPED', 'PLAYING', 'PAUSED_PLAYBACK', 'TRANSITIONING', 'NO_MEDIA_PRESENT']],
      ['TransportStatus', 'string', false, ['OK', 'ERROR_OCCURRED']],
      ['PlaybackStorageMedium', 'string', false, ['NONE', 'NETWORK']],
      ['RecordStorageMedium', 'string', false, ['NOT_IMPLEMENTED']],
      ['PossiblePlaybackStorageMedia', 'string'], ['PossibleRecordStorageMedia', 'string'],
      ['CurrentPlayMode', 'string', false, ['NORMAL']],
      ['TransportPlaySpeed', 'string', false, ['1']],
      ['RecordMediumWriteStatus', 'string', false, ['NOT_IMPLEMENTED']],
      ['CurrentRecordQualityMode', 'string', false, ['NOT_IMPLEMENTED']],
      ['PossibleRecordQualityModes', 'string'],
      ['NumberOfTracks', 'ui4'], ['CurrentTrack', 'ui4'],
      ['CurrentTrackDuration', 'string'], ['CurrentMediaDuration', 'string'],
      ['CurrentTrackMetaData', 'string'], ['CurrentTrackURI', 'string'],
      ['AVTransportURI', 'string'], ['AVTransportURIMetaData', 'string'],
      ['NextAVTransportURI', 'string'], ['NextAVTransportURIMetaData', 'string'],
      ['RelativeTimePosition', 'string'], ['AbsoluteTimePosition', 'string'],
      ['RelativeCounterPosition', 'i4'], ['AbsoluteCounterPosition', 'i4'],
      ['CurrentTransportActions', 'string'],
      ['LastChange', 'string', true],
      ['A_ARG_TYPE_SeekMode', 'string', false, ['REL_TIME', 'ABS_TIME', 'TRACK_NR']],
      ['A_ARG_TYPE_SeekTarget', 'string'], ['A_ARG_TYPE_InstanceID', 'ui4'],
    ],
  },
  rcs: {
    azioni: {
      ListPresets: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['CurrentPresetNameList', OUT, 'PresetNameList']],
      SelectPreset: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['PresetName', IN, 'A_ARG_TYPE_PresetName']],
      GetVolume: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['Channel', IN, 'A_ARG_TYPE_Channel'], ['CurrentVolume', OUT, 'Volume']],
      SetVolume: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['Channel', IN, 'A_ARG_TYPE_Channel'], ['DesiredVolume', IN, 'Volume']],
      GetMute: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['Channel', IN, 'A_ARG_TYPE_Channel'], ['CurrentMute', OUT, 'Mute']],
      SetMute: [['InstanceID', IN, 'A_ARG_TYPE_InstanceID'], ['Channel', IN, 'A_ARG_TYPE_Channel'], ['DesiredMute', IN, 'Mute']],
    },
    variabili: [
      ['PresetNameList', 'string'], ['LastChange', 'string', true],
      ['Volume', 'ui2', false, null, [0, 100, 1]], ['Mute', 'boolean'],
      ['A_ARG_TYPE_Channel', 'string', false, ['Master']], ['A_ARG_TYPE_InstanceID', 'ui4'],
      ['A_ARG_TYPE_PresetName', 'string', false, ['FactoryDefaults']],
    ],
  },
  cm: {
    azioni: {
      GetProtocolInfo: [['Source', OUT, 'SourceProtocolInfo'], ['Sink', OUT, 'SinkProtocolInfo']],
      GetCurrentConnectionIDs: [['ConnectionIDs', OUT, 'CurrentConnectionIDs']],
      GetCurrentConnectionInfo: [['ConnectionID', IN, 'A_ARG_TYPE_ConnectionID'], ['RcsID', OUT, 'A_ARG_TYPE_RcsID'], ['AVTransportID', OUT, 'A_ARG_TYPE_AVTransportID'], ['ProtocolInfo', OUT, 'A_ARG_TYPE_ProtocolInfo'], ['PeerConnectionManager', OUT, 'A_ARG_TYPE_ConnectionManager'], ['PeerConnectionID', OUT, 'A_ARG_TYPE_ConnectionID'], ['Direction', OUT, 'A_ARG_TYPE_Direction'], ['Status', OUT, 'A_ARG_TYPE_ConnectionStatus']],
    },
    variabili: [
      ['SourceProtocolInfo', 'string', true], ['SinkProtocolInfo', 'string', true], ['CurrentConnectionIDs', 'string', true],
      ['A_ARG_TYPE_ConnectionStatus', 'string', false, ['OK', 'ContentFormatMismatch', 'InsufficientBandwidth', 'UnreliableChannel', 'Unknown']],
      ['A_ARG_TYPE_ConnectionManager', 'string'], ['A_ARG_TYPE_Direction', 'string', false, ['Input', 'Output']],
      ['A_ARG_TYPE_ProtocolInfo', 'string'], ['A_ARG_TYPE_ConnectionID', 'i4'], ['A_ARG_TYPE_AVTransportID', 'i4'], ['A_ARG_TYPE_RcsID', 'i4'],
    ],
  },
};

function scpd(servizio) {
  const s = SERVIZI[servizio];
  const azioni = Object.entries(s.azioni).map(([nome, args]) => `<action><name>${nome}</name><argumentList>${
    args.map(([n, d, v]) => `<argument><name>${n}</name><direction>${d}</direction><relatedStateVariable>${v}</relatedStateVariable></argument>`).join('')
  }</argumentList></action>`).join('');
  const vars = s.variabili.map(([n, t, ev, valori, range]) => `<stateVariable sendEvents="${ev ? 'yes' : 'no'}"><name>${n}</name><dataType>${t}</dataType>${
    valori ? `<allowedValueList>${valori.map((v) => `<allowedValue>${v}</allowedValue>`).join('')}</allowedValueList>` : ''}${
    range ? `<allowedValueRange><minimum>${range[0]}</minimum><maximum>${range[1]}</maximum><step>${range[2]}</step></allowedValueRange>` : ''}</stateVariable>`).join('');
  return `<?xml version="1.0" encoding="utf-8"?><scpd xmlns="urn:schemas-upnp-org:service-1-0"><specVersion><major>1</major><minor>0</minor></specVersion><actionList>${azioni}</actionList><serviceStateTable>${vars}</serviceStateTable></scpd>`;
}

function soap(tipoServizio, azione, uscite) {
  const corpo = Object.entries(uscite || {}).map(([k, v]) => `<${k}>${esc(v)}</${k}>`).join('');
  return `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${azione}Response xmlns:u="${tipoServizio}">${corpo}</u:${azione}Response></s:Body></s:Envelope>`;
}
function soapErrore(codice, descr) {
  return `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>UPnPError</faultstring><detail><UPnPError xmlns="urn:schemas-upnp-org:control-1-0"><errorCode>${codice}</errorCode><errorDescription>${esc(descr)}</errorDescription></UPnPError></detail></s:Fault></s:Body></s:Envelope>`;
}

class RicevitoreDLNA extends EventEmitter {
  constructor({ uuid, nome, porta, ip, log = () => {} }) {
    super();
    this.uuid = uuid; this.nome = nome; this.porta = porta; this.ip = ip; this.log = log;
    this.sock = null; this.timer = null;
    this.iscritti = new Map(); // sid -> { servizio, callback, seq, scade }
    this.stato = { uri: '', metadati: '', titolo: '', tipo: 'video', trasporto: 'NO_MEDIA_PRESENT', posizione: 0, durata: 0, volume: 100, muto: false };
  }

  get base() { return `http://${this.ip}:${this.porta}`; }
  get posizioneDescrizione() { return `${this.base}/dlna/descrizione.xml`; }

  // ---------- SSDP ----------
  avvia() {
    if (this.sock) return;
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.sock = sock;
    sock.on('error', (e) => this.log('ssdp errore: ' + e.message));
    sock.on('message', (msg, rinfo) => this.messaggioSSDP(msg.toString(), rinfo));
    sock.bind(SSDP_PORTA, () => {
      try { sock.addMembership(SSDP_IP, this.ip !== '127.0.0.1' ? this.ip : undefined); } catch (e) { this.log('multicast: ' + e.message); }
      try { sock.setMulticastTTL(4); if (this.ip !== '127.0.0.1') sock.setMulticastInterface(this.ip); } catch { /* facoltativo */ }
      this.annuncia('ssdp:alive');
      setTimeout(() => this.annuncia('ssdp:alive'), 1500);
      this.timer = setInterval(() => this.annuncia('ssdp:alive'), 60_000);
      this.log(`DLNA attivo come "${this.nome}" su ${this.posizioneDescrizione}`);
    });
  }

  ferma() {
    if (!this.sock) return;
    clearInterval(this.timer);
    try { this.annuncia('ssdp:byebye'); } catch { /* chiusura */ }
    const s = this.sock; this.sock = null;
    setTimeout(() => { try { s.close(); } catch { /* già chiuso */ } }, 200);
  }

  obiettivi() {
    return [
      ['upnp:rootdevice', `uuid:${this.uuid}::upnp:rootdevice`],
      [`uuid:${this.uuid}`, `uuid:${this.uuid}`],
      ...[TIPI.dispositivo, TIPI.avt, TIPI.rcs, TIPI.cm].map((t) => [t, `uuid:${this.uuid}::${t}`]),
    ];
  }

  annuncia(nts) {
    if (!this.sock) return;
    for (const [nt, usn] of this.obiettivi()) {
      const righe = [
        'NOTIFY * HTTP/1.1', `HOST: ${SSDP_IP}:${SSDP_PORTA}`, `NT: ${nt}`, `NTS: ${nts}`, `USN: ${usn}`,
        ...(nts === 'ssdp:alive' ? [`LOCATION: ${this.posizioneDescrizione}`, `CACHE-CONTROL: max-age=${DURATA}`, 'SERVER: Windows/10 UPnP/1.0 Salotto/0.1'] : []),
        '', '',
      ];
      this.sock.send(Buffer.from(righe.join('\r\n')), SSDP_PORTA, SSDP_IP);
    }
  }

  messaggioSSDP(testo, rinfo) {
    if (!testo.startsWith('M-SEARCH')) return;
    const st = (testo.match(/^ST:\s*(.+)$/im) || [])[1]?.trim();
    if (!st) return;
    const mx = Math.min(Number((testo.match(/^MX:\s*(\d+)/im) || [])[1] || 1), 3);
    const risposte = this.obiettivi().filter(([nt]) => st === 'ssdp:all' || st === nt);
    for (const [nt, usn] of risposte) {
      const r = [
        'HTTP/1.1 200 OK', `CACHE-CONTROL: max-age=${DURATA}`, `DATE: ${new Date().toUTCString()}`, 'EXT:',
        `LOCATION: ${this.posizioneDescrizione}`, 'SERVER: Windows/10 UPnP/1.0 Salotto/0.1', `ST: ${nt}`, `USN: ${usn}`, '', '',
      ].join('\r\n');
      setTimeout(() => this.sock && this.sock.send(Buffer.from(r), rinfo.port, rinfo.address), Math.random() * mx * 300);
    }
  }

  // ---------- HTTP ----------
  descrizione() {
    const servizio = (k, id) => `<service><serviceType>${TIPI[k]}</serviceType><serviceId>urn:upnp-org:serviceId:${id}</serviceId><SCPDURL>/dlna/${k}.xml</SCPDURL><controlURL>/dlna/${k}/control</controlURL><eventSubURL>/dlna/${k}/event</eventSubURL></service>`;
    return `<?xml version="1.0" encoding="utf-8"?><root xmlns="urn:schemas-upnp-org:device-1-0" xmlns:dlna="urn:schemas-dlna-org:device-1-0"><specVersion><major>1</major><minor>0</minor></specVersion><device><deviceType>${TIPI.dispositivo}</deviceType><friendlyName>${esc(this.nome)}</friendlyName><manufacturer>Salotto</manufacturer><modelName>Salotto TV</modelName><modelDescription>PC Windows usato come TV</modelDescription><modelNumber>0.1</modelNumber><UDN>uuid:${this.uuid}</UDN><dlna:X_DLNADOC>DMR-1.50</dlna:X_DLNADOC><serviceList>${servizio('avt', 'AVTransport')}${servizio('rcs', 'RenderingControl')}${servizio('cm', 'ConnectionManager')}</serviceList></device></root>`;
  }

  // Ritorna true se ha gestito la richiesta.
  http(req, res) {
    const p = new URL(req.url, 'http://x').pathname;
    if (!p.startsWith('/dlna/')) return false;
    const xml = (codice, corpo) => { res.writeHead(codice, { 'Content-Type': 'text/xml; charset="utf-8"', 'Content-Length': Buffer.byteLength(corpo) }); res.end(corpo); };
    if (req.method === 'GET' && p === '/dlna/descrizione.xml') { xml(200, this.descrizione()); return true; }
    let m = p.match(/^\/dlna\/(avt|rcs|cm)\.xml$/);
    if (req.method === 'GET' && m) { xml(200, scpd(m[1])); return true; }
    m = p.match(/^\/dlna\/(avt|rcs|cm)\/control$/);
    if (req.method === 'POST' && m) {
      let corpo = '';
      req.on('data', (d) => { corpo += d; if (corpo.length > 1e6) req.destroy(); });
      req.on('end', () => {
        const azione = ((req.headers.soapaction || '').replace(/"/g, '').split('#')[1] || '').trim();
        try {
          const uscite = this.azione(m[1], azione, corpo);
          xml(200, soap(TIPI[m[1]], azione, uscite));
        } catch (e) {
          this.log(`DLNA ${azione}: ${e.message}`);
          xml(500, soapErrore(e.codice || 501, e.message));
        }
      });
      return true;
    }
    m = p.match(/^\/dlna\/(avt|rcs|cm)\/event$/);
    if (m) { this.eventi(m[1], req, res); return true; }
    res.writeHead(404); res.end();
    return true;
  }

  azione(servizio, azione, corpo) {
    const s = this.stato;
    const a = (n) => argomento(corpo, n);
    if (servizio === 'avt') {
      switch (azione) {
        case 'SetAVTransportURI': {
          const uri = a('CurrentURI');
          if (!/^https?:\/\//i.test(uri)) throw Object.assign(new Error('Indirizzo non supportato'), { codice: 714 });
          const meta = a('CurrentURIMetaData');
          const info = leggiMetadati(meta);
          Object.assign(s, { uri, metadati: meta, titolo: info.titolo, tipo: info.tipo, posizione: 0, durata: 0, trasporto: 'STOPPED' });
          this.log(`DLNA riceve: ${info.titolo || uri}`);
          this.emit('comando', 'carica', { uri, titolo: info.titolo, tipo: info.tipo, mime: info.mime });
          this.cambiato();
          return {};
        }
        case 'SetNextAVTransportURI': return {};
        case 'GetMediaInfo': return { NrTracks: s.uri ? 1 : 0, MediaDuration: tempo(s.durata), CurrentURI: s.uri, CurrentURIMetaData: s.metadati, NextURI: '', NextURIMetaData: '', PlayMedium: s.uri ? 'NETWORK' : 'NONE', RecordMedium: 'NOT_IMPLEMENTED', WriteStatus: 'NOT_IMPLEMENTED' };
        case 'GetTransportInfo': return { CurrentTransportState: s.trasporto, CurrentTransportStatus: 'OK', CurrentSpeed: '1' };
        case 'GetPositionInfo': return { Track: s.uri ? 1 : 0, TrackDuration: tempo(s.durata), TrackMetaData: s.metadati, TrackURI: s.uri, RelTime: tempo(s.posizione), AbsTime: tempo(s.posizione), RelCount: 2147483647, AbsCount: 2147483647 };
        case 'GetDeviceCapabilities': return { PlayMedia: 'NETWORK', RecMedia: 'NOT_IMPLEMENTED', RecQualityModes: 'NOT_IMPLEMENTED' };
        case 'GetTransportSettings': return { PlayMode: 'NORMAL', RecQualityMode: 'NOT_IMPLEMENTED' };
        case 'GetCurrentTransportActions': return { Actions: this.azioniPossibili() };
        case 'Play':
          if (!s.uri) throw Object.assign(new Error('Nessun contenuto'), { codice: 701 });
          this.emit('comando', 'play'); return {};
        case 'Pause': this.emit('comando', 'pausa'); return {};
        case 'Stop': this.emit('comando', 'stop'); s.trasporto = 'STOPPED'; this.cambiato(); return {};
        case 'Seek': {
          const unita = a('Unit');
          const sec = secondi(a('Target'));
          if (!['REL_TIME', 'ABS_TIME'].includes(unita) || !Number.isFinite(sec)) throw Object.assign(new Error('Seek non supportato'), { codice: 710 });
          this.emit('comando', 'vai', { secondi: sec }); s.posizione = sec; return {};
        }
        case 'Next': case 'Previous': return {};
      }
    } else if (servizio === 'rcs') {
      switch (azione) {
        case 'ListPresets': return { CurrentPresetNameList: 'FactoryDefaults' };
        case 'SelectPreset': return {};
        case 'GetVolume': return { CurrentVolume: s.volume };
        case 'SetVolume': {
          const v = Math.max(0, Math.min(100, Number(a('DesiredVolume'))));
          if (!Number.isFinite(v)) throw Object.assign(new Error('Volume non valido'), { codice: 402 });
          s.volume = v; this.emit('comando', 'volume', { volume: v }); this.cambiato('rcs'); return {};
        }
        case 'GetMute': return { CurrentMute: s.muto ? 1 : 0 };
        case 'SetMute': {
          s.muto = ['1', 'true', 'yes'].includes(a('DesiredMute').toLowerCase());
          this.emit('comando', 'muto', { muto: s.muto }); this.cambiato('rcs'); return {};
        }
      }
    } else if (servizio === 'cm') {
      switch (azione) {
        case 'GetProtocolInfo': return { Source: '', Sink: FORMATI };
        case 'GetCurrentConnectionIDs': return { ConnectionIDs: '0' };
        case 'GetCurrentConnectionInfo': return { RcsID: 0, AVTransportID: 0, ProtocolInfo: '', PeerConnectionManager: '', PeerConnectionID: -1, Direction: 'Input', Status: 'OK' };
      }
    }
    throw Object.assign(new Error(`Azione sconosciuta: ${azione}`), { codice: 401 });
  }

  azioniPossibili() {
    const t = this.stato.trasporto;
    if (t === 'PLAYING') return 'Pause,Stop,Seek';
    if (t === 'PAUSED_PLAYBACK') return 'Play,Stop,Seek';
    if (t === 'STOPPED') return 'Play,Seek';
    return '';
  }

  // Il lettore comunica il suo stato (stato del trasporto, posizione, durata, volume).
  aggiorna(parz) {
    const prima = { trasporto: this.stato.trasporto, durata: Math.round(this.stato.durata), volume: this.stato.volume, muto: this.stato.muto };
    Object.assign(this.stato, parz);
    if (prima.trasporto !== this.stato.trasporto || prima.durata !== Math.round(this.stato.durata)) this.cambiato('avt');
    if (prima.volume !== this.stato.volume || prima.muto !== this.stato.muto) this.cambiato('rcs');
  }

  // ---------- eventi GENA ----------
  eventi(servizio, req, res) {
    if (req.method === 'SUBSCRIBE') {
      const timeout = Math.min(Number(((req.headers.timeout || '').match(/Second-(\d+)/i) || [])[1] || DURATA), DURATA);
      if (req.headers.sid) {
        const i = this.iscritti.get(req.headers.sid);
        if (!i) { res.writeHead(412); res.end(); return; }
        i.scade = Date.now() + timeout * 1000;
        res.writeHead(200, { SID: req.headers.sid, TIMEOUT: `Second-${timeout}`, 'Content-Length': 0 }); res.end();
        return;
      }
      const callback = ((req.headers.callback || '').match(/<([^>]+)>/) || [])[1];
      if (!callback || req.headers.nt !== 'upnp:event') { res.writeHead(412); res.end(); return; }
      const sid = 'uuid:' + crypto.randomUUID();
      this.iscritti.set(sid, { servizio, callback, seq: 0, scade: Date.now() + timeout * 1000 });
      res.writeHead(200, { SID: sid, TIMEOUT: `Second-${timeout}`, SERVER: 'Windows/10 UPnP/1.0 Salotto/0.1', 'Content-Length': 0 }); res.end();
      setTimeout(() => this.notifica(sid), 200);
      return;
    }
    if (req.method === 'UNSUBSCRIBE') {
      this.iscritti.delete(req.headers.sid);
      res.writeHead(200, { 'Content-Length': 0 }); res.end();
      return;
    }
    res.writeHead(405); res.end();
  }

  lastChange(servizio) {
    const s = this.stato;
    if (servizio === 'avt') {
      return `<Event xmlns="urn:schemas-upnp-org:metadata-1-0/AVT/"><InstanceID val="0"><TransportState val="${s.trasporto}"/><TransportStatus val="OK"/><CurrentTransportActions val="${this.azioniPossibili()}"/><AVTransportURI val="${esc(s.uri)}"/><CurrentTrackURI val="${esc(s.uri)}"/><CurrentTrackDuration val="${tempo(s.durata)}"/><CurrentMediaDuration val="${tempo(s.durata)}"/><NumberOfTracks val="${s.uri ? 1 : 0}"/></InstanceID></Event>`;
    }
    if (servizio === 'rcs') {
      return `<Event xmlns="urn:schemas-upnp-org:metadata-1-0/RCS/"><InstanceID val="0"><Volume channel="Master" val="${s.volume}"/><Mute channel="Master" val="${s.muto ? 1 : 0}"/></InstanceID></Event>`;
    }
    return null;
  }

  cambiato(servizio = 'avt') {
    this.emit('stato', { ...this.stato });
    for (const [sid, i] of this.iscritti) if (i.servizio === servizio) this.notifica(sid);
  }

  notifica(sid) {
    const i = this.iscritti.get(sid);
    if (!i) return;
    if (Date.now() > i.scade) { this.iscritti.delete(sid); return; }
    let proprieta;
    if (i.servizio === 'cm') proprieta = `<e:property><SinkProtocolInfo>${esc(FORMATI)}</SinkProtocolInfo></e:property><e:property><SourceProtocolInfo></SourceProtocolInfo></e:property><e:property><CurrentConnectionIDs>0</CurrentConnectionIDs></e:property>`;
    else proprieta = `<e:property><LastChange>${esc(this.lastChange(i.servizio))}</LastChange></e:property>`;
    const corpo = `<?xml version="1.0" encoding="utf-8"?><e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0">${proprieta}</e:propertyset>`;
    let url;
    try { url = new URL(i.callback); } catch { this.iscritti.delete(sid); return; }
    const r = http.request({ hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method: 'NOTIFY', timeout: 3000, headers: {
      'Content-Type': 'text/xml; charset="utf-8"', NT: 'upnp:event', NTS: 'upnp:propchange', SID: sid, SEQ: i.seq++, 'Content-Length': Buffer.byteLength(corpo),
    } });
    r.on('error', () => {});
    r.on('timeout', () => r.destroy());
    r.end(corpo);
  }
}

module.exports = { RicevitoreDLNA, tempo, secondi, leggiMetadati, argomento, scpd };
