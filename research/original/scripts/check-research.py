#!/usr/bin/env python3
"""Check the local research handoff without installing application tooling."""
import json
import re
import struct
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1]
workspace = root.parents[1]
errors = []
links = 0
for path in root.rglob('*'):
    if path.suffix not in {'.md', '.html'}:
        continue
    content = path.read_text()
    targets = re.findall(r'\]\(([^\s)]+)', content) if path.suffix == '.md' else re.findall(r'(?:href|src)=[\"\']([^\"\']+)', content)
    for target in targets:
        if target.startswith('../assets/demo-covers/${'):
            continue  # Checked against the complete fixture manifest below.
        parts = urlsplit(target.strip('<>'))
        if parts.scheme or not parts.path or parts.path.startswith('/'):
            continue
        links += 1
        if not (path.parent / unquote(parts.path)).exists():
            errors.append(f'{path.relative_to(root)}: missing {target}')
    if path.suffix == '.html':
        scripts = re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>', content)
        for script in scripts:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.js') as temporary:
                temporary.write(script)
                temporary.flush()
                result = subprocess.run(['node', '--check', temporary.name], capture_output=True, text=True)
                if result.returncode:
                    errors.append(result.stderr)
launch = json.loads((workspace / '.claude/launch.json').read_text())
entry = next((item for item in launch['configurations'] if item['name'] == 'tunevault-interface-concept'), None)
if not entry or entry.get('runtimeArgs') != ['personal/tunevault', '1347'] or entry.get('port') != 1347:
    errors.append('Preview launch entry is missing or inconsistent')
logo = root / 'assets/branding/tunevault-wolf-concept.png'
if not logo.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):
    errors.append('Logo is not a PNG')
cover_root = root / 'assets/demo-covers'
manifest = json.loads((cover_root / 'manifest.json').read_text())
cover_files = {cover['file'] for cover in manifest['covers']}
fixture_files = set(re.findall(r"cover:\s*['\"]([^'\"]+)['\"]", (root / 'docs/interface-preview.html').read_text()))
if cover_files != fixture_files or len(cover_files) != 6:
    errors.append('The six-cover manifest and HTML fixtures differ')
for filename in cover_files:
    path = cover_root / filename
    if path.parent != cover_root or not path.exists():
        errors.append(f'Missing/invalid cover asset: {filename}')
        continue
    data = path.read_bytes()
    if not data.startswith(b'\x89PNG\r\n\x1a\n') or len(data) < 24:
        errors.append(f'Not a valid PNG header: {filename}')
        continue
    width, height = struct.unpack('>II', data[16:24])
    if width != height or width < 512:
        errors.append(f'Cover must be square and at least 512px: {filename}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'Passed: {links} local links/assets, inline JavaScript syntax, preview launch entry, logo PNG, six square cover fixtures')
