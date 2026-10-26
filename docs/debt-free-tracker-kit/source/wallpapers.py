"""Render 4 phone wallpapers (1170x2532, iPhone size, works on Android too)."""
import sys, pathlib
from playwright.sync_api import sync_playwright
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)

BASE = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Caveat:wght@700&family=Inter:wght@600&display=swap" rel="stylesheet">
<style>
body{margin:0;width:1170px;height:2532px;overflow:hidden;font-family:Inter,sans-serif}
.w{width:1170px;height:2532px;box-sizing:border-box;padding:0 110px 300px;display:flex;flex-direction:column;justify-content:flex-end;gap:60px}
.head{font-family:'Bricolage Grotesque','Inter Display',Inter,sans-serif;font-weight:800;font-size:140px;line-height:1.14;letter-spacing:-3px}
.hand{font-family:Caveat,Lora,serif;font-weight:700;font-size:96px}
.hl{background:#FFE14D;color:#1F2A44;padding:0 18px;border-radius:14px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.logo{font-family:'Bricolage Grotesque','Inter Display',Inter,sans-serif;font-weight:800;font-size:54px}
.logo span{background:#FFE14D;color:#1F2A44;padding:0 10px;border-radius:8px}
.sq{display:grid;grid-template-columns:repeat(7,1fr);gap:22px}
.sq div{aspect-ratio:1;border-radius:22px;border:6px solid currentColor}
.stamp{width:560px;height:560px;border-radius:50%;border:16px solid #1F2A44;display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque','Inter Display',Inter,sans-serif;font-weight:800;font-size:150px;letter-spacing:12px;transform:rotate(-8deg);background:#FFE14D;color:#1F2A44;align-self:center}
</style></head><body>"""

walls = {
 "01-light-one-paycheck": """<div class="w" style="background:#F4F0E6;color:#1F2A44">
   <div class="sq"><div style="background:#FFE14D"></div><div style="background:#FFE14D"></div><div style="background:#FFE14D"></div><div></div><div></div><div></div><div></div></div>
   <div class="head">One paycheck<br>at a <span class="hl">time.</span></div>
   <div class="logo">paid in <span>yellow</span></div></div>""",
 "02-dark-ten-minutes": """<div class="w" style="background:#1F2A44;color:#F4F0E6">
   <div class="head">Ten minutes,<br>every <span class="hl">payday.</span></div>
   <div class="hand" style="color:#F4F0E6;opacity:.85">open the plan, pay, tap I did it</div>
   <div class="logo">paid in <span>yellow</span></div></div>""",
 "03-light-one-down": """<div class="w" style="background:#F4F0E6;color:#1F2A44;gap:90px">
   <div class="stamp">PAID</div>
   <div class="head" style="text-align:center">One down.</div>
   <div class="hand" style="text-align:center;color:#5C5A55">keep going, one paycheck at a time</div></div>""",
 "04-dark-never-miss-twice": """<div class="w" style="background:#1F2A44;color:#F4F0E6">
   <div class="sq" style="color:#F4F0E6"><div style="background:#FFE14D;border-color:#FFE14D"></div><div style="background:#FFE14D;border-color:#FFE14D"></div><div style="opacity:.5"></div><div style="background:#FFE14D;border-color:#FFE14D"></div><div></div><div></div><div></div></div>
   <div class="head">Life happens.<br>Never miss <span class="hl">twice.</span></div>
   <div class="logo">paid in <span>yellow</span></div></div>""",
}
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1170, "height": 2532})
    for name, body in walls.items():
        pg.set_content(BASE + body + "</body></html>", wait_until="load")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(out / f"wallpaper-{name}.png"))
    b.close()
print("done")
