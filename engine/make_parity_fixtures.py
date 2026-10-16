"""Writes parity fixtures for the app engine. The expected values come from the
reference engine (engine_reference.py), so the TypeScript port must match them exactly.

  engine/fixtures-edge.json    named edge cases (CLAUDE.md section 6, Tests)
  engine/fixtures-random.json  seeded random scenarios

Run: python engine/make_parity_fixtures.py
"""
import copy, json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine_reference import simulate  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def debt(name, balance, apr, mn, my_order=None):
    return dict(name=name, type='', balance=balance, apr=apr, min=mn, due_day=1, my_order=my_order)


BASE = dict(freq='Every 2 weeks', next_payday=[2026, 10, 23], extra=150, buffer_now=200, buffer_goal=500,
            method='PaidInYellow order', debts=[], yearly=[], adj={}, charges={})


def sc(**kw):
    s = copy.deepcopy(BASE)
    s.update(kw)
    return s


TWO = [debt('Visa', 3200, 22.9, 96), debt('Store card', 640, 26.99, 35)]

EDGE = [
    ('zero_percent_debt', sc(debts=[debt('Medical', 1150, 0, 50)])),
    ('zero_minimum_with_interest', sc(debts=[debt('Card', 900, 19.9, 0), debt('Loan', 400, 5, 40)])),
    ('zero_minimum_zero_interest', sc(debts=[debt('Mom', 600, 0, 0), debt('Card', 300, 24, 25)])),
    ('minimum_below_interest', sc(debts=[debt('Old card', 5000, 29.99, 100), debt('Phone', 300, 0, 30)])),
    ('negative_adjustment_bigger_than_extra', sc(debts=TWO, adj={'1': -500, '2': -150, '4': -20})),
    ('buffer_already_above_goal', sc(debts=TWO, buffer_now=900)),
    ('buffer_goal_zero', sc(debts=TWO, buffer_now=0, buffer_goal=0)),
    ('extra_zero', sc(debts=TWO, extra=0)),
    ('monthly_on_jan_31', sc(freq='Every month', next_payday=[2027, 1, 31], debts=TWO, extra=300)),
    ('monthly_on_jan_29_leap_year', sc(freq='Every month', next_payday=[2028, 1, 29], debts=TWO, extra=300)),
    ('monthly_on_feb_28', sc(freq='Every month', next_payday=[2027, 2, 28], debts=TWO, extra=300)),
    ('twice_a_month_from_1st', sc(freq='Twice a month', next_payday=[2026, 11, 1], debts=TWO)),
    ('twice_a_month_from_15th', sc(freq='Twice a month', next_payday=[2027, 1, 15], debts=TWO)),
    ('twice_a_month_from_16th', sc(freq='Twice a month', next_payday=[2027, 1, 16], debts=TWO)),
    ('twice_a_month_from_31st', sc(freq='Twice a month', next_payday=[2027, 1, 31], debts=TWO)),
    ('twice_15th_and_last_day_from_31st', sc(freq='Twice a month', next_payday=[2026, 10, 31], other_payday=15, debts=TWO)),
    ('twice_15th_and_last_day_from_15th', sc(freq='Twice a month', next_payday=[2026, 11, 15], other_payday=31, debts=TWO)),
    ('twice_1st_and_15th', sc(freq='Twice a month', next_payday=[2026, 11, 1], other_payday=15, debts=TWO)),
    ('twice_1st_and_15th_from_15th', sc(freq='Twice a month', next_payday=[2026, 11, 15], other_payday=1, debts=TWO)),
    ('twice_custom_10_and_25', sc(freq='Twice a month', next_payday=[2026, 11, 10], other_payday=25, debts=TWO)),
    ('twice_custom_from_the_later_day', sc(freq='Twice a month', next_payday=[2026, 11, 25], other_payday=10, debts=TWO)),
    ('twice_other_same_as_first_falls_back', sc(freq='Twice a month', next_payday=[2026, 11, 20], other_payday=20, debts=TWO)),
    ('twice_last_day_of_february', sc(freq='Twice a month', next_payday=[2027, 2, 28], other_payday=15, debts=TWO)),
    ('twice_30_and_last_day_in_february', sc(freq='Twice a month', next_payday=[2027, 1, 30], other_payday=31, debts=TWO)),
    ('zero_percent_zero_minimum_is_never_first', sc(debts=[debt('Mom', 600, 0, 0), debt('Card', 900, 19.9, 0), debt('Small', 100, 5, 40)])),
    ('twice_a_month_from_feb_14_leap', sc(freq='Twice a month', next_payday=[2028, 2, 14], debts=TWO)),
    ('weekly_over_feb_29', sc(freq='Every week', next_payday=[2028, 2, 25], debts=TWO, extra=60)),
    ('never_ends_over_520', sc(freq='Every week', debts=[debt('Card', 20000, 29.99, 200)], extra=0)),
    ('charge_on_buffer_first_payday', sc(debts=TWO, buffer_now=0, charges={'1': 75, '3': 40})),
    ('charges_after_buffer', sc(debts=TWO, buffer_now=500, charges={'2': 300, '5': 25.5})),
    ('my_own_order_blanks_and_ties', sc(method='My own order', debts=[
        debt('A', 900, 10, 30), debt('B', 400, 20, 20, 2), debt('C', 700, 15, 25),
        debt('D', 300, 5, 20, 1), debt('E', 500, 25, 20, 2)])),
    ('paidinyellow_ties_keep_entry_order', sc(debts=[
        debt('First', 500, 20, 25), debt('Second', 500, 20, 25), debt('Third', 500, 18, 25)])),
    ('biggest_interest_ties_smaller_balance', sc(method='Biggest interest first', debts=[
        debt('Big', 900, 24, 30), debt('Small', 300, 24, 20), debt('Low', 200, 9, 20)])),
    ('zero_balance_debt', sc(debts=[debt('Done', 0, 20, 25), debt('Card', 800, 20, 30)])),
    ('two_growing_debts_highest_apr_first', sc(debts=[
        debt('G1', 4000, 24, 60), debt('G2', 3000, 29, 50), debt('Ok', 200, 10, 25)], extra=250)),
    ('yearly_bills_bigger_than_extra', sc(debts=TWO, extra=20, yearly=[dict(name='Car', per_year=1300, month='Any time')])),
    ('fractional_inputs', sc(freq='Every week', debts=[debt('Card', 1234.56, 21.49, 41.17), debt('Store', 98.76, 27.24, 15.5)],
                             extra=33.33, buffer_now=12.34, buffer_goal=250.5,
                             yearly=[dict(name='Gifts', per_year=410.25, month='December')])),
]

FREQS = ['Every week', 'Every 2 weeks', 'Twice a month', 'Every month']
METHODS = ['PaidInYellow order', 'Biggest interest first', 'My own order']


def money(rng, lo, hi):
    return round(rng.uniform(lo, hi), rng.choice([0, 0, 2]))


def random_scenario(rng, k):
    debts = []
    for i in range(rng.randint(1, 6)):
        bal = money(rng, 0, 15000) if rng.random() > 0.05 else 0
        apr = rng.choice([0, round(rng.uniform(0, 36), 2), round(rng.uniform(5, 30), 1)])
        mn = rng.choice([0, money(rng, 10, 400), round(max(25, bal * rng.uniform(0.01, 0.04)), 2)])
        my = rng.choice([None, rng.randint(1, 6)])
        debts.append(debt('D%d' % i, bal, apr, mn, my))
    y, m = rng.randint(2026, 2030), rng.randint(1, 12)
    d = rng.choice([1, 15, 28, 29, 30, 31, rng.randint(1, 31)])
    d = min(d, [31, 29 if (y % 4 == 0 and y % 100 != 0) or y % 400 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    s = sc(freq=rng.choice(FREQS), next_payday=[y, m, d], method=rng.choice(METHODS), debts=debts,
           extra=rng.choice([0, money(rng, 5, 600)]), buffer_now=money(rng, 0, 1500), buffer_goal=rng.choice([0, 500, 1000, money(rng, 0, 2000)]),
           yearly=[dict(name='Y%d' % i, per_year=money(rng, 50, 2000), month='Any time') for i in range(rng.randint(0, 3))])
    if s['freq'] == 'Twice a month' and rng.random() < 0.7:
        s['other_payday'] = rng.choice([1, 5, 10, 15, 20, 25, 28, 30, 31, rng.randint(1, 31)])
    s['adj'] = {str(rng.randint(1, 40)): money(rng, -400, 600) for _ in range(rng.randint(0, 4))}
    s['charges'] = {str(rng.randint(1, 40)): money(rng, 5, 800) for _ in range(rng.randint(0, 3))}
    return ('random_%03d' % k, s)


def build(cases):
    out = []
    for name, inp in cases:
        out.append(dict(name=name, input=inp, expected=simulate(inp)))
    return out


if __name__ == '__main__':
    rng = random.Random(20261015)
    edge = build(EDGE)
    rand = build([random_scenario(rng, k) for k in range(200)])
    with open(os.path.join(HERE, 'fixtures-edge.json'), 'w') as f:
        json.dump(edge, f, indent=1)
    with open(os.path.join(HERE, 'fixtures-random.json'), 'w') as f:
        json.dump(rand, f, separators=(',', ':'))
    print('wrote %d edge and %d random fixtures' % (len(edge), len(rand)))
