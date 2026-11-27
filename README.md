# Salotto

App per Windows e Mac che trasforma il computer in una TV: home a riquadri a schermo intero, si usa con le frecce, con un telecomando USB o con il **telefono come telecomando** (pagina web con PIN, touchpad e tastiera).

- **App:** Netflix, Prime Video, Disney+, RaiPlay e altre si aprono **dentro** Salotto con Widevine (video protetti, grazie a [castLabs Electron](https://github.com/castlabs/electron-releases)); YouTube nella versione per TV. Le frecce funzionano anche sui siti, caroselli compresi. Su Netflix la qualità con Widevine arriva di solito a 720p: spegnendo Impostazioni → Sistema → "Netflix & co. dentro Salotto" si usano invece Edge o Chrome.
- **Store:** circa 40 servizi da aggiungere alla home con un tasto, più app e programmi a mano.
- **Trasmetti al PC:** ricevitore **DLNA** (app Android come Web Video Caster o BubbleUPnP) e **AirPlay** da iPhone, iPad e Mac tramite [uxplay-windows](https://github.com/leapbtw/uxplay-windows), da installare a parte.
- **Film e Serie TV** in stile Google TV: carosello, file di locandine (di tendenza, per servizio, per genere) e scheda del titolo con "Guarda su …" e trailer. Usano il catalogo di [TMDB](https://www.themoviedb.org): serve una chiave API personale gratuita, da incollare in Impostazioni → Film e Serie TV (resta solo sul PC).
- **Home "Per te"** come su Google TV: carosello di film e serie di tendenza, le tue app, file di titoli per tendenza e per servizio. Cosa vedere si sceglie in Impostazioni → Home.
- **Programmi** del PC presi dal menu Start, con le loro icone.
- **Impostazioni** in stile TV, anche **Bluetooth** (accendi/spegni, abbinati, cerca, abbina, dimentica), avvio all'accensione del PC, tasto `Ctrl+Alt+H` per tornare alla home.

> **Stato:** versione 0.1.27, provata su Windows 11 e macOS (Apple Silicon). Gli installer non sono firmati: su Windows SmartScreen può mostrare un avviso ("Ulteriori informazioni" → "Esegui comunque"); sul Mac al primo avvio si va in Impostazioni di Sistema → Privacy e sicurezza → "Apri comunque".

### Sul Mac

- Netflix, Prime Video, Disney+, RaiPlay… si aprono dentro Salotto come su Windows (con l'interruttore spento: in Edge, Chrome o Brave a tutto schermo; `Ctrl+Option+H` o `Cmd+Q` tornano alla home).
- AirPlay: si usa il ricevitore già presente in macOS (Impostazioni di Sistema → Generali → AirDrop e Handoff → Ricevitore AirPlay).
- La scheda Programmi mostra le app della cartella Applicazioni.
- Bluetooth: serve [blueutil](https://github.com/toy/blueutil) (`brew install blueutil`); senza, Salotto apre le Impostazioni Bluetooth del Mac.

## Installazione

Dall'ultima [release](../../releases/latest):

- **Windows:** `Salotto-x.y.z-win-x64.exe`, poi "Solo per me" oppure "Per tutti gli utenti".
- **Mac con chip Apple (M1, M2, …):** `Salotto-x.y.z-mac-arm64.dmg`.
- **Mac Intel:** `Salotto-x.y.z-mac-x64.dmg`.

Sul Mac apri il .dmg e trascina Salotto in Applicazioni.

## Sviluppo

```bash
npm install
npm start          # a schermo intero (npm run finestra: in una finestra)
npm test
npm run dist:win   # installer Windows in release/
npm run dist:mac   # .dmg per Mac (Apple Silicon e Intel) in release/
```

Electron è la versione di castLabs con Widevine. Le build vanno firmate per Widevine (VMP) con un account gratuito castLabs EVS: `build/afterPack.cjs` lo fa da solo se esiste il client in `.evs/` (`python3 -m venv .evs && .evs/bin/python -m pip install castlabs-evs`, poi `.evs/bin/python -m castlabs_evs.account signup`). Senza, la build si fa lo stesso ma Netflix & co. non partono.

Fatta con Electron. Le parti che dipendono dal sistema (browser per i video protetti, AirPlay, Programmi, Bluetooth, spegnimento) hanno una versione per Windows e una per Mac.

## Licenza e marchi

Codice sotto licenza MIT (vedi [LICENSE](LICENSE)). I loghi in `renderer/loghi/` sono dei rispettivi proprietari (presi dai loro siti ufficiali; alcuni disegnati da Simple Icons, CC0) e servono solo a riconoscere i servizi: la licenza MIT non li copre. Salotto non è collegato a Google, Netflix, Rai né agli altri servizi citati. Questo prodotto usa le API di TMDB ma non è approvato né certificato da TMDB.
