import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('build_stats', Path(__file__).resolve().parents[1] / 'scripts/build-stats.py')
stats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stats)


def row(match_id, duration, score, **fields):
    return ({'match_id': match_id, 'duration': duration, 'radiant_score': score, 'dire_score': 30},
            {'player_slot': 0, **fields})


class StatisticsTests(unittest.TestCase):
    def test_weighting_and_independent_coverage(self):
        result = stats.aggregate([
            row(1, 600, 10, kills=0, deaths=0, assists=5, gold_per_min=100, xp_per_min=None, hero_damage=6000),
            row(2, 1800, 20, kills=10, deaths=2, assists=5, gold_per_min=500, xp_per_min=400, hero_damage=None)
        ])
        self.assertEqual(result['kills'], 5)
        self.assertEqual(result['gpm'], 400)  # Weighted by duration, not 300.
        self.assertEqual(result['xpm'], 400)
        self.assertEqual(result['damagePerMin'], 600)  # Missing damage must not dilute the denominator.
        self.assertAlmostEqual(result['participation'], 20 / 30, places=6)
        self.assertEqual(result['samples']['kills'], 2)
        self.assertEqual(result['samples']['xpm'], 1)
        self.assertEqual(result['samples']['damagePerMin'], 1)

    def test_zero_is_real_missing_stays_null(self):
        result = stats.aggregate([row(1, 600, 0, kills=0, deaths=0, assists=0, hero_damage=0)])
        self.assertEqual(result['kills'], 0)
        self.assertEqual(result['damagePerMin'], 0)
        self.assertIsNone(result['gpm'])
        self.assertIsNone(result['participation'])
        self.assertEqual(result['samples']['participation'], 0)

    def test_dire_participation_uses_correct_team(self):
        match, player = row(1, 600, 10, kills=3, assists=12)
        player['player_slot'] = 128
        self.assertEqual(stats.aggregate([(match, player)])['participation'], .5)

    def test_event_scopes_and_hashes(self):
        for year, (_, count) in stats.EVENTS.items():
            rows, metadata = stats.load_event(year)
            self.assertEqual(len(rows), count)
            self.assertEqual(metadata['source'], 'OpenDota')


if __name__ == '__main__':
    unittest.main()
