// Bluetooth per le Impostazioni di Salotto (solo Windows): stato e interruttore della radio,
// dispositivi abbinati, ricerca di quelli nuovi, abbinamento e "dimentica".
// Usa le API di Windows (WinRT: Windows.Devices.Radios, Windows.Devices.Enumeration) da PowerShell.
// L'abbinamento funziona per i dispositivi che non chiedono un PIN (cuffie, casse, controller):
// per gli altri l'interfaccia offre le impostazioni Bluetooth di Windows.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const WINDOWS = process.platform === 'win32';
const MAC = process.platform === 'darwin';
// blueutil (brew install blueutil): l'unico modo semplice di gestire il Bluetooth del Mac da un programma.
const BLUEUTIL = ['/opt/homebrew/bin/blueutil', '/usr/local/bin/blueutil'];
const INDIRIZZO = /^[0-9a-f]{2}([-:][0-9a-f]{2}){5}$/i;

const SCRIPT = String.raw`
param([string]$Azione)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
function Attendi($op, [Type]$tipo, [int]$ms = 25000) {
  $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op))
  if (-not $t.Wait($ms)) { throw 'tempo scaduto' }
  $t.Result
}
$null = [Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$Info = [Windows.Devices.Enumeration.DeviceInformation]
$Tipo = [Windows.Devices.Enumeration.DeviceInformationKind]::AssociationEndpoint
$proprieta = [System.Collections.Generic.List[string]]@('System.Devices.Aep.IsConnected', 'System.Devices.Aep.IsPaired', 'System.Devices.Aep.Category')
$protocolli = [ordered]@{ classico = '{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}'; LE = '{bb7bb05e-5972-42b5-94fc-76eaa7084d49}' }
$tempi = New-Object System.Collections.Generic.List[string]
function Tempo([string]$nome, [scriptblock]$fai) {
  $o = [Diagnostics.Stopwatch]::StartNew()
  try { & $fai } finally { $tempi.Add($nome + ' ' + [math]::Round($o.Elapsed.TotalSeconds, 1) + 's') }
}

function Radio {
  $radios = Tempo 'radio' { Attendi ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]]) }
  $radios | Where-Object { $_.Kind -eq [Windows.Devices.Radios.RadioKind]::Bluetooth } | Select-Object -First 1
}
function Dispositivi([bool]$abbinati) {
  # Una ricerca per tipo di Bluetooth (classico e LE): così si vede nel log quale dei due è lento.
  $lista = foreach ($k in $protocolli.Keys) {
    $aqs = 'System.Devices.Aep.ProtocolId:="' + $protocolli[$k] + '" AND System.Devices.Aep.IsPaired:=System.StructuredQueryType.Boolean#' + $(if ($abbinati) { 'True' } else { 'False' })
    Tempo $k { Attendi ($Info::FindAllAsync($aqs, $proprieta, $Tipo)) ([Windows.Devices.Enumeration.DeviceInformationCollection]) 40000 }
  }
  $visti = @{}
  foreach ($d in $lista) {
    if (-not $d.Name -or $visti.ContainsKey($d.Name)) { continue }
    $visti[$d.Name] = 1
    $cat = $d.Properties['System.Devices.Aep.Category']
    [pscustomobject]@{
      id = $d.Id
      nome = $d.Name
      abbinato = [bool]$d.Pairing.IsPaired
      connesso = [bool]$d.Properties['System.Devices.Aep.IsConnected']
      categoria = if ($cat) { ($cat -join ' ') } else { '' }
    }
  }
}
function Dispositivo {
  $id = $env:SALOTTO_BT_ID
  if (-not $id) { throw 'manca il dispositivo' }
  Attendi ($Info::CreateFromIdAsync($id, $proprieta, $Tipo)) ([Windows.Devices.Enumeration.DeviceInformation])
}

$fuori = @{ ok = $true }
try {
  switch ($Azione) {
    'radio' {
      $r = Radio
      $fuori.presente = [bool]$r
      $fuori.acceso = [bool]($r -and $r.State -eq [Windows.Devices.Radios.RadioState]::On)
    }
    'abbinati' { $fuori.dispositivi = @(Dispositivi $true) }
    'cerca' { $fuori.dispositivi = @(Dispositivi $false) }
    'accendi' {
      $null = Attendi ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus])
      $fuori.esito = [string](Attendi ((Radio).SetStateAsync([Windows.Devices.Radios.RadioState]::On)) ([Windows.Devices.Radios.RadioAccessStatus]))
    }
    'spegni' {
      $null = Attendi ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus])
      $fuori.esito = [string](Attendi ((Radio).SetStateAsync([Windows.Devices.Radios.RadioState]::Off)) ([Windows.Devices.Radios.RadioAccessStatus]))
    }
    'abbina' {
      $d = Dispositivo
      $fuori.esito = [string](Attendi ($d.Pairing.PairAsync()) ([Windows.Devices.Enumeration.DevicePairingResult]) 60000).Status
    }
    'dimentica' {
      $d = Dispositivo
      $fuori.esito = [string](Attendi ($d.Pairing.UnpairAsync()) ([Windows.Devices.Enumeration.DeviceUnpairingResult])).Status
    }
    default { throw 'azione sconosciuta' }
  }
} catch { $fuori.ok = $false; $fuori.errore = $_.Exception.Message }
$fuori.tempi = ($tempi -join ', ')
[Console]::Out.WriteLine(($fuori | ConvertTo-Json -Depth 4 -Compress))
`;

// Esiti di Windows → frase per la TV.
const ESITI = {
  Paired: 'Abbinato', AlreadyPaired: 'Era già abbinato', Unpaired: 'Dimenticato', AlreadyUnpaired: 'Era già dimenticato',
  Allowed: 'Fatto', DeniedByUser: 'Windows non lo permette (impostazioni di privacy)', DeniedBySystem: 'Windows non lo permette',
  NotReadyToPair: 'Il dispositivo non è pronto: mettilo in modalità abbinamento', AuthenticationTimeout: 'Il dispositivo non ha risposto in tempo',
  AuthenticationFailure: 'Abbinamento non riuscito', RequiredHandlerNotRegistered: 'Questo dispositivo chiede un PIN: abbinalo dalle impostazioni di Windows',
  ConnectionRejected: 'Il dispositivo ha rifiutato la connessione', TooManyConnections: 'Il dispositivo è già collegato ad altro',
  Failed: 'Non riuscito', OperationAlreadyInProgress: 'Un abbinamento è già in corso',
};

class Bluetooth {
  constructor(cartellaDati, log = () => {}) {
    this.script = path.join(cartellaDati, 'bluetooth.ps1');
    this.log = log;
    this.coda = Promise.resolve(); // un'operazione alla volta
  }
  esegui(azione, id) {
    if (MAC) return this.coda = this.coda.catch(() => {}).then(() => this.mac(azione, id));
    if (!WINDOWS) return Promise.resolve({ ok: false, errore: 'Il Bluetooth si gestisce solo su Windows e Mac' });
    const lavoro = () => new Promise((ok) => {
      fs.writeFileSync(this.script, '﻿' + SCRIPT, 'utf8');
      const env = { ...process.env, SALOTTO_BT_ID: id ? String(id) : '' };
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.script, '-Azione', azione],
        { windowsHide: true, timeout: 90000, env, maxBuffer: 4 * 1024 * 1024 }, (e, out, err) => {
          const riga = String(out || '').trim().split(/\r?\n/).filter((l) => l.startsWith('{')).pop();
          let r = null;
          try { r = riga ? JSON.parse(riga) : null; } catch { r = null; }
          if (!r) r = { ok: false, errore: (e && e.message) || String(err || '').trim().slice(0, 200) || 'nessuna risposta' };
          if (r.esito) r.messaggio = ESITI[r.esito] || r.esito;
          if (r.dispositivi && !Array.isArray(r.dispositivi)) r.dispositivi = Array.isArray(r.dispositivi.value) ? r.dispositivi.value : [r.dispositivi];
          this.log(`bluetooth ${azione}: ${r.ok ? 'ok' : 'errore ' + r.errore}${r.esito ? ' (' + r.esito + ')' : ''}${r.dispositivi ? ' · ' + r.dispositivi.length + ' dispositivi' : ''}${r.tempi ? ' · ' + r.tempi : ''}`);
          ok(r);
        });
    });
    const p = this.coda.then(lavoro, lavoro);
    this.coda = p.catch(() => {});
    return p;
  }
}

// Mac: stesse risposte della versione Windows, prese da blueutil.
Bluetooth.prototype.mac = async function (azione, id) {
  const bu = BLUEUTIL.find((p) => fs.existsSync(p));
  if (!bu) return { ok: false, manca: 'blueutil', errore: 'Per gestire il Bluetooth da Salotto serve blueutil' };
  const via = (args, ms = 30000) => new Promise((ok) => execFile(bu, args, { timeout: ms }, (e, out, err) => ok({ e, out: String(out || ''), err: String(err || '').trim() })));
  const json = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const dispositivo = (d) => ({ id: d.address, nome: d.name || d.address, abbinato: Boolean(d.paired), connesso: Boolean(d.connected), categoria: '' });
  let r;
  if (azione === 'radio') { r = await via(['-p']); if (r.e) return { ok: false, errore: r.err || r.e.message }; return { ok: true, presente: true, acceso: r.out.trim() === '1' }; }
  if (azione === 'accendi' || azione === 'spegni') { r = await via(['-p', azione === 'accendi' ? '1' : '0']); return r.e ? { ok: false, errore: r.err || r.e.message } : { ok: true, esito: 'Allowed', messaggio: 'Fatto' }; }
  if (azione === 'abbinati') { r = await via(['--paired', '--format', 'json']); const l = json(r); return l ? { ok: true, dispositivi: l.map(dispositivo) } : { ok: false, errore: r.err || 'risposta non valida' }; }
  if (azione === 'cerca') { r = await via(['--inquiry', '12', '--format', 'json'], 40000); const l = json(r); return l ? { ok: true, dispositivi: l.filter((d) => !d.paired).map(dispositivo) } : { ok: false, errore: r.err || 'ricerca non riuscita' }; }
  if (azione === 'abbina' || azione === 'dimentica') {
    if (!INDIRIZZO.test(String(id || ''))) return { ok: false, errore: 'dispositivo non valido' };
    if (azione === 'dimentica') { r = await via(['--unpair', id]); return r.e ? { ok: false, errore: r.err || 'Non riuscito' } : { ok: true, esito: 'Unpaired', messaggio: 'Dimenticato' }; }
    r = await via(['--pair', id], 60000);
    if (r.e) return { ok: true, esito: 'Failed', messaggio: /pin/i.test(r.err) ? 'Questo dispositivo chiede un PIN: abbinalo dalle Impostazioni del Mac' : 'Abbinamento non riuscito: ' + (r.err || 'riprova') };
    await via(['--connect', id], 20000);
    return { ok: true, esito: 'Paired', messaggio: 'Abbinato' };
  }
  return { ok: false, errore: 'azione non valida' };
};

module.exports = { Bluetooth, ESITI };
