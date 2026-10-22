#!/usr/bin/env python3
"""Archive the source repository and standalone skill, excluding local data/dependencies."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=True)
excluded = {'node_modules', '.git', '.break-a-leg', '__pycache__', '.DS_Store'}
for source, filename, prefix in [
    (root, 'break-a-leg-v0.1.0-source.zip', 'break-a-leg'),
    (root / 'skills' / 'break-a-leg', 'break-a-leg-v0.1.0-skill.zip', 'break-a-leg'),
]:
    target = out / filename
    with ZipFile(target, 'x', compression=ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob('*')):
            relative = path.relative_to(source)
            if any(part in excluded for part in relative.parts):
                continue
            if path.is_symlink() or not path.is_file() or path.suffix == '.zip' or path.name.startswith('.env'):
                continue
            archive.write(path, Path(prefix) / relative)
    print(f'Created {filename}')
