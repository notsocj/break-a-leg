#!/usr/bin/env python3
"""Install the self-contained skill without replacing an existing installation."""
import argparse
import os
from pathlib import Path
import shutil

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--skills-dir', type=Path, help='Override the destination skills directory')
args = parser.parse_args()
source = Path(__file__).resolve().parents[1] / 'skills' / 'break-a-leg'
skills_dir = args.skills_dir or Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills'
destination = skills_dir.expanduser().resolve() / 'break-a-leg'
if destination.exists() or destination.is_symlink():
    parser.exit(1, 'BreakALeg is already present at the destination; nothing was overwritten.\n')
skills_dir.expanduser().mkdir(parents=True, exist_ok=True)
shutil.copytree(source, destination, symlinks=False)
print(f'Installed BreakALeg at {destination}')
