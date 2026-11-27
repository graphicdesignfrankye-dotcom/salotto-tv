// Scrive "Salotto" e la sua icona nell'exe (senza, Windows lo mostra come "Electron").
const fs = require('fs'); const path = require('path');
const ResEdit = require('resedit');
// Firma VMP di castLabs (EVS): senza, Netflix & co. rifiutano Widevine. Va fatta sul pacchetto finito
// (su Mac prima della firma del codice, che electron-builder fa dopo afterPack).
function firmaVmp(ctx) {
  const { execFileSync } = require('child_process');
  const py = path.join(__dirname, '..', '.evs', 'bin', 'python');
  if (process.env.SALOTTO_SENZA_VMP || !fs.existsSync(py)) { console.log('  • firma VMP saltata (manca .evs o SALOTTO_SENZA_VMP)'); return; }
  execFileSync(py, ['-m', 'castlabs_evs.vmp', '--no-ask', 'sign-pkg', ctx.appOutDir], { stdio: 'inherit' });
  console.log('  • firma VMP fatta in', path.basename(ctx.appOutDir));
}

exports.default = async function (ctx) {
  if (ctx.electronPlatformName === 'darwin') { firmaVmp(ctx); return; }
  if (ctx.electronPlatformName !== 'win32') return;
  const exePath = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.exe');
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
  const res = ResEdit.NtExecutableResource.from(exe);
  const vis = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const vi = vis.length ? vis[0] : ResEdit.Resource.VersionInfo.createEmpty();
  const lang = vis.length && vi.lang ? vi.lang : 1033, ver = ctx.packager.appInfo.version;
  const n = ver.split('.').map(Number).concat([0]).slice(0, 4);
  vi.setFileVersion(...n); vi.setProductVersion(...n);
  vi.setStringValues({ lang, codepage: 1200 }, {
    FileDescription: 'Salotto', ProductName: 'Salotto', InternalName: 'Salotto', OriginalFilename: 'Salotto.exe',
    CompanyName: 'Francesco Argento', LegalCopyright: 'Copyright © Francesco Argento', FileVersion: ver, ProductVersion: ver,
  });
  vi.outputToResourceEntries(res.entries);
  // Icona di Salotto al posto di quella di Electron (sostituisce il primo gruppo di icone dell'exe).
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const gruppi = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const idGruppo = gruppi.length ? gruppi[0].id : 1, langIco = gruppi.length ? gruppi[0].lang : lang;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, idGruppo, langIco, ico.icons.map((i) => i.data));
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • nome "Salotto" scritto in', path.basename(exePath));
  firmaVmp(ctx);
};
