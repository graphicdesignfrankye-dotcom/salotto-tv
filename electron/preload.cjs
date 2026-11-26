// Ponte sicuro tra l'interfaccia e il processo principale.
const { contextBridge, ipcRenderer } = require('electron');

const ascolta = (canale) => (fn) => {
  const h = (_e, ...a) => fn(...a);
  ipcRenderer.on(canale, h);
  return () => ipcRenderer.removeListener(canale, h);
};

contextBridge.exposeInMainWorld('tv', {
  impostazioni: () => ipcRenderer.invoke('impostazioni'),
  salva: (chiave, valore) => ipcRenderer.invoke('salva', chiave, valore),
  apri: (id, extra) => ipcRenderer.invoke('apri', id, extra),
  tmdbSchermata: (tipo) => ipcRenderer.invoke('tmdb-schermata', tipo),
  tmdbDettagli: (tipo, id) => ipcRenderer.invoke('tmdb-dettagli', tipo, id),
  tmdbChiave: (chiave) => ipcRenderer.invoke('tmdb-chiave', chiave),
  esiste: (percorso) => ipcRenderer.invoke('esiste', percorso),
  home: () => ipcRenderer.invoke('home'),
  energia: (azione) => ipcRenderer.invoke('energia', azione),
  infoTelecomando: () => ipcRenderer.invoke('info-telecomando'),
  nuovoPin: () => ipcRenderer.invoke('nuovo-pin'),
  statoLettore: (s) => ipcRenderer.send('player-stato', s),
  suTelecomando: ascolta('telecomando'),
  suHome: ascolta('home'),
  suLettore: ascolta('player'),
  suTelefoni: ascolta('telefoni'),
  suStatoDLNA: ascolta('stato-dlna'),
  statoAirPlay: () => ipcRenderer.invoke('stato-airplay'),
  apriSitoAirPlay: () => ipcRenderer.invoke('apri-sito-airplay'),
  loghi: (ids) => ipcRenderer.invoke('loghi', ids),
  suLoghiNuovi: ascolta('loghi-nuovi'),
  suAvviso: ascolta('avviso'),
  suAppAperta: ascolta('app-aperta'),
  programmi: () => ipcRenderer.invoke('programmi'),
  apriProgramma: (id) => ipcRenderer.invoke('apri-programma', id),
  suProgrammiIcone: ascolta('programmi-icone'),
  bluetooth: (azione, id) => ipcRenderer.invoke('bluetooth', azione, id),
  impostazioniBluetoothWindows: () => ipcRenderer.invoke('impostazioni-bluetooth-windows'),
});
