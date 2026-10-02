"""Deterministic ZIP: sorted files, fixed timestamps/permissions, extension at root."""
from pathlib import Path
import hashlib, json, zipfile
root=Path('dist/chrome')
version=json.loads((root/'manifest.json').read_text())['version']
release=Path('dist/releases');release.mkdir(parents=True,exist_ok=True)
archive=release/f'tabbackup-{version}-chrome.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for f in sorted(root.rglob('*')):
        if f.is_file():
            info=zipfile.ZipInfo(f.relative_to(root).as_posix(),(2026,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED;info.create_system=3;info.external_attr=0o100644<<16
            z.writestr(info,f.read_bytes(),compresslevel=9)
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{checksum}  {archive.name}\n')
with zipfile.ZipFile(archive) as z:
    assert 'manifest.json' in z.namelist()
    assert z.testzip() is None
print(f'{archive}\nSHA-256 {checksum}')
