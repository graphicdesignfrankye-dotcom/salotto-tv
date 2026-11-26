const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { RicevitoreDLNA, tempo, secondi, leggiMetadati } = require('../electron/dlna.cjs');

function richiesta(porta, metodo, percorso, corpo = '', intestazioni = {}) {
  return new Promise((ok, ko) => {
    const r = http.request({ host: '127.0.0.1', port: porta, path: percorso, method: metodo, headers: { 'Content-Length': Buffer.byteLength(corpo), ...intestazioni } }, (res) => {
      let d = ''; res.on('data', (c) => d += c); res.on('end', () => ok({ codice: res.statusCode, intestazioni: res.headers, corpo: d }));
    });
    r.on('error', ko); r.end(corpo);
  });
}
const soap = (azione, servizio, args) => `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${azione} xmlns:u="urn:schemas-upnp-org:service:${servizio}:1">${args}</u:${azione}></s:Body></s:Envelope>`;

test('tempi H:MM:SS', () => {
  assert.equal(tempo(3725.9), '1:02:05');
  assert.equal(tempo(NaN), '0:00:00');
  assert.equal(secondi('1:02:05'), 3725);
  assert.equal(secondi('00:00:10.500'), 10.5);
});

test('metadati DIDL', () => {
  const didl = '<DIDL-Lite><item><dc:title>Vacanze &amp; mare</dc:title><upnp:class>object.item.videoItem</upnp:class><res protocolInfo="http-get:*:video/mp4:*">x</res></item></DIDL-Lite>';
  assert.deepEqual(leggiMetadati(didl), { titolo: 'Vacanze & mare', tipo: 'video', mime: 'video/mp4' });
  assert.equal(leggiMetadati('<upnp:class>object.item.imageItem.photo</upnp:class>').tipo, 'immagine');
});

test('descrizione, SCPD, comandi SOAP ed eventi', async () => {
  const r = new RicevitoreDLNA({ uuid: '11111111-2222-3333-4444-555555555555', nome: 'Prova <TV>', porta: 0, ip: '127.0.0.1' });
  const server = http.createServer((req, res) => { if (!r.http(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const porta = server.address().port; r.porta = porta;
  const comandi = [];
  r.on('comando', (t, d) => comandi.push([t, d]));
  try {
    let x = await richiesta(porta, 'GET', '/dlna/descrizione.xml');
    assert.equal(x.codice, 200);
    assert.match(x.corpo, /<friendlyName>Prova &lt;TV&gt;<\/friendlyName>/);
    assert.match(x.corpo, /MediaRenderer:1/);
    for (const s of ['avt', 'rcs', 'cm']) {
      x = await richiesta(porta, 'GET', `/dlna/${s}.xml`);
      assert.equal(x.codice, 200); assert.match(x.corpo, /<scpd/);
    }

    // iscrizione agli eventi con un "telefono" finto che riceve i NOTIFY
    const notifiche = [];
    const tel = http.createServer((req, res) => { let d = ''; req.on('data', (c) => d += c); req.on('end', () => { notifiche.push({ metodo: req.method, sid: req.headers.sid, corpo: d }); res.end(); }); });
    await new Promise((ok) => tel.listen(0, '127.0.0.1', ok));
    x = await richiesta(porta, 'SUBSCRIBE', '/dlna/avt/event', '', { CALLBACK: `<http://127.0.0.1:${tel.address().port}/ev>`, NT: 'upnp:event', TIMEOUT: 'Second-300' });
    assert.equal(x.codice, 200); assert.match(x.intestazioni.sid, /^uuid:/);
    await new Promise((ok) => setTimeout(ok, 400));
    assert.equal(notifiche.length, 1);
    assert.match(notifiche[0].corpo, /TransportState val=&quot;NO_MEDIA_PRESENT&quot;/);

    const meta = '&lt;DIDL-Lite&gt;&lt;item&gt;&lt;dc:title&gt;Film&lt;/dc:title&gt;&lt;upnp:class&gt;object.item.videoItem&lt;/upnp:class&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;';
    x = await richiesta(porta, 'POST', '/dlna/avt/control', soap('SetAVTransportURI', 'AVTransport', `<InstanceID>0</InstanceID><CurrentURI>http://192.168.1.5:8080/film.mp4?a=1&amp;b=2</CurrentURI><CurrentURIMetaData>${meta}</CurrentURIMetaData>`), { SOAPACTION: '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"' });
    assert.equal(x.codice, 200, x.corpo);
    assert.deepEqual(comandi[0], ['carica', { uri: 'http://192.168.1.5:8080/film.mp4?a=1&b=2', titolo: 'Film', tipo: 'video', mime: '' }]);

    x = await richiesta(porta, 'POST', '/dlna/avt/control', soap('Play', 'AVTransport', '<InstanceID>0</InstanceID><Speed>1</Speed>'), { SOAPACTION: '"urn:schemas-upnp-org:service:AVTransport:1#Play"' });
    assert.equal(x.codice, 200); assert.equal(comandi[1][0], 'play');
    r.aggiorna({ trasporto: 'PLAYING', posizione: 65, durata: 600 });
    x = await richiesta(porta, 'POST', '/dlna/avt/control', soap('GetPositionInfo', 'AVTransport', '<InstanceID>0</InstanceID>'), { SOAPACTION: '"urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo"' });
    assert.match(x.corpo, /<RelTime>0:01:05<\/RelTime>/); assert.match(x.corpo, /<TrackDuration>0:10:00<\/TrackDuration>/);
    x = await richiesta(porta, 'POST', '/dlna/avt/control', soap('GetTransportInfo', 'AVTransport', '<InstanceID>0</InstanceID>'), { SOAPACTION: '"urn:schemas-upnp-org:service:AVTransport:1#GetTransportInfo"' });
    assert.match(x.corpo, /<CurrentTransportState>PLAYING<\/CurrentTransportState>/);
    x = await richiesta(porta, 'POST', '/dlna/avt/control', soap('Seek', 'AVTransport', '<InstanceID>0</InstanceID><Unit>REL_TIME</Unit><Target>0:02:00</Target>'), { SOAPACTION: '"urn:schemas-upnp-org:service:AVTransport:1#Seek"' });
    assert.deepEqual(comandi[2], ['vai', { secondi: 120 }]);
    x = await richiesta(porta, 'POST', '/dlna/rcs/control', soap('SetVolume', 'RenderingControl', '<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>35</DesiredVolume>'), { SOAPACTION: '"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume"' });
    assert.deepEqual(comandi[3], ['volume', { volume: 35 }]);
    x = await richiesta(porta, 'POST', '/dlna/cm/control', soap('GetProtocolInfo', 'ConnectionManager', ''), { SOAPACTION: '"urn:schemas-upnp-org:service:ConnectionManager:1#GetProtocolInfo"' });
    assert.match(x.corpo, /http-get:\*:video\/mp4:\*/);
    x = await richiesta(porta, 'POST', '/dlna/avt/control', soap('Inventata', 'AVTransport', ''), { SOAPACTION: '"urn:schemas-upnp-org:service:AVTransport:1#Inventata"' });
    assert.equal(x.codice, 500); assert.match(x.corpo, /<errorCode>401<\/errorCode>/);
    x = await richiesta(porta, 'POST', '/dlna/avt/control', soap('SetAVTransportURI', 'AVTransport', '<InstanceID>0</InstanceID><CurrentURI>file:///C:/Windows/win.ini</CurrentURI><CurrentURIMetaData></CurrentURIMetaData>'), { SOAPACTION: '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"' });
    assert.equal(x.codice, 500, 'i file locali non si accettano');

    await new Promise((ok) => setTimeout(ok, 300));
    assert.ok(notifiche.some((n) => /PLAYING/.test(n.corpo)), 'evento PLAYING inviato');
    tel.closeAllConnections(); tel.close();
  } finally { server.closeAllConnections(); server.close(); }
});
