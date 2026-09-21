#!/usr/bin/env python3
"""Build the offline TI archive. Fail closed on mismatched teams/accounts."""
import hashlib
import importlib.util
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
spec = importlib.util.spec_from_file_location('stats', ROOT / 'scripts/build-stats.py')
stats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stats)


def build():
    coach_selection = json.loads((DATA / 'coach-selection.json').read_text())
    aliases = json.loads((DATA / 'person-aliases.json').read_text())
    people = json.loads((DATA / 'people.json').read_text())
    def person(name):
        key = re.sub('[^a-z0-9\u4e00-\u9fff]', '', name.lower())
        return aliases.get(key, key)

    heroes_raw = json.loads((DATA / 'research/heroes.json').read_text())
    zh_body = (DATA / 'research/heroes-zh.json').read_bytes()
    zh_source = json.loads((DATA / 'research/heroes-zh-source.json').read_text())
    assert hashlib.sha256(zh_body).hexdigest() == zh_source['sha256'], 'hero localization hash mismatch'
    heroes_zh = {h['id']: h for h in json.loads(zh_body)['result']['data']['heroes']}
    for key, hero in heroes_raw.items():
        localized = heroes_zh.get(int(key))
        assert localized and localized['name'] == hero['name'], f'{key}: missing/mismatched Chinese hero name'
        assert re.search('[\u4e00-\u9fff]', localized['name_loc']) and not re.search('[A-Za-z]', localized['name_loc']), f'{key}: hero name must be Chinese'
    heroes = {int(k): {'id': h['name'].removeprefix('npc_dota_hero_'),
                        'name': heroes_zh[int(k)]['name_loc'], 'tags': h['roles']} for k, h in heroes_raw.items()}
    events, pools, role_usage = [], [], defaultdict(Counter)
    years = list(range(2011, 2020)) + list(range(2021, 2027))
    for index, year in enumerate(years):
        source_url = f'https://liquipedia.net/dota2/The_International/{year}'
        event = {'year': year, 'number': index + 1, 'name': f'TI{index+1}',
                 'rosterSource': source_url, 'statsStatus': 'available' if year > 2011 else 'unavailable',
                 'statsNote': '按当届战队账号匹配的公开比赛样本' if year > 2011 else 'OpenDota 暂无 TI1 逐场样本，未填入估算值。'}
        matches = []
        if year > 2011:
            body = (DATA / f'events/{year}.json').read_bytes()
            source = json.loads((DATA / f'events/{year}-source.json').read_text())
            assert hashlib.sha256(body).hexdigest() == source['sha256'], f'{year}: source hash mismatch'
            payload = json.loads(body)
            matches = payload['rows']
            assert len(matches) == payload['rowCount'] == source['games']
            assert len({m['match_id'] for m in matches}) == len(matches)
            assert all(m['leagueid'] == source['leagueId'] and len(m['players']) == 10 and m['duration'] > 0 for m in matches)
            event.update(leagueId=source['leagueId'], fetchedAt=source['fetchedAt'], rawGames=len(matches))
        rows = [line.split('|') for line in (DATA / 'rosters.tsv').read_text().splitlines() if line.startswith(str(year)+'|')]
        assert len(rows) == 8, f'{year}: must have exactly eight finalists'
        for _, key, team_id, finish, name, player_names, coach_names, region in rows:
            pool_id = f'{year}-{key}'
            team_id = int(team_id)
            pool = {'id': pool_id, 'year': year, 'event': event['name'], 'team': key, 'name': name,
                    'region': region, 'finish': finish, 'source': source_url, 'teamId': team_id if matches else None,
                    'coachStatus': 'recorded' if coach_names else 'not-recorded', 'cards': []}
            selected = [m for m in matches if team_id in (m['radiant_team_id'], m['dire_team_id'])]
            by_account, hero_counts = defaultdict(list), Counter()
            for m in selected:
                assert len({p['account_id'] for p in m['players']}) == 10
                for p in m['players']:
                    side = 'radiant' if p['player_slot'] < 128 else 'dire'
                    if m[side+'_team_id'] == team_id:
                        by_account[p['account_id']].append((m, p))
                        hero_counts[heroes[p['hero_id']]['id']] += 1
            names = player_names.split(',')
            assert len(names) == 5 and len(set(map(person, names))) == 5
            resolved = set()
            for role, player in enumerate(names, 1):
                identity = person(player)
                ids = set(people.get(identity, [])) & set(by_account)
                samples = sorted([row for account in ids for row in by_account[account]], key=lambda row: row[0]['match_id'])
                if matches:
                    assert ids and len(samples) == len(selected), f'{pool_id} {player}: missing/partial account coverage ({len(samples)}/{len(selected)})'
                    assert not ids & resolved, f'{pool_id}: duplicate account'
                    resolved.update(ids)
                usage = Counter(heroes[p['hero_id']]['id'] for _, p in samples)
                for hero, n in usage.items():
                    role_usage[hero][role] += n
                metric = stats.aggregate(samples) if samples else None
                if metric:
                    metric.update(accountIds=sorted(ids), teamId=team_id, leagueId=event['leagueId'], source='OpenDota')
                pool['cards'].append({'id': f'{pool_id}-{identity}', 'person': identity, 'name': player, 'year': year,
                                      'team': key, 'poolId': pool_id, 'teamName': name, 'role': role, 'stats': metric,
                                      'heroUsage': dict(usage.most_common()), 'heroSource': 'event-matches' if samples else 'unavailable'})
            assert resolved == set(by_account), f'{pool_id}: unlisted substitute/account {set(by_account)-resolved}'
            pool['games'] = len(selected)
            pool['wins'] = sum((m['radiant_team_id'] == team_id) == m['radiant_win'] for m in selected)
            for coach in filter(None, coach_names.split(',')):
                identity = person(coach)
                pool['cards'].append({'id': f'{pool_id}-coach-{identity}', 'person': identity, 'name': coach,
                                      'year': year, 'team': key, 'poolId': pool_id, 'teamName': name, 'role': 6,
                                      'stats': None, 'heroUsage': dict(hero_counts.most_common()),
                                      'heroSource': 'coached-team-event-matches' if selected else 'unavailable',
                                      'coachRecord': {'games': len(selected), 'wins': pool['wins'], 'finish': finish}})
            pools.append(pool)
        event['playerCards'] = 40
        event['coachCards'] = sum(c['role'] == 6 for p in pools if p['year'] == year for c in p['cards'])
        events.append(event)
    for hero in heroes.values():
        hero['observedRoles'] = sorted(role_usage[hero['id']])
    coach_ids = []
    expected_pools = {p['id'] for p in pools if p['year'] in coach_selection['years']}
    assert set(coach_selection['representatives']) == expected_pools and len(expected_pools) == 48
    for pool in pools:
        if pool['id'] not in expected_pools:
            continue
        selected = [c for c in pool['cards'] if c['role'] == 6 and c['name'] == coach_selection['representatives'][pool['id']]]
        assert len(selected) == 1, f"{pool['id']}: must select exactly one recorded coach"
        coach_ids.append(selected[0]['id'])
    result = {'version': 'ti-archive-v2', 'events': events, 'pools': pools, 'heroes': list(heroes.values()), 'aliases': aliases,
              'coachSelection': {'version': coach_selection['version'], 'years': coach_selection['years'], 'ids': coach_ids}}
    encoded = json.dumps(result, ensure_ascii=False, separators=(',', ':'))
    (ROOT / 'catalog-data.js').write_text('// Generated by scripts/build-catalog.py. See data/README.md.\n(function(root){const data=' + encoded + ";if(typeof module==='object'&&module.exports)module.exports=data;else root.DotaCatalog=data;})(typeof globalThis!=='undefined'?globalThis:this);\n")
    print(f'Built {len(events)} events, {len(pools)} pools, 600 players, {len(coach_ids)} selectable coaches; 560 player cards with match samples.')


if __name__ == '__main__':
    build()
