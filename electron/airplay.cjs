// AirPlay (iPhone, iPad, Mac → PC) tramite uxplay-windows, programma gratuito e open source
// (github.com/leapbtw/uxplay-windows, basato su UxPlay) che va installato a parte.
// Salotto gli dà il nome del ricevitore e lo accende se è spento; non lo spegne mai.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const WINDOWS = process.platform === 'win32';
const ESEGUIBILE = 'uxplay-windows.exe';
const PREDEFINITO = '-n uxplay-windows -nh';

const esegui = (cmd, arg) => new Promise((ok) => execFile(cmd, arg, { windowsHide: true, timeout: 10000 }, (e, out) => ok(e ? '' : String(out))));

class AirPlay {
  constructor(cartellaDati, log = () => {}) {
    this.log = log;
    this.memoria = path.join(cartellaDati, 'airplay-argomenti.txt'); // ultimo arguments.txt scritto da Salotto
    // Percorso di uxplay-windows.exe trovato l'ultima volta, ricordato anche dopo la chiusura di Salotto
    // (la versione portatile, es. nei Download, non lascia tracce nel registro: si trova solo quando è accesa).
    this.filePercorso = path.join(cartellaDati, 'airplay-percorso.txt');
    this.trovato = null;
    try { const p = fs.readFileSync(this.filePercorso, 'utf8').trim(); if (p && fs.existsSync(p)) this.trovato = p; } catch { /* mai trovato */ }
  }
  percorso() {
    if (!WINDOWS) return null;
    const e = process.env;
    return [
      path.join(e.ProgramFiles || 'C:\\Program Files', 'uxplay-windows', ESEGUIBILE),
      path.join(e['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'uxplay-windows', ESEGUIBILE),
      path.join(e.LOCALAPPDATA || '', 'Programs', 'uxplay-windows', ESEGUIBILE),
    ].find((p) => fs.existsSync(p)) || null;
  }
  installato() { return Boolean(this.percorso() || (this.trovato && fs.existsSync(this.trovato))); }
  // Cerca uxplay-windows.exe anche fuori dalle cartelle solite: dal programma acceso, dal registro
  // (voci di disinstallazione) e dai collegamenti nel menu Start e sul desktop.
  async trova() {
    const fisso = this.percorso();
    if (fisso) return (this.trovato = fisso);
    if (this.trovato && fs.existsSync(this.trovato)) return this.trovato;
    if (!WINDOWS) return null;
    const script = String.raw`
$c = @()
$c += Get-Process -Name 'uxplay-windows' -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }
$k = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
Get-ItemProperty $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*uxplay*' } | ForEach-Object {
  if ($_.InstallLocation) { $c += Join-Path $_.InstallLocation 'uxplay-windows.exe' }
  if ($_.DisplayIcon) { $c += ($_.DisplayIcon -split ',')[0].Trim([char]34) }
}
$sh = New-Object -ComObject WScript.Shell
$cartelle = "$env:APPDATA\Microsoft\Windows\Start Menu", "$env:ProgramData\Microsoft\Windows\Start Menu", [Environment]::GetFolderPath('Desktop'), "$env:PUBLIC\Desktop"
Get-ChildItem $cartelle -Recurse -Filter '*uxplay*.lnk' -ErrorAction SilentlyContinue | ForEach-Object { $c += $sh.CreateShortcut($_.FullName).TargetPath }
$c | Where-Object { $_ -and $_ -like '*uxplay-windows.exe' -and (Test-Path $_) } | Select-Object -First 1
`;
    const out = (await esegui('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')])).trim();
    if (out && fs.existsSync(out)) {
      this.trovato = out;
      try { fs.writeFileSync(this.filePercorso, out); } catch { /* pazienza */ }
      this.log('AirPlay: uxplay-windows trovato in ' + out);
    }
    return this.trovato;
  }
  fileArgomenti() { return path.join(process.env.APPDATA || '', 'leapbtw', 'uxplay-windows', 'arguments.txt'); }
  fileArgomentiPC() { return path.join(process.env.ProgramData || 'C:\\ProgramData', 'uxplay-windows', 'arguments.txt'); }

  // Scrive il nome del ricevitore in arguments.txt, ma solo se il file è quello di serie o l'ha scritto Salotto:
  // se l'utente l'ha personalizzato a mano non lo tocchiamo. Ritorna true se il contenuto è cambiato.
  scriviArgomenti(nome) {
    if (fs.existsSync(this.fileArgomentiPC())) { this.log('AirPlay: c\'è un arguments.txt per tutto il PC, il nome non lo cambio'); return false; }
    // uxplay-windows divide gli argomenti sugli spazi e NON capisce le virgolette (provato su Windows il 2026-11-25:
    // "Salotto (PC)" diventava due argomenti e UxPlay si fermava). Il nome quindi non ha spazi né simboli strani.
    const pulito = String(nome || 'Salotto').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'Salotto';
    const nuovo = `-n ${pulito} -nh`;
    const file = this.fileArgomenti();
    let attuale = null, nostro = null;
    try { attuale = fs.readFileSync(file, 'utf8').trim(); } catch { /* non c'è ancora */ }
    try { nostro = fs.readFileSync(this.memoria, 'utf8').trim(); } catch { /* mai scritto */ }
    if (attuale === nuovo) return false;
    if (attuale !== null && attuale !== PREDEFINITO && attuale !== nostro) { this.log('AirPlay: arguments.txt personalizzato, lo lascio com\'è'); return false; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, nuovo);
    fs.writeFileSync(this.memoria, nuovo);
    this.log(`AirPlay: nome del ricevitore "${pulito}"`);
    return true;
  }
  async acceso() {
    if (!WINDOWS) return false;
    const out = await esegui('tasklist.exe', ['/FI', `IMAGENAME eq ${ESEGUIBILE}`, '/NH']);
    return out.toLowerCase().includes(ESEGUIBILE);
  }
  // Avvia uxplay-windows se è spento. Non lo spegne MAI: chiuderlo a forza lascia acceso il suo
  // mDNSResponder.exe e l'iPhone non vede più il PC (provato su Windows il 2026-11-25).
  async avvia(nome) {
    const exe = await this.trova();
    if (!exe) return { ok: false, motivo: 'manca' };
    const cambiato = this.scriviArgomenti(nome);
    if (await this.acceso()) {
      if (cambiato) this.log('AirPlay: uxplay-windows è già acceso, il nome nuovo vale dal suo prossimo avvio');
      return { ok: true };
    }
    // Un mDNSResponder rimasto da un uxplay-windows chiuso male impedisce al nuovo di farsi vedere: lo si chiude
    // (solo quello della cartella di uxplay-windows, non il Bonjour di Apple o di altri programmi).
    const cartella = path.dirname(exe);
    const orfani = String.raw`Get-Process mDNSResponder -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith('` + cartella.replace(/'/g, "''") + String.raw`\', [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.Id -Force; 'chiuso ' + $_.Id }`;
    const chiusi = (await esegui('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(orfani, 'utf16le').toString('base64')])).trim();
    if (chiusi) { this.log('AirPlay: mDNSResponder rimasto da prima: ' + chiusi.replace(/\s+/g, ' ')); await new Promise((ok) => setTimeout(ok, 1000)); }
    const p = spawn(exe, [], { detached: true, stdio: 'ignore', cwd: cartella });
    p.on('error', (e) => this.log('AirPlay: non parte: ' + e.message));
    p.unref();
    this.log('AirPlay: avviato ' + exe);
    return { ok: true };
  }
}

// Il titolo della finestra di uxplay-windows dice se sta arrivando un video:
// la finestra di impostazioni si chiama "uxplay-windows", quella del video no.
function eVideo(titolo) {
  const t = String(titolo || '').trim();
  return Boolean(t) && !/^uxplay-windows/i.test(t) && !/\blog\b/i.test(t);
}

module.exports = { AirPlay, eVideo };
