#!/usr/bin/env python3
"""Build offline card statistics from public OpenDota match snapshots.

Default: reproduce stats-data.js from checked-in snapshots. --refresh fetches
the two public Explorer queries again. No API key, server, or npm required.
"""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data' / 'raw'
EVENTS = {2018: (9870, 195), 2019: (10749, 193)}
FIELDS = {'kills': 'kills', 'deaths': 'deaths', 'assists': 'assists',
          'gpm': 'gold_per_min', 'xpm': 'xp_per_min'}


def valid(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def aggregate(rows):
    """Each row is (match, player). Missing metrics keep independent samples."""
    result = {'games': len(rows), 'samples': {}, 'matchIds': sorted(m['match_id'] for m, _ in rows)}
    for key, field in FIELDS.items():
        selected = [(m, p) for m, p in rows if valid(p.get(field)) and (key not in ('gpm', 'xpm') or m['duration'] > 0)]
        result['samples'][key] = len(selected)
        if key in ('gpm', 'xpm'):
            denom = sum(m['duration'] for m, _ in selected)
            value = sum(p[field] * m['duration'] for m, p in selected) / denom if denom else None
        else:
            value = sum(p[field] for _, p in selected) / len(selected) if selected else None
        result[key] = round(value, 4) if value is not None else None
    participation = []
    damage = []
    for match, player in rows:
        side = 'radiant' if player['player_slot'] < 128 else 'dire'
        team_kills = match.get(side + '_score')
        if valid(player.get('kills')) and valid(player.get('assists')) and valid(team_kills) and team_kills > 0:
            participation.append((player['kills'] + player['assists'], team_kills))
        if valid(player.get('hero_damage')) and match['duration'] > 0:
            damage.append((player['hero_damage'], match['duration']))
    result['participation'] = round(sum(v for v, _ in participation) / sum(v for _, v in participation), 6) if participation else None
    result['damagePerMin'] = round(sum(v for v, _ in damage) * 60 / sum(v for _, v in damage), 4) if damage else None
    result['samples'].update(participation=len(participation), damagePerMin=len(damage))
    return result


def load_event(year, refresh=False):
    league, expected = EVENTS[year]
    prefix = f'ti{year - 2010}'
    sql = (RAW / (prefix + '-query.sql')).read_text().strip()
    url = 'https://api.opendota.com/api/explorer?sql=' + quote(sql)
    target = RAW / (prefix + '-explorer.json')
    metadata = RAW / (prefix + '-source.json')
    if refresh:
        body = subprocess.check_output(['curl', '-fsS', '--retry', '2', '--max-time', '60', url])
    else:
        body = target.read_bytes()
    payload = json.loads(body)
    matches = payload.get('rows', [])
    assert not payload.get('err') and len(matches) == expected, f'TI{year - 2010}: incomplete event snapshot'
    assert payload['rowCount'] == expected
    assert len({m['match_id'] for m in matches}) == expected
    for match in matches:
        timestamp = datetime.fromtimestamp(match['start_time'], timezone.utc)
        assert match['leagueid'] == league and timestamp.year == year and timestamp.month == 8
        assert match['game_mode'] == 2 and match['duration'] > 0 and len(match['players']) == 10
        assert len({p['account_id'] for p in match['players']}) == 10
    digest = hashlib.sha256(body).hexdigest()
    if refresh or not metadata.exists():
        timestamp = datetime.now(timezone.utc) if refresh else datetime.fromtimestamp(target.stat().st_mtime, timezone.utc)
        source = {'source': 'OpenDota', 'url': url, 'fetchedAt': timestamp.isoformat(), 'sha256': digest,
                  'leagueId': league, 'year': year, 'matches': expected, 'queryFile': prefix + '-query.sql'}
        if refresh:
            target.write_bytes(body)
        metadata.write_text(json.dumps(source, ensure_ascii=False, indent=2) + '\n')
    source = json.loads(metadata.read_text())
    assert source['sha256'] == digest, 'Snapshot hash differs from source metadata'
    return matches, source


def build(refresh=False):
    accounts = json.loads((ROOT / 'data/accounts.json').read_text())
    reverse_players = {account: person for person, account in accounts['players'].items()}
    reverse_teams = {team: key for key, team in accounts['teams'].items()}
    # These are the existing selectable pools. Do not pull a player's other
    # team/year into their card (MATUMBAMAN played for Chaos at TI9).
    pool_keys = {2018: {'og', 'lgd', 'liquid', 'secret', 'eg', 'vp', 'vgj', 'mineski'},
                 2019: {'og', 'lgd', 'liquid', 'secret', 'eg', 'vp', 'vg', 'infamous'}}
    cards, events = {}, {}
    for year in EVENTS:
        matches, source = load_event(year, refresh)
        rows, team_games = defaultdict(list), defaultdict(int)
        for match in matches:
            for side in ('radiant', 'dire'):
                team_games[match[side + '_team_id']] += 1
            for player in match['players']:
                team_id = match['radiant_team_id'] if player['player_slot'] < 128 else match['dire_team_id']
                team = reverse_teams.get(team_id)
                if team not in pool_keys[year]:
                    continue
                assert player['account_id'] in reverse_players, f'Unmapped player: {player["account_id"]}'
                person = reverse_players[player['account_id']]
                rows[(team, person, team_id, player['account_id'])].append((match, player))
        for (team, person, team_id, account), samples in rows.items():
            assert len(samples) == team_games[team_id], f'Partial roster coverage: {year} {person}'
            stats = aggregate(samples)
            stats.update(accountId=account, teamId=team_id, leagueId=EVENTS[year][0], source='OpenDota')
            cards[f'{year}-{team}-{person}'] = stats
        events[str(year)] = {'leagueId': EVENTS[year][0], 'games': len(matches), 'fetchedAt': source['fetchedAt'],
                             'scope': 'group-stage-and-main-event', 'sourceFile': f'data/raw/ti{year - 2010}-source.json'}
    assert len(cards) == 80, f'Expected 80 cards, got {len(cards)}'
    result = {'meta': {'version': 'opendota-ti8-ti9-v1', 'source': 'OpenDota', 'events': events, 'cardCount': len(cards)}, 'cards': cards}
    encoded = json.dumps(result, ensure_ascii=False, separators=(',', ':'))
    output = "// Generated by scripts/build-stats.py; see data/README.md for provenance.\n(function(root){\n  const data=" + encoded + ";\n  if(typeof module==='object'&&module.exports)module.exports=data;else root.DotaStats=data;\n})(typeof globalThis!=='undefined'?globalThis:this);\n"
    (ROOT / 'stats-data.js').write_text(output)
    print(f'Built {len(cards)} cards from {sum(e[1] for e in EVENTS.values())} official-event games.')
    for year in EVENTS:
        card = cards[f'{year}-og-ana']
        print(f'TI{year - 2010} ana: {card["games"]} games; K/D/A {card["kills"]}/{card["deaths"]}/{card["assists"]}; GPM {card["gpm"]}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Refresh two OpenDota public snapshots before building')
    build(parser.parse_args().refresh)
