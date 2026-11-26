// Solo per la verifica: con NODE_OPTIONS="--require build/tieni-uninstaller.cjs" e TIENI=<cartella>
// copia il disinstallatore che electron-builder ricostruisce sul Mac, per controllarne il CRC (build/crc-nsis.py).
const Module = require('module'); const fs = require('fs'); const path = require('path');
const orig = Module.prototype.require;
Module.prototype.require = function (id) {
  const m = orig.apply(this, arguments);
  if (/nsisUtil(\.js)?$/.test(id) && m.UninstallerReader && !m.UninstallerReader.__tenuto) {
    const exec = m.UninstallerReader.exec;
    m.UninstallerReader.exec = async (inst, out) => { await exec(inst, out); fs.copyFileSync(out, path.join(process.env.TIENI, path.basename(out))); };
    m.UninstallerReader.__tenuto = true;
  }
  return m;
};
