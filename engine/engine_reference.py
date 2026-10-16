"""PaidInYellow payoff engine, reference version (v1).

This is the exact model used by the Google Sheet bonus. Its results were checked
cell by cell against the sheet (LibreOffice recalculation) in 4 scenarios with zero
difference. The app engine must reproduce engine/fixtures.json.

Model (one step per payday):
  ppy        = paydays per year: weekly 52, every 2 weeks 26, twice a month 24, monthly 12
  rate/payday = APR / ppy                      (simple per-payday interest)
  min/payday  = monthly minimum * 12 / ppy     (money set aside for minimums)
  Each payday, money for the plan ("extra", plus any +/- for that payday) goes:
    1. yearly bills (sinking funds): sum(yearly costs) / ppy, capped at what is available
    2. buffer, until it reaches the buffer goal
    3. what is left goes to debts as extra, in payoff order; one focus debt gets it all,
       overflow goes to the next debt. Minimums of paid-off debts roll into the extra.
  New charges on a payday are added to the focus debt (the debt that got the most extra,
  else the first debt in order).
  Payoff orders:
    PaidInYellow order: a debt with interest whose monthly minimum <= its monthly interest goes first
                        (highest APR among those first); then smallest balance first.
    Biggest interest first: highest APR first (ties: smaller balance).
    My own order: the user's numbers; blank = last.
  Ties always keep the order the debts were entered.
"""
import calendar, datetime, json, math, sys

PPY = {'Every week': 52, 'Every 2 weeks': 26, 'Twice a month': 24, 'Every month': 12}

def add_months(d, m):
    y, mo = divmod(d.month - 1 + m, 12); y += d.year; mo += 1
    return datetime.date(y, mo, min(d.day, calendar.monthrange(y, mo)[1]))

def twice_a_month_days(first, other=None):
    """The two pay days of the month. 31 means the last day of the month.
    If the other payday is not given: day <= 15 pairs with day + 15; the last day of a
    month pairs with the 15th; any other day after the 15th pairs with day - 15."""
    d = 31 if first.day == calendar.monthrange(first.year, first.month)[1] else first.day
    if not other or other == d:
        other = d + 15 if d <= 15 else (15 if d == 31 else d - 15)
    return min(d, other), max(d, other), d

def payday_date(first, freq, n, other=None):
    """n = 1 for the first payday. other = the second pay day of the month (twice a month only)."""
    if freq == 'Every week': return first + datetime.timedelta(7 * (n - 1))
    if freq == 'Every 2 weeks': return first + datetime.timedelta(14 * (n - 1))
    if freq == 'Every month': return add_months(first, n - 1)
    # twice a month: two fixed days of the month (capped at the month's end), alternating
    lo, hi, d = twice_a_month_days(first, other)
    idx = n - 1 + (0 if d == lo else 1)
    y, mo = divmod(first.month - 1 + idx // 2, 12); y += first.year; mo += 1
    return datetime.date(y, mo, min(lo if idx % 2 == 0 else hi, calendar.monthrange(y, mo)[1]))

def payoff_order(debts, method):
    def key(i):
        d = debts[i]; B, apr, mn = d['balance'], d['apr'], d['min']
        if method == 'PaidInYellow order':
            return (0, -apr, i) if apr > 0 and mn <= B * apr / 1200 else (1, B, i)
        if method == 'Biggest interest first':
            return (-apr, B, i)
        return (d.get('my_order') if d.get('my_order') is not None else 1e6, i)
    return sorted(range(len(debts)), key=key)

def minimums_only(d):
    """Months and interest if only the monthly minimum is paid (None = never ends)."""
    B, apr, mn = d['balance'], d['apr'], d['min']
    if B <= 0: return 0, 0.0
    r = apr / 1200
    if mn <= B * r: return None, None
    if r == 0: return math.ceil(B / mn), 0.0
    n = -math.log(1 - r * B / mn) / math.log(1 + r)
    return math.ceil(n), mn * n - B

def simulate(sc, max_paydays=520):
    freq = sc['freq']; ppy = PPY[freq]
    first = datetime.date(*sc['next_payday'])
    extra = sc['extra']; goal = sc['buffer_goal']; buffer = sc['buffer_now']
    debts = sc['debts']; adj = {int(k): v for k, v in sc.get('adj', {}).items()}
    chg = {int(k): v for k, v in sc.get('charges', {}).items()}
    funds_pp = sum(y['per_year'] for y in sc.get('yearly', [])) / ppy
    order = payoff_order(debts, sc['method'])
    names = [debts[i]['name'] for i in order]
    bal = [float(debts[i]['balance']) for i in order]
    apr = [debts[i]['apr'] / 100 for i in order]
    mpp = [debts[i]['min'] * 12 / ppy for i in order]
    rows, total_interest, paid_off = [], 0.0, {}
    for n in range(1, max_paydays + 1):
        if sum(bal) <= 0.005: break
        a, c = adj.get(n, 0), chg.get(n, 0)
        funds = min(funds_pp, max(0, extra + a))
        to_buf = min(max(0, goal - buffer), max(0, extra + a - funds)); buffer += to_buf
        grown = [b * (1 + r / ppy) for b, r in zip(bal, apr)]
        interest = sum(g - b for g, b in zip(grown, bal)); total_interest += interest
        mins = [min(g, m) for g, m in zip(grown, mpp)]
        pot = max(0, extra + a - funds - to_buf) + sum(mpp) - sum(mins)
        xs = []
        for g, m in zip(grown, mins):
            xs.append(min(g - m, max(0, pot - sum(xs))))
        focus = xs.index(max(xs)) if max(xs) > 0 else 0
        bal = [max(0, g - m - x) for g, m, x in zip(grown, mins, xs)]
        bal[focus] += c
        date = payday_date(first, freq, n, sc.get('other_payday'))
        for k, b in enumerate(bal):
            if b <= 0.005 and names[k] not in paid_off: paid_off[names[k]] = date.isoformat()
        rows.append(dict(payday=n, date=date.isoformat(), minimums=round(sum(mins), 2), to_buffer=round(to_buf, 2),
                         to_yearly_bills=round(funds, 2), extra=round(sum(xs), 2),
                         extra_goes_to=names[focus] if sum(xs) > 0.005 else ('Buffer first' if to_buf > 0 else ''),
                         total_to_set_aside=round(sum(mins) + to_buf + funds + sum(xs), 2), debt_left=round(sum(bal), 2)))
    base = [minimums_only(d) for d in debts]
    never = any(m is None for m, _ in base)
    return dict(
        payoff_order=names,
        debt_free_date=rows[-1]['date'] if rows and rows[-1]['debt_left'] <= 0.005 else None,
        paydays_to_debt_free=len(rows) if rows and rows[-1]['debt_left'] <= 0.005 else None,
        total_interest=round(total_interest, 2),
        paid_off_dates=paid_off,
        minimums_only=dict(never_ends=never,
                           months=None if never else max(m for m, _ in base),
                           total_interest=None if never else round(sum(i for _, i in base), 2)),
        first_paydays=rows[:6])

if __name__ == '__main__':
    fx = json.load(open(sys.argv[1]))
    for f in fx:
        got = simulate(f['input'])
        ok = json.dumps(got, sort_keys=True) == json.dumps(f['expected'], sort_keys=True)
        print(('PASS ' if ok else 'FAIL ') + f['name'])
