#!/usr/bin/env python3
"""Install BreakALeg, or explicitly update it while preserving a backup."""
import argparse
import os
from pathlib import Path
import shutil
import tempfile
import uuid


def install(source: Path, destination: Path, update: bool = False):
    if not (source / 'SKILL.md').is_file():
        raise ValueError('Source is missing SKILL.md; nothing was installed.')
    if source.is_symlink() or any(p.is_symlink() for p in source.rglob('*')):
        raise ValueError('Skill source contains symbolic links; nothing was installed.')
    if destination.is_symlink() or (destination.exists() and not destination.is_dir()):
        raise ValueError('Destination must be a directory, not a symlink or file.')
    if destination.exists() and not update:
        raise ValueError('BreakALeg is already installed. Use --update to replace it with a backup.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    backup = None
    with tempfile.TemporaryDirectory(prefix='.break-a-leg-install-', dir=destination.parent) as tmp:
        payload = Path(tmp) / 'skill'
        shutil.copytree(source, payload)
        if destination.exists():
            backup_root = destination.parent.parent / 'skill-backups'
            backup_root.mkdir(parents=True, exist_ok=True)
            backup = backup_root / f'break-a-leg-{uuid.uuid4()}'
            destination.rename(backup)
        try:
            payload.rename(destination)
        except OSError:
            if backup is not None and not destination.exists():
                backup.rename(destination)
            raise
    return backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skills-dir', type=Path, help='Override the destination skills directory')
    parser.add_argument('--update', action='store_true', help='Replace an existing skill, preserving it under the parent skill-backups directory')
    args = parser.parse_args()
    source = Path(__file__).resolve().parents[1] / 'skills' / 'break-a-leg'
    skills_dir = args.skills_dir or Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills'
    destination = skills_dir.expanduser().resolve() / 'break-a-leg'
    try:
        backup = install(source, destination, args.update)
    except (ValueError, OSError) as error:
        parser.exit(1, f'Install failed: {error}\n')
    print(f'Installed BreakALeg at {destination}')
    if backup:
        print(f'Previous skill preserved at {backup}')


if __name__ == '__main__':
    main()
