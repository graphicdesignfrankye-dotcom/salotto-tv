// Catalogo dello Store di Salotto: servizi pronti da aggiungere alla home con un tasto.
// Gli id delle app già presenti di serie coincidono, così lo Store sa cosa è già installato.
// modo: edge = Microsoft Edge a schermo intero (video protetti), interna = dentro Salotto,
//       link = indirizzo speciale (es. steam://), programma = .exe sul PC.
// sito: da dove prendere il logo quando l'app non è una pagina web.
'use strict';
window.CATEGORIE = [
  ['film', 'Film e serie TV'],
  ['tv', 'TV italiana'],
  ['sport', 'Sport'],
  ['musica', 'Musica e radio'],
  ['video', 'Video gratis'],
  ['bambini', 'Bambini'],
  ['giochi', 'Giochi'],
  ['strumenti', 'Programmi e strumenti'],
];

window.CATALOGO = [
  // Film e serie TV
  { id: 'netflix', nome: 'Netflix', cat: 'film', url: 'https://www.netflix.com/browse', modo: 'edge', colore: '#b1060f', descr: 'Serie, film e documentari' },
  { id: 'prime', nome: 'Prime Video', cat: 'film', url: 'https://www.primevideo.com', modo: 'edge', colore: '#1a98ff', descr: 'Incluso in Amazon Prime' },
  { id: 'disney', nome: 'Disney+', cat: 'film', url: 'https://www.disneyplus.com', modo: 'edge', colore: '#113ccf', descr: 'Disney, Pixar, Marvel, Star Wars' },
  { id: 'now', nome: 'NOW', cat: 'film', url: 'https://www.nowtv.it', modo: 'edge', colore: '#1c1c1c', descr: 'Cinema, serie e sport di Sky' },
  { id: 'appletv', nome: 'Apple TV+', cat: 'film', url: 'https://tv.apple.com', modo: 'edge', colore: '#2b2b2b', descr: 'Serie e film originali Apple' },
  { id: 'paramount', nome: 'Paramount+', cat: 'film', url: 'https://www.paramountplus.com', modo: 'edge', colore: '#0064ff', descr: 'Serie, film e prime visioni' },
  { id: 'timvision', nome: 'TIMVISION', cat: 'film', url: 'https://www.timvision.it', modo: 'edge', colore: '#004691', descr: 'Film, serie e canali' },
  { id: 'crunchyroll', nome: 'Crunchyroll', cat: 'film', url: 'https://www.crunchyroll.com', modo: 'edge', colore: '#f47521', descr: 'Anime in streaming' },
  { id: 'mubi', nome: 'MUBI', cat: 'film', url: 'https://mubi.com', modo: 'edge', colore: '#001489', descr: 'Cinema d\'autore' },
  { id: 'rakuten', nome: 'Rakuten TV', cat: 'film', url: 'https://www.rakuten.tv/it', modo: 'edge', colore: '#bf0000', descr: 'Noleggio film e canali gratis' },
  { id: 'chili', nome: 'CHILI', cat: 'film', url: 'https://it.chili.com', modo: 'edge', colore: '#e2001a', descr: 'Noleggio e acquisto film' },

  // TV italiana
  { id: 'raiplay', nome: 'RaiPlay', cat: 'tv', url: 'https://www.raiplay.it', modo: 'edge', colore: '#0a4ea2', descr: 'Dirette e programmi Rai, gratis' },
  { id: 'mediaset', nome: 'Mediaset Infinity', cat: 'tv', url: 'https://mediasetinfinity.mediaset.it', modo: 'edge', colore: '#1c1c3c', descr: 'Dirette e programmi Mediaset' },
  { id: 'la7', nome: 'La7', cat: 'tv', url: 'https://www.la7.it', modo: 'edge', colore: '#00315f', descr: 'Diretta e programmi La7' },
  { id: 'skygo', nome: 'Sky Go', cat: 'tv', url: 'https://skygo.sky.it', modo: 'edge', colore: '#0a3d91', descr: 'Per gli abbonati Sky' },
  { id: 'plutotv', nome: 'Pluto TV', cat: 'tv', url: 'https://pluto.tv/it', modo: 'edge', colore: '#2c2c54', descr: 'Canali gratis 24 ore su 24' },

  // Sport
  { id: 'dazn', nome: 'DAZN', cat: 'sport', url: 'https://www.dazn.com', modo: 'edge', colore: '#1a1a1a', descr: 'Calcio e sport in diretta' },
  { id: 'nowsport', nome: 'NOW Sport', cat: 'sport', url: 'https://www.nowtv.it/sport', modo: 'edge', colore: '#008a5e', descr: 'Lo sport di Sky' },
  { id: 'raisport', nome: 'Rai Sport', cat: 'sport', url: 'https://www.raiplay.it/dirette/raisport', modo: 'edge', colore: '#0a7f4f', descr: 'Diretta di Rai Sport, gratis' },

  // Musica e radio
  { id: 'spotify', nome: 'Spotify', cat: 'musica', url: 'https://open.spotify.com', modo: 'edge', colore: '#1db954', descr: 'Musica e podcast' },
  { id: 'ytmusic', nome: 'YouTube Music', cat: 'musica', url: 'https://music.youtube.com', modo: 'edge', colore: '#c4302b', descr: 'Musica da YouTube' },
  { id: 'applemusic', nome: 'Apple Music', cat: 'musica', url: 'https://music.apple.com', modo: 'edge', colore: '#fa2d48', descr: 'Musica di Apple' },
  { id: 'amazonmusic', nome: 'Amazon Music', cat: 'musica', url: 'https://music.amazon.it', modo: 'edge', colore: '#00a8e1', descr: 'Incluso in Amazon Prime' },
  { id: 'deezer', nome: 'Deezer', cat: 'musica', url: 'https://www.deezer.com', modo: 'edge', colore: '#a238ff', descr: 'Musica in streaming' },
  { id: 'tidal', nome: 'TIDAL', cat: 'musica', url: 'https://listen.tidal.com', modo: 'edge', colore: '#111111', descr: 'Musica in alta qualità' },
  { id: 'raisound', nome: 'RaiPlay Sound', cat: 'musica', url: 'https://www.raiplaysound.it', modo: 'edge', colore: '#0a4ea2', descr: 'Radio Rai e podcast' },

  // Video gratis
  { id: 'youtube', nome: 'YouTube', cat: 'video', url: 'https://www.youtube.com/tv', modo: 'interna', agente: 'tv', colore: '#e5322d', descr: 'Versione per TV, si usa col telecomando' },
  { id: 'twitch', nome: 'Twitch', cat: 'video', url: 'https://www.twitch.tv', modo: 'edge', colore: '#9146ff', descr: 'Dirette di giochi e non solo' },
  { id: 'vimeo', nome: 'Vimeo', cat: 'video', url: 'https://vimeo.com', modo: 'edge', colore: '#1ab7ea', descr: 'Video e cortometraggi' },
  { id: 'ted', nome: 'TED', cat: 'video', url: 'https://www.ted.com/talks', modo: 'edge', colore: '#e62b1e', descr: 'Conferenze, anche sottotitolate' },

  // Bambini
  { id: 'ytkids', nome: 'YouTube Kids', cat: 'bambini', url: 'https://www.youtubekids.com', modo: 'edge', colore: '#ff4e45', descr: 'Video adatti ai più piccoli' },
  { id: 'raiyoyo', nome: 'Rai Yoyo', cat: 'bambini', url: 'https://www.raiplay.it/dirette/raiyoyo', modo: 'edge', colore: '#ff9d00', descr: 'Diretta di Rai Yoyo, gratis' },

  // Giochi
  { id: 'xboxcloud', nome: 'Xbox Cloud Gaming', cat: 'giochi', url: 'https://www.xbox.com/play', modo: 'edge', colore: '#107c10', descr: 'Giochi in streaming (Game Pass), col controller' },
  { id: 'geforcenow', nome: 'GeForce NOW', cat: 'giochi', url: 'https://play.geforcenow.com', modo: 'edge', colore: '#76b900', descr: 'I tuoi giochi PC in streaming' },
  { id: 'luna', nome: 'Amazon Luna', cat: 'giochi', url: 'https://luna.amazon.it', modo: 'edge', colore: '#5a2fc2', descr: 'Giochi in streaming, alcuni inclusi in Prime' },
  { id: 'steambp', nome: 'Steam Big Picture', cat: 'giochi', url: 'steam://open/bigpicture', modo: 'link', sito: 'https://store.steampowered.com', colore: '#1b2838', descr: 'Steam in modalità TV (serve Steam)' },

  // Programmi e strumenti
  { id: 'kodi', nome: 'Kodi', cat: 'strumenti', modo: 'programma', percorso: 'C:\\Program Files\\Kodi\\kodi.exe', sito: 'https://kodi.tv', colore: '#17b2e7', descr: 'Film e musica del PC o del NAS', scarica: 'kodi.tv' },
  { id: 'vlc', nome: 'VLC', cat: 'strumenti', modo: 'programma', percorso: 'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe', argomenti: '--fullscreen', sito: 'https://www.videolan.org', colore: '#ff8800', descr: 'Riproduce qualsiasi file video', scarica: 'videolan.org' },
  { id: 'googlefoto', nome: 'Google Foto', cat: 'strumenti', url: 'https://photos.google.com', modo: 'edge', colore: '#4285f4', descr: 'Le tue foto sul televisore' },
  { id: 'meteo', nome: 'Meteo', cat: 'strumenti', url: 'https://www.ilmeteo.it', modo: 'edge', colore: '#2f80ed', descr: 'Previsioni del tempo' },
];
