import base64, re, os
from pathlib import Path
K = str(Path(__file__).resolve().parent.parent)  # docs/design/brand-kit

def raw(p):
    s = open(os.path.join(K, p)).read().strip()
    return re.sub(r' width="[\d.]+" height="[\d.]+"', '', s, count=1)

def themed(p):
    s = raw(p)
    for a, b in (("#2DD4BF", "var(--m1)"), ("#0D9488", "var(--m2)"), ("#115E59", "var(--m3)"), ("#1C1917", "var(--fg)")):
        s = s.replace(f'"{a}"', f'"{b}"')
    return s

def b64(p):
    return "data:image/png;base64," + base64.b64encode(open(os.path.join(K, p), "rb").read()).decode()

# construction diagram (96 grid, drawn with padding for labels)
cells = [(2,0),(2,1),(2,2),(1,1),(1,2),(0,2)]
ghost = [(0,0),(0,1),(1,0)]
cons = []
for r, c in ghost:
    cons.append(f'<rect x="{c*30}" y="{r*30}" width="24" height="24" rx="4.36" fill="none" stroke="var(--border-strong)" stroke-dasharray="3 3" stroke-width="1"/>')
fills = ["var(--m1)", "var(--m2)", "var(--m3)"]
for r, c in cells:
    cons.append(f'<rect x="{c*30}" y="{r*30}" width="24" height="24" rx="4.36" fill="{fills[c]}"/>')
construction = f'''<svg viewBox="-34 -30 160 150" role="img" aria-label="Construction: a 3 by 3 grid of 24 unit cells with 6 unit gaps; six cells are filled as a staircase">
<g font-family="JetBrains Mono, ui-monospace, monospace" font-size="7" fill="var(--subtle)">
<line x1="0" y1="-12" x2="24" y2="-12" stroke="var(--subtle)" stroke-width=".75"/><text x="12" y="-16" text-anchor="middle">24</text>
<line x1="24" y1="-12" x2="30" y2="-12" stroke="var(--primary)" stroke-width=".75"/><text x="27" y="-22" text-anchor="middle" fill="var(--primary)">6</text>
<line x1="-12" y1="0" x2="-12" y2="84" stroke="var(--subtle)" stroke-width=".75"/><text x="-16" y="45" text-anchor="end">84</text>
<text x="42" y="108" text-anchor="middle">cell : gap = 4 : 1 · r = 18 %</text>
</g>{"".join(cons)}</svg>'''

day_labels = ["Ngày 1", "Ngày 2", "Ngày 3"]

html = f'''<title>Học Đều Logo Kit</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root {{
  --bg:#FAFAF9; --surface:#FFFFFF; --muted-s:#F5F5F4; --sunken:#F0EFED;
  --fg:#1C1917; --muted:#57534E; --subtle:#6B645F; --border:#E7E5E4; --border-strong:#8A847F;
  --primary:#0F766E; --primary-soft:#F0FDFA; --primary-soft-fg:#115E59;
  --m1:#2DD4BF; --m2:#0D9488; --m3:#115E59;
  --sans:"Be Vietnam Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono:"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  color-scheme: dark;
  --bg:#0C0A09; --surface:#1C1917; --muted-s:#292524; --sunken:#151312;
  --fg:#FAFAF9; --muted:#A8A29E; --subtle:#9A938E; --border:#3A3532; --border-strong:#78716C;
  --primary:#2DD4BF; --primary-soft:#0F2E2B; --primary-soft-fg:#99F6E4;
  --m1:#0D9488; --m2:#2DD4BF; --m3:#CCFBF1; }} }}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --bg:#0C0A09; --surface:#1C1917; --muted-s:#292524; --sunken:#151312;
  --fg:#FAFAF9; --muted:#A8A29E; --subtle:#9A938E; --border:#3A3532; --border-strong:#78716C;
  --primary:#2DD4BF; --primary-soft:#0F2E2B; --primary-soft-fg:#99F6E4;
  --m1:#0D9488; --m2:#2DD4BF; --m3:#CCFBF1; }}
* {{ box-sizing:border-box; }}
body {{ background:var(--bg); color:var(--fg); font:400 16px/1.65 var(--sans); padding-inline:16px; padding-block:0 64px; }}
.wrap {{ max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:72px; }}
h1,h2,h3 {{ text-wrap:balance; margin:0; }}
h2 {{ font-size:24px; line-height:1.35; font-weight:600; }}
h3 {{ font-size:16px; line-height:1.5; font-weight:600; }}
p {{ margin:0; max-width:62ch; }}
.muted {{ color:var(--muted); }}
.label {{ font-size:13px; line-height:1.5; font-weight:500; color:var(--subtle); }}
.mono {{ font-family:var(--mono); font-size:13px; }}
section {{ display:flex; flex-direction:column; gap:24px; }}
.sec-head {{ display:flex; flex-direction:column; gap:6px; padding-top:20px; border-top:1px solid var(--border); }}

header.hero {{ padding-top:56px; display:flex; flex-direction:column; gap:28px; }}
.hero .lock {{ width:min(520px,100%); }}
.hero .lock svg {{ width:100%; height:auto; display:block; }}
.meta {{ display:flex; flex-wrap:wrap; gap:8px 20px; }}

.concept {{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.1fr); gap:32px; align-items:center; }}
.concept .diagram {{ background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:24px; }}
.concept .diagram svg {{ width:100%; max-width:340px; display:block; margin:0 auto; }}
.points {{ display:flex; flex-direction:column; gap:18px; margin:0; padding:0; list-style:none; }}
.points li {{ display:grid; grid-template-columns:28px 1fr; gap:14px; align-items:start; }}
.chip {{ width:28px; height:28px; border-radius:7px; margin-top:2px; }}

.tiles {{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }}
.tile {{ display:flex; flex-direction:column; gap:10px; }}
.tile .art {{ aspect-ratio:4/3; border-radius:12px; display:grid; place-items:center; border:1px solid var(--border); max-width:100%; }}
.tile .art svg, .tile .art img {{ width:38%; height:auto; display:block; }}
.tile .art.wide svg {{ width:78%; }}
.tile .cap {{ display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; }}
.on-light {{ background:#FAFAF9; }} .on-dark {{ background:#0C0A09; border-color:#3A3532 !important; }}
.on-teal {{ background:#0F766E; border-color:#0F766E !important; }} .on-deep {{ background:#042F2E; border-color:#042F2E !important; }} .on-white {{ background:#FFFFFF; }}
.fav-row {{ display:flex; align-items:flex-end; gap:22px; }}
.fav-row figure {{ margin:0; display:flex; flex-direction:column; align-items:center; gap:6px; }}
.fav-row img {{ image-rendering:pixelated; }}

.lockups {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }}
.lockups .art {{ aspect-ratio:auto; padding:40px 32px; }}
.lockups .art svg {{ width:100%; max-width:380px; }}
.lockups .stack svg {{ width:62%; max-width:220px; }}

.swatches {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; }}
.ramp {{ display:flex; flex-direction:column; gap:10px; }}
.ramp .bar {{ display:grid; grid-template-columns:repeat(3,1fr); border-radius:12px; overflow:hidden; border:1px solid var(--border); }}
.sw {{ padding:14px 14px 12px; min-height:112px; display:flex; flex-direction:column; justify-content:flex-end; gap:2px; border:0; font:inherit; text-align:left; cursor:pointer; }}
.sw:focus-visible {{ outline:2px solid var(--primary); outline-offset:-4px; }}
.sw .n {{ font-size:13px; font-weight:600; }} .sw .h {{ font-family:var(--mono); font-size:12px; }}
.neutral {{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }}
.neutral .sw {{ min-height:80px; border-radius:8px; border:1px solid var(--border); }}
.copied {{ font-size:13px; color:var(--primary); min-height:20px; }}

.type {{ display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr); gap:16px; }}
.card {{ background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:24px; display:flex; flex-direction:column; gap:12px; }}
.spec-big {{ font-size:clamp(44px,8vw,76px); line-height:1.25; font-weight:700; }}
.spec-glyphs {{ font-size:28px; line-height:1.5; font-weight:500; letter-spacing:.02em; color:var(--muted); }}
.spec-mono {{ font-family:var(--mono); font-size:22px; line-height:1.5; }}

.context {{ display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr); gap:16px; align-items:start; }}
.og img {{ width:100%; border-radius:12px; border:1px solid var(--border); display:block; }}
.stackc {{ display:flex; flex-direction:column; gap:16px; }}
.tab {{ background:var(--muted-s); border:1px solid var(--border); border-radius:12px; padding:10px 10px 0; }}
.tab .t {{ background:var(--surface); border-radius:8px 8px 0 0; padding:9px 12px; display:flex; align-items:center; gap:8px; font-size:13px; width:fit-content; max-width:100%; }}
.tab .t img {{ width:16px; height:16px; }}
.side {{ background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:4px; }}
.side .brand {{ display:flex; align-items:center; gap:10px; font-weight:600; font-size:18px; padding:4px 8px 12px; }}
.side .brand svg {{ width:26px; height:26px; }}
.nav {{ display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:8px; font-size:14px; color:var(--muted); }}
.nav.cur {{ background:var(--primary-soft); color:var(--primary-soft-fg); font-weight:600; box-shadow:inset 4px 0 0 var(--primary); }}
.dot {{ width:8px; height:8px; border-radius:2px; background:currentColor; opacity:.7; }}

.rules {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }}
.rules ul {{ margin:0; padding-left:18px; display:flex; flex-direction:column; gap:8px; }}
.clear {{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; }}
.clear svg {{ width:100%; max-width:300px; display:block; margin:0 auto; }}

.files {{ overflow-x:auto; border:1px solid var(--border); border-radius:12px; background:var(--surface); }}
table {{ border-collapse:collapse; width:100%; font-size:14px; }}
th, td {{ text-align:left; padding:10px 14px; border-bottom:1px solid var(--border); vertical-align:top; }}
th {{ font-weight:600; font-size:13px; color:var(--muted); }}
tr:last-child td {{ border-bottom:0; }}
td.mono {{ white-space:nowrap; }}
@media (max-width:760px) {{
  .concept, .type, .context, .rules, .clear, .swatches, .lockups {{ grid-template-columns:1fr; }}
  .tiles {{ grid-template-columns:repeat(2,minmax(0,1fr)); }}
  .neutral {{ grid-template-columns:repeat(2,minmax(0,1fr)); }}
  .wrap {{ gap:56px; }}
}}
@media (prefers-reduced-motion: no-preference) {{
  .hero .lock rect {{ animation:rise .5s cubic-bezier(.05,.7,.1,1) both; }}
  .hero .lock rect:nth-of-type(2){{animation-delay:.06s}} .hero .lock rect:nth-of-type(3){{animation-delay:.12s}}
  .hero .lock rect:nth-of-type(4){{animation-delay:.18s}} .hero .lock rect:nth-of-type(5){{animation-delay:.24s}}
  .hero .lock rect:nth-of-type(6){{animation-delay:.3s}}
  @keyframes rise {{ from {{ opacity:.35; transform:translateY(6px); }} to {{ opacity:1; transform:none; }} }}
}}
</style>

<div class="wrap">
<header class="hero">
  <div class="lock" role="img" aria-label="Học Đều logo">{themed("svg/lockup/hoc-deu-lockup-horizontal.svg")}</div>
  <p style="font-size:18px;line-height:1.6">Mỗi ngày một chút, AI giúp bạn tiến đều. The logo kit for the Học Đều learning platform, built from its own design system.</p>
  <div class="meta"><span class="label">Version 2 · 26/09/2026</span><span class="label">Be Vietnam Pro 600 · heat-1 → heat-3</span><span class="label">SVG + PNG + ICO</span></div>
</header>

<section>
  <div class="sec-head"><h2>The idea</h2><p class="muted">Six calendar-heatmap cells arranged as an even staircase.</p></div>
  <div class="concept">
    <div class="diagram">{construction}</div>
    <ul class="points">
      <li><span class="chip" style="background:var(--m1)"></span><div><h3>One cell, one study day</h3><p class="muted">The cell is the same rounded square the progress page uses for each day in the heatmap. A logged day is a filled cell.</p></div></li>
      <li><span class="chip" style="background:var(--m2)"></span><div><h3>Every step the same height</h3><p class="muted">"Đều" means steady. The climb is made of equal steps, never a jump, which mirrors a plan that only moves forward on days you study.</p></div></li>
      <li><span class="chip" style="background:var(--m3)"></span><div><h3>Deeper with more practice</h3><p class="muted">The cells use the heatmap's own tokens, <code class="mono">heat-1</code> to <code class="mono">heat-3</code>: light teal for a short session, deep teal for a long one. In dark mode they become <code class="mono">heat-2</code> to <code class="mono">heat-4</code> and get lighter.</p></div></li>
    </ul>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Mark and icon</h2><p class="muted">Use the colour mark by default. Use the one-colour versions when the background is busy or printing is limited to one ink.</p></div>
  <div class="tiles">
    <div class="tile"><div class="art on-light">{raw("svg/mark/hoc-deu-mark.svg")}</div><div class="cap"><span class="label">Colour, light background</span><span class="mono muted">mark.svg</span></div></div>
    <div class="tile"><div class="art on-dark">{raw("svg/mark/hoc-deu-mark-on-dark.svg")}</div><div class="cap"><span class="label">Colour, dark background</span><span class="mono muted">mark-on-dark.svg</span></div></div>
    <div class="tile"><div class="art on-deep"><img src="{b64("png/icon-512.png")}" alt="App icon" style="width:50%"></div><div class="cap"><span class="label">App icon</span><span class="mono muted">app-icon.svg</span></div></div>
    <div class="tile"><div class="art on-white">{raw("svg/mark/hoc-deu-mark-mono-black.svg")}</div><div class="cap"><span class="label">One colour, black</span><span class="mono muted">mark-mono-black.svg</span></div></div>
    <div class="tile"><div class="art on-teal">{raw("svg/mark/hoc-deu-mark-mono-white.svg")}</div><div class="cap"><span class="label">One colour, white on teal</span><span class="mono muted">mark-mono-white.svg</span></div></div>
    <div class="tile"><div class="art on-light"><div class="fav-row">
      <figure><img src="{b64("png/favicon-16.png")}" width="16" height="16" alt="16 px favicon"><span class="mono muted">16</span></figure>
      <figure><img src="{b64("png/favicon-32.png")}" width="32" height="32" alt="32 px favicon"><span class="mono muted">32</span></figure>
      <figure><img src="{b64("png/favicon-48.png")}" width="48" height="48" alt="48 px favicon"><span class="mono muted">48</span></figure>
    </div></div><div class="cap"><span class="label">Favicon at real size</span><span class="mono muted">favicon.ico</span></div></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Lockups</h2><p class="muted">The mark sits on the baseline and rises to the height of the stacked diacritics in "Đều". The gap between mark and word is fixed.</p></div>
  <div class="lockups">
    <div class="tile"><div class="art on-light">{raw("svg/lockup/hoc-deu-lockup-horizontal.svg")}</div><span class="label">Horizontal, light</span></div>
    <div class="tile"><div class="art on-dark">{raw("svg/lockup/hoc-deu-lockup-horizontal-on-dark.svg")}</div><span class="label">Horizontal, dark</span></div>
    <div class="tile"><div class="art on-light stack">{raw("svg/lockup/hoc-deu-lockup-stacked.svg")}</div><span class="label">Stacked, light</span></div>
    <div class="tile"><div class="art on-dark stack">{raw("svg/lockup/hoc-deu-lockup-stacked-on-dark.svg")}</div><span class="label">Stacked, dark</span></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Colour</h2><p class="muted">These are the design system's own tokens; the logo adds no new colours. Click a swatch to copy its hex.</p></div>
  <div class="swatches">
    <div class="ramp"><span class="label">Mark ramp, light theme</span><div class="bar">
      <button class="sw" data-hex="#2DD4BF" style="background:#2DD4BF;color:#042F2E"><span class="n">Cell 1 · heat-1</span><span class="h">#2DD4BF</span></button>
      <button class="sw" data-hex="#0D9488" style="background:#0D9488;color:#FFFFFF"><span class="n">Cell 2 · heat-2</span><span class="h">#0D9488</span></button>
      <button class="sw" data-hex="#115E59" style="background:#115E59;color:#FFFFFF"><span class="n">Cell 3 · heat-3</span><span class="h">#115E59</span></button></div></div>
    <div class="ramp"><span class="label">Mark ramp, dark theme</span><div class="bar">
      <button class="sw" data-hex="#0D9488" style="background:#0D9488;color:#FFFFFF"><span class="n">Cell 1 · heat-2</span><span class="h">#0D9488</span></button>
      <button class="sw" data-hex="#2DD4BF" style="background:#2DD4BF;color:#042F2E"><span class="n">Cell 2 · heat-3</span><span class="h">#2DD4BF</span></button>
      <button class="sw" data-hex="#CCFBF1" style="background:#CCFBF1;color:#042F2E"><span class="n">Cell 3 · heat-4</span><span class="h">#CCFBF1</span></button></div></div>
  </div>
  <div class="neutral">
    <button class="sw" data-hex="#1C1917" style="background:#1C1917;color:#FAFAF9"><span class="n">Wordmark · foreground</span><span class="h">#1C1917</span></button>
    <button class="sw" data-hex="#FAFAF9" style="background:#FAFAF9;color:#1C1917"><span class="n">Wordmark, dark · foreground</span><span class="h">#FAFAF9</span></button>
    <button class="sw" data-hex="#0C0A09" style="background:#0C0A09;color:#FAFAF9"><span class="n">Dark · background</span><span class="h">#0C0A09</span></button>
    <button class="sw" data-hex="#042F2E" style="background:#042F2E;color:#CCFBF1"><span class="n">Icon tile · heat-4</span><span class="h">#042F2E</span></button>
  </div>
  <div class="copied" id="copied" aria-live="polite"></div>
</section>

<section>
  <div class="sec-head"><h2>Type</h2><p class="muted">The wordmark is Be Vietnam Pro SemiBold, the same weight as the app's header and sidebar wordmark, outlined so it renders the same everywhere. Tracking stays at zero so the diacritics never touch.</p></div>
  <div class="type">
    <div class="card"><span class="label">Be Vietnam Pro · 600 · wordmark</span><div class="spec-big" style="font-weight:600">Học Đều</div><div class="spec-glyphs">ế ộ ữ Ặ ẫ ỡ Đ đ</div></div>
    <div class="card"><span class="label">JetBrains Mono · numbers and code</span><div class="spec-mono">12,4 tuần<br>45 phút<br>O0 l1 {{ }}</div></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>In use</h2><p class="muted">Link preview, browser tab and the app sidebar, with the active-page style from the design system.</p></div>
  <div class="context">
    <div class="og"><img src="{b64("png/og-image.png")}" alt="Open Graph image: Học Đều logo, tagline and a study heatmap"><span class="label" style="display:block;margin-top:8px">og-image.png · 1200 × 630</span></div>
    <div class="stackc">
      <div class="tab"><div class="t"><img src="{b64("png/favicon-32.png")}" alt="">Hôm nay · Học Đều</div></div>
      <div class="side">
        <div class="brand">{themed("svg/mark/hoc-deu-mark.svg")}<span>Học Đều</span></div>
        <div class="nav cur"><span class="dot"></span>Hôm nay</div>
        <div class="nav"><span class="dot"></span>Ôn tập</div>
        <div class="nav"><span class="dot"></span>Lộ trình</div>
        <div class="nav"><span class="dot"></span>Tiến độ</div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Space and size</h2></div>
  <div class="clear">
    <div class="card"><span class="label">Clear space: one cell on every side</span>
      <svg viewBox="-36 -36 156 156" aria-label="Clear space diagram">
        <rect x="-30" y="-30" width="144" height="144" rx="8" fill="none" stroke="var(--primary)" stroke-dasharray="4 4" stroke-width="1"/>
        <path fill-rule="evenodd" d="M-30 -30H114V114H-30Z M0 0V84H84V0Z" fill="var(--primary)" fill-opacity=".08"/><rect x="0" y="0" width="84" height="84" fill="none" stroke="var(--border-strong)" stroke-width=".75" stroke-dasharray="2 3"/>
        {"".join(f'<rect x="{c*30}" y="{r*30}" width="24" height="24" rx="4.36" fill="{fills[c]}"/>' for r,c in cells)}
        <text x="-15" y="45" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" fill="var(--primary)">1×</text>
      </svg></div>
    <div class="card"><span class="label">Minimum size</span>
      <div style="display:flex;align-items:flex-end;gap:28px;flex-wrap:wrap;padding-top:12px">
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start"><div style="width:16px">{themed("svg/mark/hoc-deu-mark.svg")}</div><span class="mono muted">Mark 16 px</span></div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start"><div style="width:96px">{themed("svg/lockup/hoc-deu-lockup-horizontal.svg")}</div><span class="mono muted">Lockup 96 px wide</span></div>
      </div>
      <p class="muted" style="font-size:14px">Below these sizes use the app icon or the mark alone.</p></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Rules</h2></div>
  <div class="rules">
    <div class="card"><h3>Do</h3><ul class="muted">
      <li>Use the heat ramp, one flat colour, or white on teal.</li>
      <li>Swap to the dark-ramp version on dark backgrounds.</li>
      <li>Keep the cell order: light at the bottom left, deepest at the top right.</li>
      <li>Keep one cell of clear space.</li></ul></div>
    <div class="card"><h3>Don't</h3><ul class="muted">
      <li>Recolour the mark with track colours (indigo, orange and so on). They belong to tracks.</li>
      <li>Rotate, mirror or reorder the cells.</li>
      <li>Add gradients, shadows or glow.</li>
      <li>Set the wordmark in capitals or tighten its letter spacing.</li></ul></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Design-system check</h2><p class="muted">Every value in the kit maps to a token in <code class="mono">tokens.css</code> or a size already used by the heatmap.</p></div>
  <div class="files"><table>
    <thead><tr><th>Element</th><th>Kit value</th><th>Source in the design system</th></tr></thead>
    <tbody>
      <tr><td>Mark cells, light</td><td class="mono">#2DD4BF #0D9488 #115E59</td><td><span class="mono">heat-1 · heat-2 · heat-3</span> (light)</td></tr>
      <tr><td>Mark cells, dark</td><td class="mono">#0D9488 #2DD4BF #CCFBF1</td><td><span class="mono">heat-2 · heat-3 · heat-4</span> (dark); dark heat-1 is skipped because it is 2.1:1 on the dark background</td></tr>
      <tr><td>Wordmark</td><td class="mono">#1C1917 / #FAFAF9</td><td><span class="mono">foreground</span></td></tr>
      <tr><td>Wordmark weight</td><td class="mono">600</td><td>Header and sidebar wordmark: <span class="mono">text-lg font-semibold</span></td></tr>
      <tr><td>Cell : gap</td><td class="mono">24 : 6</td><td>Year-view heatmap: 12 px cells, 3 px gaps</td></tr>
      <tr><td>Cell corner</td><td class="mono">18 %</td><td>Month-view day cell: <span class="mono">rounded-md</span> (8 px) on 44 px</td></tr>
      <tr><td>App icon tile</td><td class="mono">#042F2E</td><td><span class="mono">heat-4</span> (light), with the dark ramp on top</td></tr>
      <tr><td>Font files</td><td class="mono">be-vietnam-pro-600.woff2</td><td>Outlined from <span class="mono">app/fonts/</span>, the app's own subset</td></tr>
    </tbody></table></div>
  <p class="muted" style="font-size:14px">Light cell 1 is 1.8:1 on the page background. Logos are exempt from WCAG 1.4.11, and the steps still read because cells 2 and 3 carry the shape; use the one-colour mark where that matters. Full numbers are in <span class="mono">contrast.md</span>.</p>
</section>

<section>
  <div class="sec-head"><h2>Files for the app</h2><p class="muted">Next.js picks these up by name. Copy them from the kit into the repo.</p></div>
  <div class="files"><table>
    <thead><tr><th>Put it at</th><th>From the kit</th><th>Used for</th></tr></thead>
    <tbody>
      <tr><td class="mono">app/icon.svg</td><td class="mono">svg/app-icon/favicon.svg</td><td>Browser tab icon</td></tr>
      <tr><td class="mono">app/favicon.ico</td><td class="mono">png/favicon.ico</td><td>Fallback for older browsers</td></tr>
      <tr><td class="mono">app/apple-icon.png</td><td class="mono">png/apple-touch-icon.png</td><td>iOS home screen</td></tr>
      <tr><td class="mono">app/opengraph-image.png</td><td class="mono">png/og-image.png</td><td>Link previews</td></tr>
      <tr><td class="mono">public/icon-192.png, icon-512.png</td><td class="mono">png/</td><td>Web app manifest</td></tr>
      <tr><td class="mono">public/icon-maskable-512.png</td><td class="mono">png/</td><td>Android adaptive icon</td></tr>
    </tbody></table></div>
</section>
</div>

<script>
document.querySelectorAll('.sw').forEach(function (b) {{
  b.addEventListener('click', function () {{
    var hex = b.getAttribute('data-hex'), out = document.getElementById('copied');
    var done = function () {{ out.textContent = 'Copied ' + hex; }};
    try {{ navigator.clipboard.writeText(hex).then(done, function () {{ out.textContent = hex + ' (copy it from here)'; }}); }}
    catch (e) {{ out.textContent = hex + ' (copy it from here)'; }}
  }});
}});
</script>
'''
open(os.path.join(K, "_source", "preview.fragment.html"), "w").write(html)
open(os.path.join(K, "preview.html"), "w").write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + "</body></html>")
print(len(html))
