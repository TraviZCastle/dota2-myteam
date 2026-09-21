#!/usr/bin/env python3
"""Fetch compact, reproducible TI main-tournament player snapshots."""
import json
import hashlib
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/events'
SPECS = [
    (2012,65001,'08-26','09-05'),(2013,65006,'08-03','08-14'),
    (2014,600,'07-09','07-22'),(2015,2733,'07-27','08-10'),
    (2016,4664,'08-03','08-15'),(2017,5401,'08-02','08-14'),
    (2018,9870,'08-15','08-27'),(2019,10749,'08-15','08-27'),
    (2021,13256,'10-07','10-19'),(2022,14268,'10-15','11-01'),
    (2023,15728,'10-12','10-31'),(2024,16935,'09-04','09-17'),
    (2025,18324,'09-04','09-16'),(2026,19719,'08-13','08-25')
]

def main():
    OUT.mkdir(exist_ok=True)
    for year,league,start,end in SPECS:
        target=OUT/f'{year}.json'
        if target.exists():
            print(year,'cached',flush=True);continue
        a=int(datetime.fromisoformat(f'{year}-{start}').replace(tzinfo=timezone.utc).timestamp())
        b=int(datetime.fromisoformat(f'{year}-{end}').replace(tzinfo=timezone.utc).timestamp())
        sql=f'''SELECT m.match_id,m.leagueid,m.start_time,m.duration,m.radiant_win,m.radiant_team_id,m.dire_team_id,m.radiant_score,m.dire_score,m.game_mode,m.series_id,m.series_type,
tr.name radiant_name,td.name dire_name,
json_agg(json_build_object('account_id',p.account_id,'name',n.name,'player_slot',p.player_slot,'hero_id',p.hero_id,'kills',p.kills,'deaths',p.deaths,'assists',p.assists,'gold_per_min',p.gold_per_min,'xp_per_min',p.xp_per_min,'hero_damage',p.hero_damage,'lane_role',p.lane_role) ORDER BY p.player_slot) players
FROM matches m JOIN player_matches p USING(match_id) LEFT JOIN notable_players n ON n.account_id=p.account_id
LEFT JOIN teams tr ON tr.team_id=m.radiant_team_id LEFT JOIN teams td ON td.team_id=m.dire_team_id
WHERE m.leagueid={league} AND m.start_time>={a} AND m.start_time<{b} AND m.game_mode IN (0,2)
GROUP BY m.match_id,tr.name,td.name ORDER BY m.match_id'''
        url='https://api.opendota.com/api/explorer?sql='+quote(sql)
        body=subprocess.check_output(['curl','-fsS','--retry','2','--max-time','60',url])
        payload=json.loads(body)
        assert not payload.get('err') and payload.get('rows'),payload
        matches=payload['rows']
        assert len(matches)==payload['rowCount'] and len(matches)==len({m['match_id'] for m in matches})
        assert all(len(m['players'])==10 for m in matches)
        source={'url':url,'fetchedAt':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(body).hexdigest(),'leagueId':league,'year':year,'games':len(matches),'start':f'{year}-{start}','endExclusive':f'{year}-{end}'}
        target.write_bytes(body)
        (OUT/f'{year}-source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')
        (OUT/f'{year}.sql').write_text(sql+'\n')
        print(year,len(matches),'maps',flush=True)

if __name__=='__main__':main()
