#!/usr/bin/env python3
"""Validate local Markdown links and bound always-loaded agent instructions."""
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
tracked = subprocess.check_output(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
    cwd=ROOT, text=True,
).splitlines()
files = sorted({ROOT / name for name in tracked if name.endswith(".md")
                and (ROOT / name).is_file()})
errors = []


def anchors(path):
    text = re.sub(r"^```.*?^```[^\n]*", "", path.read_text(), flags=re.M | re.S)
    result = set()
    counts = {}
    for heading in re.findall(r"^#{1,6}\s+(.+?)\s*#*\s*$", text, re.M):
        slug = re.sub(r"[^\w\- ]", "", heading.lower()).replace(" ", "-")
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        result.add(slug + (f"-{count}" if count else ""))
    return result


for path in files:
    content = path.read_text()
    for target in re.findall(r"!?\[[^\]\n]*\]\(([^)\s]+)\)", content):
        target = unquote(target.strip("<>"))
        if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", target):
            continue
        location, _, fragment = target.partition("#")
        destination = (path.parent / location).resolve() if location else path
        if not destination.exists():
            errors.append(f"{path.relative_to(ROOT)}: missing {target}")
        elif fragment and destination.suffix == ".md" and fragment not in anchors(destination):
            errors.append(f"{path.relative_to(ROOT)}: missing heading {target}")
    if path.name in {"AGENTS.md", "CLAUDE.md"}:
        if len(path.read_bytes()) > 4096 or len(content.splitlines()) > 80:
            errors.append(f"{path.relative_to(ROOT)}: exceeds 4096-byte/80-line instruction budget")

for error in errors:
    print(error, file=sys.stderr)
print(f"Checked {len(files)} Markdown files: {len(errors)} error(s).")
sys.exit(bool(errors))
