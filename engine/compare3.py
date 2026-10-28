import sys, json, subprocess, datetime as dt, openpyxl
sys.path.insert(0, ".")
from engine_v2 import simulate
from compare import scen, FREQ, METH
R1, D0 = 9, 19
Y0 = D0 + 50 - 1 + 4

def run(name, s, extra=50, paid=0):
    wb = openpyxl.load_workbook("t3.xlsx")
    st, pl, db = wb["Start"], wb["Plan"], wb["Dashboard"]
    st["C8"] = FREQ[s["freq"]]; st["C9"] = s["first_payday"]; st["C10"] = s.get("second_day")
    st["C12"] = s["money"]; st["C13"] = s.get("buffer", 0); st["C14"] = s["goal"]; st["C15"] = METH[s.get("method", "piy")]
    for i in range(10): st.cell(Y0 + i, 2).value = None; st.cell(Y0 + i, 3).value = None
    for i, y in enumerate(s.get("yearly", [])): st.cell(Y0 + i, 2).value = f"bill {i}"; st.cell(Y0 + i, 3).value = y
    for i in range(50):
        for c in range(2, 9): st.cell(D0 + i, c).value = None
    for i, d in enumerate(s["debts"]):
        for c, k in ((2, "name"), (4, "balance"), (5, "apr"), (6, "min"), (7, "due"), (8, "my_order")):
            st.cell(D0 + i, c).value = d.get(k)
    for key, col in (("adjust", 5), ("charges", 6), ("buffer_used", 7), ("yearly_paid", 8)):
        for k, v in s.get(key, {}).items(): pl.cell(R1 + k, col).value = v
    for k in range(paid): pl.cell(R1 + k, 4).value = "✓"
    db["C37"] = extra
    fn = f"r3_{name}.xlsx"; wb.save(fn)
    st_ = json.loads(subprocess.run(["python3", "/mnt/skills/public/xlsx/scripts/recalc.py", fn, "900"], capture_output=True, text=True).stdout)
    v = openpyxl.load_workbook(fn, data_only=True); dv, plv = v["Dashboard"], v["Plan"]
    ref = simulate(s)
    # what-if: extra only on unpaid paydays
    s2 = dict(s); adj = dict(s.get("adjust", {}))
    for k in range(paid, 520): adj[k] = adj.get(k, 0) + extra
    ref2 = simulate(dict(s2, adjust=adj))
    d = lambda x: x.date() if hasattr(x, "date") else x
    worst = 0
    for r in ref["rows"]:
        rr = R1 + r["k"]
        for col, kk in ((14, "bills"), (17, "extra"), (20, "owed"), (18, "total_move")):
            worst = max(worst, abs((plv.cell(rr, col).value or 0) - r[kk]))
    ok = (d(dv["B6"].value) == ref["debt_free"] and d(dv["C38"].value) == ref2["debt_free"] and worst < 0.01
          and abs(dv["C40"].value - (ref["interest"] - ref2["interest"])) < 0.02 and st_.get("total_errors") == 0)
    print(f"{name:18s} {'OK' if ok else 'FAIL'} free={d(dv['B6'].value)}/{ref['debt_free']} whatif={d(dv['C38'].value)}/{ref2['debt_free']} "
          f"saved={dv['C40'].value:.2f}/{ref['interest']-ref2['interest']:.2f} worst={worst:.4f} err={st_.get('total_errors')} | "
          f"{dv['B13'].value} | {dv['F6'].value} | left {dv['D6'].value}")
    return ok

if __name__ == "__main__":
    names = sys.argv[1:] or list(scen)
    res = [run(n, scen[n], paid=(3 if n == "sara" else 0)) for n in names]
    print("ALL OK" if all(res) else "SOME FAILED")
