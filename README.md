# Salotto

App per Windows che trasforma il PC in una TV: home a riquadri a schermo intero, si usa con le frecce, con un telecomando USB o con il **telefono come telecomando** (pagina web con PIN, touchpad e tastiera).

- **App:** Netflix, Prime Video, Disney+, RaiPlay e altre si aprono in Microsoft Edge **dentro** la finestra di Salotto (video protetti); YouTube nella versione per TV. Le frecce funzionano anche sui siti, caroselli compresi.
- **Store:** circa 40 servizi da aggiungere alla home con un tasto, più app e programmi a mano.
- **Trasmetti al PC:** ricevitore **DLNA** (app Android come Web Video Caster o BubbleUPnP) e **AirPlay** da iPhone, iPad e Mac tramite [uxplay-windows](https://github.com/leapbtw/uxplay-windows), da installare a parte.
- **Film e Serie TV** in stile Google TV: carosello, file di locandine (di tendenza, per servizio, per genere) e scheda del titolo con "Guarda su …" e trailer. Usano il catalogo di [TMDB](https://www.themoviedb.org): serve una chiave API personale gratuita, da incollare in Impostazioni → Film e Serie TV (resta solo sul PC).
- **Programmi** del PC presi dal menu Start, con le loro icone.
- **Impostazioni** in stile TV, anche **Bluetooth** (accendi/spegni, abbinati, cerca, abbina, dimentica), avvio all'accensione del PC, tasto `Ctrl+Alt+H` per tornare alla home.

> **Stato:** versione 0.1.22, provata su Windows 11. L'installer non è firmato: al primo avvio Windows (SmartScreen) può mostrare un avviso, si va avanti con "Ulteriori informazioni" → "Esegui comunque".

## Installazione

Scarica `Salotto-x.y.z-win-x64.exe` dall'ultima [release](../../releases/latest) e scegli "Solo per me" oppure "Per tutti gli utenti".

## Sviluppo

```bash
npm install
npm start          # a schermo intero (npm run finestra: in una finestra)
npm test
npm run dist:win   # installer Windows in release/
```

Fatta con Electron. Su Mac parte per sviluppare l'interfaccia; le funzioni di Windows (Edge, tasti, AirPlay) non fanno nulla.

## Licenza e marchi

Codice sotto licenza MIT (vedi [LICENSE](LICENSE)). I loghi in `renderer/loghi/` sono dei rispettivi proprietari (presi dai loro siti ufficiali; alcuni disegnati da Simple Icons, CC0) e servono solo a riconoscere i servizi: la licenza MIT non li copre. Salotto non è collegato a Google, Netflix, Rai né agli altri servizi citati. Questo prodotto usa le API di TMDB ma non è approvato né certificato da TMDB.
