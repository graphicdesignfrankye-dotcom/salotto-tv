// Programmi del PC per la schermata "Programmi": i collegamenti del menu Start di Windows
// (dell'utente e di tutti gli utenti), con l'icona grande presa dalla shell di Windows.
// Si possono aprire solo i programmi trovati qui (per id), non percorsi qualsiasi.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const WINDOWS = process.platform === 'win32';
// Voci del menu Start che non sono programmi da aprire dal divano.
const ESCLUDI = /disinstall|uninstall|leggimi|readme|guida in linea|\bhelp\b|manuale|manual|documentation|documentazione|sito web|website|licen[sz]|release notes|changelog|novità|^salotto$/i;
const CARTELLE_SALTATE = /^(startup|esecuzione automatica|avvio automatico)$/i;

// Script PowerShell: per ogni riga "id|percorso" salva <id>.png (256 px, con trasparenza) nella cartella data.
const SCRIPT_ICONE = String.raw`
param([string]$Elenco, [string]$Uscita)
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class IconeSalotto {
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx; public int cy; }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
  public static bool Salva(string sorgente, string png, int lato) {
    IShellItemImageFactory f;
    SHCreateItemFromParsingName(sorgente, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out f);
    IntPtr hbm;
    if (f.GetImage(new SIZE { cx = lato, cy = lato }, 0x1 | 0x4, out hbm) != 0) return false; // BIGGERSIZEOK | ICONONLY
    try {
      using (Bitmap b = Image.FromHbitmap(hbm)) {
        Rectangle r = new Rectangle(0, 0, b.Width, b.Height);
        BitmapData d = b.LockBits(r, ImageLockMode.ReadOnly, b.PixelFormat);
        try { using (Bitmap a = new Bitmap(d.Width, d.Height, d.Stride, PixelFormat.Format32bppArgb, d.Scan0)) { a.Save(png, ImageFormat.Png); } }
        finally { b.UnlockBits(d); }
      }
      return true;
    } finally { DeleteObject(hbm); }
  }
}
"@
foreach ($riga in [IO.File]::ReadAllLines($Elenco, [Text.Encoding]::UTF8)) {
  $p = $riga.Split('|', 2)
  if ($p.Count -lt 2) { continue }
  try { [void][IconeSalotto]::Salva($p[1], (Join-Path $Uscita ($p[0] + '.png')), 256) } catch { [Console]::Error.WriteLine($p[1] + ': ' + $_.Exception.Message) }
}
`;

class Programmi {
  constructor(cartellaDati, log = () => {}) {
    this.cartellaDati = cartellaDati;
    this.cartellaIcone = path.join(cartellaDati, 'icone-programmi');
    this.log = log;
    this.mappa = new Map();     // id → percorso del collegamento
    this.provati = new Set();   // icone già tentate in questa sessione (niente tentativi a ripetizione)
    this.inCorso = null;
  }
  cartelle() {
    const e = process.env;
    return [
      path.join(e.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(e.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    ];
  }
  collegamenti(cartella, livello = 0, fuori = []) {
    let voci = [];
    try { voci = fs.readdirSync(cartella, { withFileTypes: true }); } catch { return fuori; }
    for (const v of voci) {
      const p = path.join(cartella, v.name);
      if (v.isDirectory()) { if (livello < 4 && !CARTELLE_SALTATE.test(v.name)) this.collegamenti(p, livello + 1, fuori); }
      else if (/\.lnk$/i.test(v.name)) fuori.push(p);
    }
    return fuori;
  }
  // { lista: [{ id, nome, icona }], mancanti: [{ id, percorso }] }
  elenco() {
    if (!WINDOWS) return { lista: [], mancanti: [] };
    const visti = new Set();
    const lista = [], mancanti = [];
    this.mappa.clear();
    for (const c of this.cartelle()) {
      for (const p of this.collegamenti(c)) {
        const nome = path.basename(p).replace(/\.lnk$/i, '').trim();
        const chiave = nome.toLowerCase();
        if (!nome || ESCLUDI.test(nome) || visti.has(chiave)) continue;
        visti.add(chiave);
        const id = crypto.createHash('sha1').update(p.toLowerCase()).digest('hex').slice(0, 12);
        this.mappa.set(id, p);
        const fileIcona = path.join(this.cartellaIcone, id + '.png');
        let icona = '';
        try { icona = 'data:image/png;base64,' + fs.readFileSync(fileIcona).toString('base64'); } catch { if (!this.provati.has(id)) mancanti.push({ id, percorso: p }); }
        lista.push({ id, nome, icona });
      }
    }
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }));
    return { lista, mancanti };
  }
  // Crea le icone che mancano; ritorna quante ne ha create.
  icone(mancanti) {
    if (!WINDOWS || !mancanti.length) return Promise.resolve(0);
    if (this.inCorso) return this.inCorso;
    mancanti.forEach((m) => this.provati.add(m.id));
    fs.mkdirSync(this.cartellaIcone, { recursive: true });
    const script = path.join(this.cartellaDati, 'icone-programmi.ps1');
    const elenco = path.join(this.cartellaDati, 'icone-programmi.txt');
    fs.writeFileSync(script, '\ufeff' + SCRIPT_ICONE, 'utf8');
    fs.writeFileSync(elenco, mancanti.map((m) => `${m.id}|${m.percorso}`).join('\r\n'), 'utf8');
    const prima = new Set(fs.readdirSync(this.cartellaIcone));
    this.inCorso = new Promise((ok) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Elenco', elenco, '-Uscita', this.cartellaIcone],
        { windowsHide: true, timeout: 120000 }, (e, _out, err) => {
          if (e) this.log('programmi: icone: ' + e.message);
          if (err && err.trim()) this.log('programmi: icone: ' + err.trim().split('\n').slice(0, 3).join(' | '));
          let nuove = 0;
          try { nuove = fs.readdirSync(this.cartellaIcone).filter((f) => !prima.has(f)).length; } catch { /* niente */ }
          this.log(`programmi: ${nuove} icone nuove su ${mancanti.length}`);
          this.inCorso = null;
          ok(nuove);
        });
    });
    return this.inCorso;
  }
  percorso(id) { return this.mappa.get(String(id)) || null; }
}

module.exports = { Programmi, ESCLUDI };
