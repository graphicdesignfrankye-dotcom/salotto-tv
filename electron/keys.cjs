// Invio di tasti, testo e mouse a Windows (per comandare Edge dal telefono).
// Un solo processo PowerShell resta acceso e riceve i comandi riga per riga: SendInput di user32.
// Su Mac/Linux non fa nulla (serve solo a sviluppare).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VK = {
  up: [0x26, true], down: [0x28, true], left: [0x25, true], right: [0x27, true],
  ok: [0x0d, false], esc: [0x1b, false], backspace: [0x08, false], space: [0x20, false], tab: [0x09, false],
  browserBack: [0xa6, true], playpause: [0xb3, true], volup: [0xaf, true], voldown: [0xae, true], mute: [0xad, true],
  f11: [0x7a, false],
};

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class SalottoInput {
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public UNION u; }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  static void Send(INPUT[] a) { SendInput((uint)a.Length, a, Marshal.SizeOf(typeof(INPUT))); }
  static INPUT Kb(ushort vk, ushort scan, uint flags) { var i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; i.u.ki.wScan = scan; i.u.ki.dwFlags = flags; return i; }
  static INPUT Ms(int dx, int dy, uint data, uint flags) { var i = new INPUT(); i.type = 0; i.u.mi.dx = dx; i.u.mi.dy = dy; i.u.mi.mouseData = data; i.u.mi.dwFlags = flags; return i; }
  public static void Key(ushort vk, bool ext, ushort mod) {
    uint e = ext ? 1u : 0u;
    if (mod != 0) Send(new INPUT[] { Kb(mod, 0, 0) });
    Send(new INPUT[] { Kb(vk, 0, e), Kb(vk, 0, e | 2u) });
    if (mod != 0) Send(new INPUT[] { Kb(mod, 0, 2u) });
  }
  public static void Text(string s) {
    foreach (char c in s) Send(new INPUT[] { Kb(0, (ushort)c, 4u), Kb(0, (ushort)c, 4u | 2u) });
  }
  public static void Move(int dx, int dy) { Send(new INPUT[] { Ms(dx, dy, 0, 1u) }); }
  public static void Click() { Send(new INPUT[] { Ms(0, 0, 0, 2u), Ms(0, 0, 0, 4u) }); }
  public static void Wheel(int d) { Send(new INPUT[] { Ms(0, 0, (uint)d, 0x800u) }); }
}
public static class SalottoFinestre {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetParent(IntPtr c, IntPtr p);
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr h);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetLong(IntPtr h, int i);
  [DllImport("user32.dll", EntryPoint="SetWindowLongPtrW")] static extern IntPtr SetLong(IntPtr h, int i, IntPtr v);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int n);
  public static string Titolo(IntPtr h) { var sb = new System.Text.StringBuilder(256); GetWindowTextW(h, sb, 256); return sb.ToString(); }
  // Finestra del video di uxplay-windows: visibile, non quella delle impostazioni/log, abbastanza grande.
  public static IntPtr TrovaVideo() {
    var pids = new System.Collections.Generic.HashSet<uint>();
    foreach (var p in System.Diagnostics.Process.GetProcessesByName("uxplay-windows")) pids.Add((uint)p.Id);
    IntPtr trovata = IntPtr.Zero;
    if (pids.Count == 0) return trovata;
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid) || !IsWindowVisible(h)) return true;
      string t = Titolo(h);
      if (t.StartsWith("uxplay-windows", StringComparison.OrdinalIgnoreCase) || t.IndexOf("log", StringComparison.OrdinalIgnoreCase) >= 0) return true;
      RECT r; GetWindowRect(h, out r);
      if (r.R - r.L < 160 || r.B - r.T < 120) return true;
      trovata = h; return false;
    }, IntPtr.Zero);
    return trovata;
  }
  // Mette il video dentro la finestra di Salotto: senza bordi, figlio di Salotto, grande quanto Salotto.
  // Ritorna "ok" oppure "errore <codice Windows>" (5 = accesso negato: il video ha più permessi di Salotto).
  public static string Incastra(IntPtr v, IntPtr p) {
    long st = GetLong(v, -16).ToInt64();
    st &= ~(0x80000000L | 0x00C00000L | 0x00040000L | 0x00080000L | 0x00020000L | 0x00010000L); // POPUP CAPTION THICKFRAME SYSMENU MIN MAX
    st |= 0x40000000L | 0x10000000L; // CHILD VISIBLE
    SetLong(v, -16, new IntPtr(st));
    long ex = GetLong(v, -20).ToInt64();
    ex &= ~(0x00040000L | 0x00000100L | 0x00000200L | 0x00000001L | 0x00000008L); // APPWINDOW WINDOWEDGE CLIENTEDGE DLGMODALFRAME TOPMOST
    SetLong(v, -20, new IntPtr(ex));
    IntPtr prima = SetParent(v, p);
    int err = Marshal.GetLastWin32Error();
    if (GetParent(v) != p) return "errore " + err;
    Adatta(v, p);
    return "ok";
  }
  public static void Adatta(IntPtr v, IntPtr p) {
    RECT r; GetClientRect(p, out r);
    SetWindowPos(v, IntPtr.Zero, 0, 0, r.R - r.L, r.B - r.T, 0x0020 | 0x0040); // HWND_TOP, FRAMECHANGED SHOWWINDOW: sopra la pagina di Salotto
  }
  public static void Nascondi(IntPtr v) { ShowWindow(v, 0); }
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassNameW(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern IntPtr SetFocus(IntPtr h);
  // Finestra principale di Edge aperto da Salotto (processi col profilo salotto-edge, elenco "1,2,3").
  public static IntPtr TrovaEdge(string elenco) {
    var pids = new System.Collections.Generic.List<uint>();
    foreach (var x in (elenco ?? "").Split(',')) { uint n; if (uint.TryParse(x.Trim(), out n)) pids.Add(n); }
    IntPtr trovata = IntPtr.Zero;
    if (pids.Count == 0) return trovata;
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid) || !IsWindowVisible(h)) return true;
      var sb = new System.Text.StringBuilder(64); GetClassNameW(h, sb, 64);
      if (sb.ToString() != "Chrome_WidgetWin_1") return true;
      RECT r; GetWindowRect(h, out r);
      if (r.R - r.L < 300 || r.B - r.T < 200) return true;
      trovata = h; return false;
    }, IntPtr.Zero);
    return trovata;
  }
  // Controllo periodico: "sparita" se la finestra non c'è più, "rifatto ..." se era uscita da Salotto, sennò "ok".
  public static string Mantieni(IntPtr v, IntPtr p) {
    if (!IsWindow(v)) return "sparita";
    long st = GetLong(v, -16).ToInt64();
    if (GetParent(v) != p || (st & 0x40000000L) == 0) return "rifatto " + Incastra(v, p);
    Adatta(v, p);
    return "ok";
  }
  // Tasti mandati direttamente a una finestra (Edge dentro Salotto): non serve che abbia il fuoco di Windows.
  [DllImport("user32.dll")] static extern bool PostMessageW(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern uint MapVirtualKeyW(uint c, uint t);
  public static void Tasto(IntPtr h, uint vk, bool ext) {
    long lp = 1L | ((long)MapVirtualKeyW(vk, 0) << 16) | (ext ? (1L << 24) : 0L);
    PostMessageW(h, 0x0100, new IntPtr(vk), new IntPtr(lp));                               // WM_KEYDOWN
    if (vk == 0x0D) PostMessageW(h, 0x0102, new IntPtr(13), new IntPtr(lp));                // WM_CHAR invio
    PostMessageW(h, 0x0101, new IntPtr(vk), new IntPtr(lp | 0xC0000000L));                  // WM_KEYUP
  }
  public static void Testo(IntPtr h, string s) { foreach (char c in s) PostMessageW(h, 0x0102, new IntPtr(c), new IntPtr(1)); }
  public static void Indietro(IntPtr h) { PostMessageW(h, 0x0319, h, new IntPtr(1 << 16)); } // WM_APPCOMMAND, BROWSER_BACKWARD
  // Finestre di Edge già aperte prima di lanciare l'app: la finestra nuova è quella che non c'era.
  static System.Collections.Generic.HashSet<long> edgePrima = new System.Collections.Generic.HashSet<long>();
  static System.Collections.Generic.List<IntPtr> FinestreEdge() {
    var pids = new System.Collections.Generic.HashSet<uint>();
    foreach (var p in System.Diagnostics.Process.GetProcessesByName("msedge")) pids.Add((uint)p.Id);
    var l = new System.Collections.Generic.List<IntPtr>();
    EnumWindows((h, x) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid) || !IsWindowVisible(h)) return true;
      var sb = new System.Text.StringBuilder(64); GetClassNameW(h, sb, 64);
      if (sb.ToString() != "Chrome_WidgetWin_1") return true;
      RECT r; GetWindowRect(h, out r);
      if (r.R - r.L >= 300 && r.B - r.T >= 200) l.Add(h);
      return true;
    }, IntPtr.Zero);
    return l;
  }
  public static void PreparaEdge() { edgePrima.Clear(); foreach (var h in FinestreEdge()) edgePrima.Add(h.ToInt64()); }
  public static IntPtr NuovaEdge() { foreach (var h in FinestreEdge()) if (!edgePrima.Contains(h.ToInt64())) return h; return IntPtr.Zero; }
  // Dà la tastiera alla finestra incastrata (serve agganciarsi per un attimo al suo thread).
  public static void Fuoco(IntPtr v) {
    if (!IsWindow(v)) return;
    uint pid; uint t = GetWindowThreadProcessId(v, out pid); uint io = GetCurrentThreadId();
    AttachThreadInput(io, t, true);
    SetFocus(v);
    AttachThreadInput(io, t, false);
  }
}
"@
[Console]::Out.WriteLine('pronto')
while ($true) {
  $l = [Console]::In.ReadLine()
  if ($l -eq $null) { break }
  try {
    $p = $l.Split(' ')
    switch ($p[0]) {
      'K' { [SalottoInput]::Key([uint16]$p[1], $p[2] -eq '1', [uint16]$p[3]) }
      'T' { [SalottoInput]::Text([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1]))) }
      'M' { [SalottoInput]::Move([int]$p[1], [int]$p[2]) }
      'C' { [SalottoInput]::Click() }
      'W' { [SalottoInput]::Wheel([int]$p[1]) }
      'F' { $h = [SalottoFinestre]::TrovaVideo(); [Console]::Out.WriteLine('R ' + $h.ToInt64()) }
      'V' {
        # Stato del video AirPlay: finestra esiste, è visibile, connessioni aperte con l'iPhone.
        $h = [IntPtr][long]$p[1]
        $e = [SalottoFinestre]::IsWindow($h)
        $v = $e -and [SalottoFinestre]::IsWindowVisible($h)
        $n = 0
        $ids = @(Get-Process -Name 'uxplay-windows' -ErrorAction SilentlyContinue | ForEach-Object { [uint32]$_.Id })
        if ($ids.Count) { $n = @(Get-NetTCPConnection -State Established -OwningProcess $ids -ErrorAction SilentlyContinue | Where-Object { $_.RemoteAddress -ne '127.0.0.1' -and $_.RemoteAddress -ne '::1' }).Count }
        [Console]::Out.WriteLine('R ' + [int]$e + ' ' + [int]$v + ' ' + $n)
      }
      'E' { [Console]::Out.WriteLine('R ' + [SalottoFinestre]::Incastra([IntPtr][long]$p[1], [IntPtr][long]$p[2])) }
      'A' { [SalottoFinestre]::Adatta([IntPtr][long]$p[1], [IntPtr][long]$p[2]) }
      'H' { [SalottoFinestre]::Nascondi([IntPtr][long]$p[1]) }
      'G' {
        $ids = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*salotto-edge*' } | ForEach-Object { $_.ProcessId }) -join ','
        [Console]::Out.WriteLine('R ' + [SalottoFinestre]::TrovaEdge($ids).ToInt64())
      }
      'N' { [Console]::Out.WriteLine('R ' + [SalottoFinestre]::Mantieni([IntPtr][long]$p[1], [IntPtr][long]$p[2])) }
      'U' { [SalottoFinestre]::Fuoco([IntPtr][long]$p[1]) }
      'P' { [SalottoFinestre]::PreparaEdge(); [Console]::Out.WriteLine('R ok') }
      'Q' { [Console]::Out.WriteLine('R ' + [SalottoFinestre]::NuovaEdge().ToInt64()) }
      'D' { [SalottoFinestre]::Tasto([IntPtr][long]$p[1], [uint32]$p[2], $p[3] -eq '1') }
      'X' { [SalottoFinestre]::Testo([IntPtr][long]$p[1], [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[2]))) }
      'B' { [SalottoFinestre]::Indietro([IntPtr][long]$p[1]) }
    }
  } catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    # Le domande devono avere sempre una risposta, anche vuota, sennò le risposte dopo vanno alla domanda sbagliata.
    if (@('F', 'V', 'E', 'G', 'N', 'P', 'Q') -contains $p[0]) { [Console]::Out.WriteLine('R ') }
  }
}
`;

class Tastiera {
  constructor(cartellaDati, log = () => {}) {
    this.log = log;
    this.proc = null;
    this.cartella = cartellaDati;
    this.attesa = []; // risposte attese dal PowerShell (titolo della finestra AirPlay)
  }
  disponibile() { return process.platform === 'win32'; }
  avvia() {
    if (!this.disponibile() || this.proc) return;
    const file = path.join(this.cartella, 'input.ps1');
    fs.writeFileSync(file, SCRIPT);
    this.proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true });
    let resto = '';
    this.proc.stdout.on('data', (d) => {
      const righe = (resto + d.toString()).split(/\r?\n/);
      resto = righe.pop();
      for (const r of righe) {
        if (r.startsWith('R ')) { const cb = this.attesa.shift(); if (cb) cb(r.slice(2).trim()); }
        else if (r.trim()) this.log('input: ' + r.trim());
      }
    });
    this.proc.stderr.on('data', (d) => this.log('input errore: ' + d.toString().trim()));
    this.proc.on('exit', (c) => { this.log('input chiuso ' + c); this.proc = null; this.attesa.splice(0).forEach((cb) => cb('')); });
  }
  scrivi(riga) {
    if (!this.disponibile()) return false;
    if (!this.proc) this.avvia();
    this.proc.stdin.write(riga + '\n');
    return true;
  }
  tasto(nome, conAlt = false) {
    const k = VK[nome];
    if (!k) return false;
    return this.scrivi(`K ${k[0]} ${k[1] ? 1 : 0} ${conAlt ? 0x12 : 0}`);
  }
  testo(s) { return this.scrivi('T ' + Buffer.from(String(s), 'utf8').toString('base64')); }
  muovi(dx, dy) { return this.scrivi(`M ${Math.round(dx)} ${Math.round(dy)}`); }
  clic() { return this.scrivi('C'); }
  rotella(d) { return this.scrivi(`W ${Math.round(d)}`); }
  // Domanda al PowerShell con risposta ('R ...'); '' se non risponde entro 3 secondi.
  // Il PowerShell risponde in ordine: chi va in tempo scaduto resta in coda (la sua risposta in ritardo
  // viene scartata lì) così la risposta successiva arriva alla domanda giusta.
  chiedi(riga, ms = 3000) {
    if (!this.disponibile()) return Promise.resolve('');
    return new Promise((ok) => {
      let fatto = false;
      const fine = (t) => { if (!fatto) { fatto = true; ok(t); } };
      this.attesa.push(fine);
      setTimeout(() => fine(''), ms);
      if (!this.scrivi(riga)) { const i = this.attesa.indexOf(fine); if (i >= 0) this.attesa.splice(i, 1); fine(''); }
    });
  }
  // Finestra del video AirPlay (uxplay-windows): handle come stringa, '0' se non c'è.
  async videoAirPlay() { return (await this.chiedi('F')) || '0'; }
  // { esiste, visibile, connessioni } della finestra del video; null se il PowerShell non risponde.
  async statoVideo(h) {
    const r = (await this.chiedi('V ' + h)).split(' ');
    if (r.length < 3) return null;
    return { esiste: r[0] === '1', visibile: r[1] === '1', connessioni: Number(r[2]) || 0 };
  }
  incastra(video, salotto) { return this.chiedi(`E ${video} ${salotto}`, 5000); }
  adatta(video, salotto) { return this.scrivi(`A ${video} ${salotto}`); }
  nascondi(video) { return this.scrivi(`H ${video}`); }
  async finestraEdge() { return (await this.chiedi('G', 10000)) || '0'; }
  mantieni(h, salotto) { return this.chiedi(`N ${h} ${salotto}`); }
  fuoco(h) { return this.scrivi(`U ${h}`); }
  preparaEdge() { return this.chiedi('P'); }
  async nuovaEdge() { return (await this.chiedi('Q')) || '0'; }
  // Tasti, testo e "indietro" mandati direttamente alla finestra h (Edge dentro Salotto).
  tastoA(h, nome) {
    const k = { ...VK, cancella: VK.backspace, invio: VK.ok, back: VK.esc }[nome];
    return k ? this.scrivi(`D ${h} ${k[0]} ${k[1] ? 1 : 0}`) : false;
  }
  testoA(h, s) { return this.scrivi(`X ${h} ${Buffer.from(String(s), 'utf8').toString('base64')}`); }
  indietroA(h) { return this.scrivi(`B ${h}`); }
  chiudi() {
    if (!this.proc) return;
    const pid = this.proc.pid;
    try { this.proc.stdin.end(); this.proc.kill(); } catch { /* già chiuso */ }
    // Su Windows kill() a volte non basta: chiusura forzata del PowerShell dei tasti.
    if (this.disponibile() && pid) { try { require('child_process').execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* già chiuso */ } }
    this.proc = null;
  }
}

module.exports = { Tastiera, VK };
