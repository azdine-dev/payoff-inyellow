"""Runs engine_v2.py on every engine/fixtures_v2*.json and checks the expected values.
Run: python engine/check_fixtures.py   (prints PASS or FAIL per fixture, exit code 1 if any fails)"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_parity_fixtures import run  # noqa: E402

bad = 0
for path in sorted(glob.glob(os.path.join(HERE, 'fixtures_v2*.json'))):
    for f in json.load(open(path)):
        r, e = run(f['input']), f['expect']
        rows = [(x['date'].isoformat(), round(x['bills'], 2), round(x['extra'], 2), round(x['total_move'], 2), round(x['owed'], 2)) for x in r['rows'][:4]]
        want = [(x['date'], x['bills'], x['extra'], x['total_move'], x['owed']) for x in e['first_paydays']]
        ok = (r['order'] == e['order'] and (r['debt_free'].isoformat() if r['debt_free'] else None) == e['debt_free']
              and r['paydays'] == e['paydays'] and abs(r['interest'] - e['interest']) < 0.005 and rows == want)
        bad += not ok
        if not ok or 'fixtures_v2.json' in path: print(('PASS ' if ok else 'FAIL ') + f['name'])
print('%d failed' % bad if bad else 'all passed')
sys.exit(1 if bad else 0)
