SELECT m.match_id,m.leagueid,m.start_time,m.duration,m.radiant_win,m.radiant_team_id,m.dire_team_id,m.radiant_score,m.dire_score,m.game_mode,m.series_id,m.series_type,
tr.name radiant_name,td.name dire_name,
json_agg(json_build_object('account_id',p.account_id,'name',n.name,'player_slot',p.player_slot,'hero_id',p.hero_id,'kills',p.kills,'deaths',p.deaths,'assists',p.assists,'gold_per_min',p.gold_per_min,'xp_per_min',p.xp_per_min,'hero_damage',p.hero_damage,'lane_role',p.lane_role) ORDER BY p.player_slot) players
FROM matches m JOIN player_matches p USING(match_id) LEFT JOIN notable_players n ON n.account_id=p.account_id
LEFT JOIN teams tr ON tr.team_id=m.radiant_team_id LEFT JOIN teams td ON td.team_id=m.dire_team_id
WHERE m.leagueid=19719 AND m.start_time>=1786579200 AND m.start_time<1787616000 AND m.game_mode IN (0,2)
GROUP BY m.match_id,tr.name,td.name ORDER BY m.match_id
