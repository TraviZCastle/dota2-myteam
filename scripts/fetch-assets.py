"""Cache official hero portraits for the offline archive; never player photos."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request
import json

PROJECT = Path(__file__).resolve().parents[1]
HEROES = json.loads((PROJECT / 'data/research/heroes.json').read_text())
NAMES = [h['name'].removeprefix('npc_dota_hero_') for h in HEROES.values()]
ROOT = PROJECT / 'assets' / 'heroes'

def download(name):
    url = f'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/{name}.png'
    path = ROOT / f'{name}.png'
    data = path.read_bytes() if path.exists() else urllib.request.urlopen(url, timeout=25).read()
    if not data.startswith(b'\x89PNG'):
        raise ValueError(f'Invalid PNG: {name}')
    path.write_bytes(data)
    return {'file': path.name, 'source_url': url, 'bytes': len(data), 'owner': 'Valve'}

if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as executor:
        records = list(executor.map(download, NAMES))
    (ROOT / 'sources.json').write_text(json.dumps(records, indent=2) + '\n')
    print(f'Saved {len(records)} hero images.')
