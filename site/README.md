# Sito di Salotto

Pagina statica (HTML e CSS, nessuna build). Si pubblica su Vercel con questa cartella come radice del progetto.

- `index.html` — la pagina; `404.html` — pagina non trovata
- `img/` — icona e schermate dell'app con dati di esempio, rifatte con `npx electron scripts/schermate-sito.cjs`
- `vercel.json` — impostazioni di Vercel (nessuna build, intestazioni di sicurezza) e i rinvii dei download
- Download: `/download/windows`, `/download/mac`, `/download/mac-intel` rinviano ai file della release su GitHub. A ogni nuova versione: aggiornare i tre indirizzi in `vercel.json` e numero di versione e pesi in `index.html`.

Anteprima in locale: `python3 -m http.server -d site 8000` poi http://127.0.0.1:8000 (i rinvii dei download funzionano solo su Vercel).
