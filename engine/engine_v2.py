"""PaidInYellow payoff engine, v2 ("real bills", the trust fix).

Each payday the balances move by exactly what the user pays:
  * every debt's full monthly minimum is paid on the payday whose window
    [this payday, next payday) contains its due date (so a debt with no due
    date in the window does not go down that payday, apart from interest);
  * the extra goes to the focus debt in payoff order, overflow to the next;
  * a paid-off debt's minimum keeps rolling into the extra on the payday its
    bill would have fallen (rule 1 of CLAUDE.md, unchanged).

Promo (optional, per debt: promo_apr, promo_ends, deferred): until the promo end date the promo rate is used
instead of the normal rate (a payday before the end date uses it, the end date and later use the normal rate).
A debt with a deferred-interest promo goes to the front of the payday order until its end date, so the extra
reaches it first. Nothing is added to the balance when the date passes: simulate() reports in "promo" what
would still be owing on that date and the back interest at risk (the interest the normal rate would have
charged from the first payday to the end date), and the app says so calmly.

Unchanged from v1: paydays per year, payday dates from the schedule (never
"last payday + step"), interest per payday = balance x APR / ppy, yearly bills
then buffer then extra, payoff orders and tie rules, the stored payoff order,
the 520-payday limit, the minimums-only baseline.

The Google Sheet bonus implements exactly this model.
"""
from __future__ import annotations
import calendar, datetime as dt, math

PPY = {"weekly": 52, "biweekly": 26, "twice": 24, "monthly": 12}
LIMIT = 520


def _date(x):
    """A date given as an ISO string, a date, or nothing."""
    if not x: return None
    return x if isinstance(x, dt.date) else dt.date.fromisoformat(x)


def clamp(y: int, m: int, d: int) -> dt.date:
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return dt.date(y, m, min(d, calendar.monthrange(y, m)[1]))


def other_payday(p0: dt.date) -> int:
    """Default second pay day for twice a month: a day up to the 15th pairs
    with day + 15, the last day of the month pairs with the 15th, any other
    day after the 15th pairs with day - 15."""
    day = p0.day
    if day <= 15:
        return day + 15
    if day == calendar.monthrange(p0.year, p0.month)[1]:
        return 15
    return day - 15


def payday(freq: str, p0: dt.date, k: int, second: int | None = None) -> dt.date:
    if freq == "weekly":
        return p0 + dt.timedelta(days=7 * k)
    if freq == "biweekly":
        return p0 + dt.timedelta(days=14 * k)
    if freq == "monthly":
        return clamp(p0.year, p0.month + k, p0.day)
    # twice a month
    s = second if second else other_payday(p0)
    a, b = sorted([p0.day, s])
    h = 0 if p0.day == a else 1
    m, half = divmod(k + h, 2)
    return clamp(p0.year, p0.month + m, [a, b][half])


def due_count(due_day: int, start: dt.date, end: dt.date) -> int:
    """How many due dates (day of month, clamped) fall in [start, end)."""
    n = 0
    for off in (0, 1, 2):
        d = clamp(start.year, start.month + off, due_day)
        if start <= d < end:
            n += 1
    return n


def order(debts: list[dict], method: str) -> list[int]:
    def key(i):
        d = debts[i]
        if method == "avalanche":
            return (-d["apr"], d["balance"], i)
        if method == "custom":
            return (d.get("my_order") or 999, i)
        growing = d["apr"] > 0 and d["min"] <= d["balance"] * d["apr"] / 1200
        return (0, -d["apr"], i) if growing else (1, d["balance"], i)
    return sorted(range(len(debts)), key=key)


def simulate(s: dict) -> dict:
    """s: freq, first_payday, second_day, money, buffer, goal, yearly (list of
    per-year amounts), debts (name, balance, apr %, min, due), method,
    adjust/charges/buffer_used/yearly_paid: dicts payday index -> amount."""
    freq, p0 = s["freq"], s["first_payday"]
    ppy = PPY[freq]
    debts = s["debts"]
    pos = order(debts, s.get("method", "piy"))
    bal = [debts[i]["balance"] for i in pos]
    apr = [debts[i]["apr"] / 100 for i in pos]
    mins = [debts[i]["min"] for i in pos]
    due = [debts[i].get("due") for i in pos]
    promo_apr = [debts[i].get("promo_apr") for i in pos]
    promo_end = [_date(debts[i].get("promo_ends")) for i in pos]
    deferred = [bool(debts[i].get("deferred")) for i in pos]
    owing_at_end = list(bal)
    back_interest = [0.0] * len(bal)
    buf, ysaved = s.get("buffer", 0.0), 0.0
    yearly_pp = sum(s.get("yearly", [])) / ppy
    rows, interest_total = [], 0.0
    for k in range(LIMIT):
        if sum(bal) <= 0.005 and k > 0:
            break
        d0 = payday(freq, p0, k, s.get("second_day"))
        d1 = payday(freq, p0, k + 1, s.get("second_day"))
        avail = s["money"] + s.get("adjust", {}).get(k, 0.0)
        to_yearly = min(yearly_pp, max(avail, 0))
        to_buf = min(max(s["goal"] - buf, 0), max(avail - to_yearly, 0))
        buf += to_buf - s.get("buffer_used", {}).get(k, 0.0)
        ysaved += to_yearly - s.get("yearly_paid", {}).get(k, 0.0)
        # charge goes to the first debt in order that still has a balance
        chg = s.get("charges", {}).get(k, 0.0)
        cpos = next((j for j, b in enumerate(bal) if b > 0.005), 0)
        pre, due_min, bill = [], [], []
        promo_on = [promo_apr[j] is not None and promo_end[j] is not None and d0 < promo_end[j] for j in range(len(bal))]
        rate = [promo_apr[j] / 100 if promo_on[j] else apr[j] for j in range(len(bal))]
        # a deferred-interest promo goes first until its end date; the others keep their place
        front = [deferred[j] and promo_on[j] and bal[j] > 0.005 for j in range(len(bal))]
        prio = sorted(range(len(bal)), key=lambda j: (not front[j], j))
        for j in range(len(bal)):
            b = bal[j] * (1 + rate[j] / ppy) + (chg if j == cpos else 0.0)
            interest_total += bal[j] * rate[j] / ppy
            if promo_on[j]:
                back_interest[j] += bal[j] * (apr[j] - rate[j]) / ppy
            dm = mins[j] * due_count(due[j], d0, d1) if (due[j] and mins[j]) else 0.0
            pre.append(b); due_min.append(dm); bill.append(min(dm, b))
        rollover = sum(due_min) - sum(bill)
        pool = max(avail - to_yearly - to_buf, 0) + rollover
        extra, used = [0.0] * len(bal), 0.0
        for j in prio:
            x = min(max(pre[j] - bill[j], 0), max(pool - used, 0))
            extra[j] = x; used += x
        bal = [max(pre[j] - bill[j] - extra[j], 0.0) for j in range(len(bal))]
        bal = [0.0 if b < 0.005 else b for b in bal]
        for j in range(len(bal)):
            if promo_on[j]:
                owing_at_end[j] = bal[j]
        rows.append({"k": k, "date": d0, "bills": sum(bill), "extra": used,
                     "yearly": to_yearly, "buffer": to_buf, "buffer_after": buf,
                     "total_move": sum(bill) + used + to_yearly + to_buf,
                     "owed": sum(bal), "bal": list(bal), "bill_by_pos": bill,
                     "extra_by_pos": extra})
    free = next((r for r in rows if r["owed"] <= 0.005), None)
    return {"order": [debts[i]["name"] for i in pos], "rows": rows,
            "debt_free": free["date"] if free else None,
            "paydays": (free["k"] + 1) if free else None,
            "interest": round(interest_total, 2),
            "promo": [{"name": debts[pos[j]]["name"], "ends": promo_end[j].isoformat(),
                       "owing": round(owing_at_end[j], 2), "back_interest": round(back_interest[j], 2)}
                      for j in range(len(bal))
                      if deferred[j] and promo_end[j] and promo_end[j] > p0 and owing_at_end[j] > 0.005]}


if __name__ == "__main__":
    karim = dict(freq="biweekly", first_payday=dt.date(2026, 10, 30), money=100,
                 buffer=300, goal=500, yearly=[],
                 debts=[dict(name="Card A", balance=500, apr=24, min=25, due=10),
                        dict(name="Card B", balance=1200, apr=18, min=40, due=20)])
    r = simulate(karim)
    print(r["order"], r["debt_free"], r["paydays"], r["interest"])
    for row in r["rows"][:4]:
        print(row["date"], round(row["bills"], 2), round(row["extra"], 2),
              round(row["total_move"], 2), [round(b, 2) for b in row["bal"]])
