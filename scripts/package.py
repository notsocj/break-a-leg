#!/usr/bin/env python3
"""Package Git-tracked source and the standalone skill, excluding local artifacts."""
import argparse
import json
from pathlib import Path
import re
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

EXCLUDED_PARTS = {'node_modules', '.git', '.break-a-leg', '__pycache__', '.DS_Store', 'coverage'}
EXCLUDED_SUFFIXES = {'.zip', '.log', '.pyc', '.pem', '.key', '.p12', '.jks', '.keystore', '.mobileprovision'}


def tracked_files(root):
    try:
        top = subprocess.check_output(
            ['git', '-C', str(root), 'rev-parse', '--show-toplevel'],
            stderr=subprocess.DEVNULL, text=True,
        ).strip()
        if Path(top).resolve() != root:
            raise ValueError('Package from the BreakALeg Git root, not an extracted archive or nested directory.')
        names = subprocess.check_output(
            ['git', '-C', str(root), 'ls-files', '--cached', '-z'],
            stderr=subprocess.DEVNULL,
        ).decode('utf-8').split('\0')
    except (OSError, subprocess.CalledProcessError) as error:
        raise ValueError('Packaging requires Git and a BreakALeg Git checkout.') from error
    selected = []
    for name in sorted(set(filter(None, names))):
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Invalid tracked path; nothing was packaged.')
        if (any(part in EXCLUDED_PARTS for part in relative.parts)
                or relative.suffix in EXCLUDED_SUFFIXES
                or relative.name.startswith('.env')
                or relative.name == 'key.properties'):
            continue
        path = root / relative
        for parent in [path, *path.parents]:
            if parent == root:
                break
            if parent.is_symlink():
                raise ValueError('Tracked symlink paths cannot be packaged.')
        if not path.is_file():
            raise ValueError('A tracked file is missing or not a regular file; nothing was packaged.')
        selected.append(relative)
    return selected


def package(root, out):
    root, out = Path(root).resolve(), Path(out).resolve()
    if out == root or root in out.parents:
        raise ValueError('Choose an output directory outside the source repository.')
    files = tracked_files(root)
    version = json.loads((root / 'package.json').read_text())['version']
    if not isinstance(version, str) or not re.fullmatch(r'[0-9A-Za-z][0-9A-Za-z.+-]*', version):
        raise ValueError('Package version is not safe for an archive filename.')
    skill = Path('skills/break-a-leg')
    skill_files = [path for path in files if skill in path.parents]
    if skill / 'SKILL.md' not in skill_files:
        raise ValueError('The tracked installable skill is missing SKILL.md.')
    archives = [
        (out / f'break-a-leg-v{version}-source.zip', files, Path('.')),
        (out / f'break-a-leg-v{version}-skill.zip', skill_files, skill),
    ]
    if any(target.exists() or target.is_symlink() for target, _, _ in archives):
        raise ValueError('Destination archive already exists; choose a new output directory.')
    out.mkdir(parents=True, exist_ok=True)
    created = []
    try:
        for target, paths, prefix in archives:
            with ZipFile(target, 'x', compression=ZIP_DEFLATED) as archive:
                created.append(target)
                for relative in paths:
                    archive.write(root / relative, Path('break-a-leg') / relative.relative_to(prefix))
    except BaseException:
        for target in created:
            target.unlink(missing_ok=True)
        raise
    return created


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        targets = package(Path(__file__).resolve().parents[1], args.out)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f'Packaging failed: {error}\n')
    for target in targets:
        print(f'Created {target.name}')


if __name__ == '__main__':
    main()
