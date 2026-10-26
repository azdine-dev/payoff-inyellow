"""Fill a scenario into the built workbook, recalc in LibreOffice, compare with engine_v2."""
import sys, json, subprocess, datetime as dt, openpyxl
sys.path.insert(0, ".")
from engine_v2 import simulate

FREQ = {"weekly": "Every week", "biweekly": "Every 2 weeks", "twice": "Twice a month", "monthly": "Every month"}
METH = {"piy": "PaidInYellow order", "avalanche": "Biggest interest first", "custom": "My own order"}
R1 = 9

def run(name, s):
    wb = openpyxl.load_workbook("test.xlsx")
    su, de, pl = wb["Setup"], wb["Debts"], wb["Plan"]
    su["C7"] = FREQ[s["freq"]]; su["C8"] = s["first_payday"]; su["C9"] = s.get("second_day")
    su["C11"] = s["money"]; su["C13"] = s.get("buffer", 0); su["C14"] = s["goal"]; su["C16"] = METH[s.get("method", "piy")]
    for i in range(10):
        su.cell(21 + i, 2).value = None; su.cell(21 + i, 3).value = None
    for i, y in enumerate(s.get("yearly", [])):
        su.cell(21 + i, 2).value = f"bill {i}"; su.cell(21 + i, 3).value = y
    for i in range(50):
        for c in range(2, 9): de.cell(6 + i, c).value = None
    for i, d in enumerate(s["debts"]):
        de.cell(6 + i, 2).value = d["name"]; de.cell(6 + i, 4).value = d["balance"]; de.cell(6 + i, 5).value = d["apr"]
        de.cell(6 + i, 6).value = d["min"]; de.cell(6 + i, 7).value = d.get("due"); de.cell(6 + i, 8).value = d.get("my_order")
    for key, col in (("adjust", 5), ("charges", 6), ("buffer_used", 7), ("yearly_paid", 8)):
        for k, v in s.get(key, {}).items(): pl.cell(R1 + k, col).value = v
    fn = f"run_{name}.xlsx"; wb.save(fn)
    out = subprocess.run(["python3", "/mnt/skills/public/xlsx/scripts/recalc.py", fn, "600"], capture_output=True, text=True).stdout
    st = json.loads(out)
    v = openpyxl.load_workbook(fn, data_only=True)
    pg, plv, tp = v["Progress"], v["Plan"], v["This payday"]
    ref = simulate(s)
    sheet_free = pg["C4"].value
    if isinstance(sheet_free, dt.datetime): sheet_free = sheet_free.date()
    interest = pg["C12"].value
    worst = 0.0
    for r in ref["rows"]:
        rr = R1 + r["k"]
        for col, keyv in ((14, "bills"), (17, "extra"), (20, "owed"), (18, "total_move"), (12, "buffer_after")):
            worst = max(worst, abs((plv.cell(rr, col).value or 0) - r[keyv]))
        d = plv.cell(rr, 2).value
        if hasattr(d, "date"): d = d.date()
        if d != r["date"]:
            print("  date mismatch", r["k"], d, r["date"]); break
    ok = (sheet_free == ref["debt_free"]) and abs(interest - ref["interest"]) < 0.02 and worst < 0.01 and st.get("total_errors") == 0
    print(f"{name:12s} {'OK ' if ok else 'FAIL'} free sheet={sheet_free} ref={ref['debt_free']} paydays={ref['paydays']} "
          f"interest sheet={interest:.2f} ref={ref['interest']:.2f} worst_cell_diff={worst:.4f} errors={st.get('total_errors')} "
          f"| this payday: {tp['B6'].value} / {tp['B8'].value}")
    return ok

D = dt.date
scen = {
 "karim": dict(freq="biweekly", first_payday=D(2026,10,30), money=100, buffer=300, goal=500, yearly=[240],
               debts=[dict(name="Card A", balance=500, apr=24, min=25, due=10), dict(name="Card B", balance=1200, apr=18, min=40, due=20)]),
 "sara": dict(freq="biweekly", first_payday=D(2026,10,30), money=150, buffer=200, goal=500, yearly=[260],
              debts=[dict(name="Medical", balance=350, apr=0, min=50, due=12), dict(name="Store Card", balance=600, apr=26.99, min=30, due=5),
                     dict(name="Visa", balance=2400, apr=24.99, min=72, due=20), dict(name="Car loan", balance=7800, apr=7.9, min=260, due=15)]),
 "growing_avalanche": dict(freq="weekly", first_payday=D(2026,11,6), money=60, buffer=500, goal=500, method="avalanche",
              debts=[dict(name="Dept card", balance=1200, apr=29.99, min=25, due=25), dict(name="Visa", balance=900, apr=19.9, min=35, due=3),
                     dict(name="Phone", balance=300, apr=0, min=0, due=None)]),
 "growing_piy": dict(freq="weekly", first_payday=D(2026,11,6), money=60, buffer=500, goal=500,
              debts=[dict(name="Dept card", balance=1200, apr=29.99, min=25, due=25), dict(name="Visa", balance=900, apr=19.9, min=35, due=3),
                     dict(name="Small", balance=150, apr=12, min=15, due=31)]),
 "twice_month": dict(freq="twice", first_payday=D(2026,10,31), money=120, buffer=0, goal=500, yearly=[600, 300],
              debts=[dict(name="A", balance=3000, apr=22.9, min=90, due=28), dict(name="B", balance=800, apr=15, min=30, due=31),
                     dict(name="C", balance=5000, apr=9, min=150, due=1)],
              adjust={2: -50, 5: 80}, charges={3: 120}, buffer_used={6: 150}),
 "monthly_custom": dict(freq="monthly", first_payday=D(2027,1,31), money=300, buffer=100, goal=1000, method="custom",
              debts=[dict(name="Loan", balance=6000, apr=11, min=180, due=5, my_order=2), dict(name="Card", balance=2500, apr=21, min=75, due=28, my_order=1)]),
 "eight_k": dict(freq="monthly", first_payday=D(2026,11,1), money=0, buffer=0, goal=0,
              debts=[dict(name="Card", balance=8000, apr=24, min=240, due=1)]),
}
if __name__ == "__main__":
    names = sys.argv[1:] or list(scen)
    res = [run(n, scen[n]) for n in names]
    print("ALL OK" if all(res) else "SOME FAILED")
