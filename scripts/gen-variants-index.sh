#!/usr/bin/env bash
# Generate variants-index.json from dotgg API
# Only includes cards with 2+ variants (ambiguous)
set -euo pipefail

curl -s "https://api.dotgg.gg/cgfw/getcards?game=onepiece" | python3 -c "
import json, sys
from collections import defaultdict

data = json.load(sys.stdin)
groups = defaultdict(list)

for c in data:
    idn = c.get('id_normal', c['id'])
    groups[idn].append(c)

index = {}
for idn, variants in sorted(groups.items()):
    first = variants[0]
    index[idn] = {
        'name': first['name'],
        'variants': [
            {
                's': c['id'][len(idn):] if c['id'] != idn else '',
                'r': c['rarity'],
                'cs': c.get('CardSets', '')
            }
            for c in variants
        ]
    }

json.dump(index, sys.stdout, separators=(',', ':'))
print()
"
