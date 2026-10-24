#!/usr/bin/env python3
"""Check local Markdown file destinations without contacting external sites."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


def main():
    root = Path(__file__).resolve().parents[1]
    paths = list(root.glob('*.md'))
    for folder in ['docs', 'skills', 'examples', 'evals', 'tests/fixtures', '.github']:
        paths.extend((root / folder).rglob('*.md'))
    failures = []
    checked = 0
    for path in sorted(set(paths)):
        source = re.sub(r'^```[^\n]*\n.*?^```\s*$', '', path.read_text(), flags=re.M | re.S)
        for match in re.finditer(r'!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)', source):
            target = match.group(1).strip('<>')
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            checked += 1
            resolved = (path.parent / unquote(parsed.path)).resolve()
            if root not in resolved.parents and resolved != root:
                failures.append(f'{path.relative_to(root)}: link leaves repository: {target}')
            elif not resolved.exists():
                failures.append(f'{path.relative_to(root)}: missing destination: {target}')
    if failures:
        print('\n'.join(failures), file=sys.stderr)
        return 1
    print(f'Checked {checked} local file links across {len(set(paths))} Markdown files. Remote URLs and anchors are not validated.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
