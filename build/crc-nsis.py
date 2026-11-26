# Controlla il CRC di installer/disinstallatori NSIS come fa Windows all'avvio
# (salta il primo blocco da 512 byte, poi fino a 4 byte dalla fine dei dati).
import sys, struct, zlib
for f in sys.argv[1:]:
    b = open(f, 'rb').read()
    pos = next((o for o in range(0, len(b), 512) if b[o+4:o+20] == struct.pack('<I', 0xDEADBEEF) + b'NullsoftInst'), None)
    if pos is None: print(f, 'nessun header NSIS'); continue
    flags, _, _, hl, tot = struct.unpack('<II12sII', b[pos:pos+28])
    end = pos + tot
    stored = struct.unpack('<I', b[end-4:end])[0]
    calc = zlib.crc32(b[512:end-4]) & 0xffffffff
    print(f.split('/')[-1], 'OK' if stored == calc else 'ROTTO', hex(stored), hex(calc))
