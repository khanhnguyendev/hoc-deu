"""PROTOTYPE — not product code. Throwaway simulator used to choose §5 parameters of
docs/plans/2026-09-23-platform-design.md. Reproduce the §5.10 tables with:
    python3 docs/plans/assets/2026-09-23-plan-sim.py report
The real, test-enforced simulation is written in TypeScript in M4 (lib/domain).
"""
import random, statistics, sys, itertools, json

# ---------------- DSA content (10w roadmap from the brief) ----------------
E, M, H = 'E', 'M', 'H'
W10 = W = [  # (lessons, core[(id,diff)], recap[(id, diff, mode)])
 (1, [(217,E),(242,E),(1,E),(49,M),(347,M),(238,M),(128,M),(36,M)], [(271,M,'new'),(128,M,'redo'),(49,M,'explain')]),
 (2, [(125,E),(121,E),(167,M),(15,M),(11,M),(3,M),(424,M),(42,H)], [(1,E,'explain'),(567,M,'new'),(347,M,'redo')]),
 (2, [(20,E),(704,E),(155,M),(739,M),(875,M),(153,M),(981,M),(84,H)], [(424,M,'redo'),(150,M,'new'),(238,M,'redo')]),
 (1, [(206,E),(21,E),(141,E),(19,M),(143,M),(2,M),(146,M),(23,H)], [(74,M,'new'),(3,M,'redo'),(138,M,'new')]),
 (1, [(226,E),(104,E),(100,E),(543,E),(102,M),(98,M),(230,M),(124,H)], [(146,M,'redo'),(199,M,'new'),(128,M,'redo')]),
 (1, [(703,E),(1046,E),(973,M),(215,M),(621,M),(355,M),(295,H)], [(347,M,'redo'),(230,M,'redo'),(981,M,'redo')]),
 (1, [(78,M),(39,M),(46,M),(90,M),(40,M),(79,M),(17,M),(51,H)], [(22,M,'new'),(572,E,'new'),(215,M,'redo')]),
 (1, [(200,M),(695,M),(133,M),(994,M),(417,M),(207,M),(210,M),(127,H)], [(79,M,'redo'),(102,M,'redo'),(739,M,'redo')]),
 (1, [(70,E),(198,M),(213,M),(5,M),(91,M),(322,M),(139,M),(300,M)], [(994,M,'redo'),(647,M,'new'),(42,H,'redo')]),
 (3, [(62,M),(1143,M),(56,M),(57,M),(435,M),(253,M),(53,M),(763,M)], [(146,M,'redo'),(295,H,'redo'),(380,M,'new')]),
]

# 8w compressed variant: W4+W5 merged (LL only 206,21,141,146), W6+W7 merged
# (Heap 703,973,215,295->dropped H; BT 78,39,46,79); most Hard/bonus dropped, keep 146, 42, 5.
W8 = [
 (1, [(217,E),(242,E),(1,E),(49,M),(347,M),(238,M),(128,M),(36,M)], [(271,M,'new'),(128,M,'redo'),(49,M,'explain')]),
 (2, [(125,E),(121,E),(167,M),(15,M),(11,M),(3,M),(424,M),(42,H)], [(1,E,'explain'),(347,M,'redo'),(3,M,'redo')]),
 (2, [(20,E),(704,E),(155,M),(739,M),(875,M),(153,M),(981,M)], [(424,M,'redo'),(238,M,'redo'),(739,M,'redo')]),
 (2, [(206,E),(21,E),(141,E),(146,M),(226,E),(104,E),(100,E),(543,E),(102,M),(98,M),(230,M)], [(146,M,'redo'),(128,M,'redo'),(102,M,'redo')]),
 (2, [(703,E),(973,M),(215,M),(78,M),(39,M),(46,M),(79,M)], [(347,M,'redo'),(230,M,'redo'),(981,M,'redo')]),
 (1, [(200,M),(695,M),(133,M),(994,M),(417,M),(207,M),(210,M)], [(79,M,'redo'),(102,M,'redo'),(739,M,'redo')]),
 (1, [(70,E),(198,M),(213,M),(5,M),(91,M),(322,M),(139,M),(300,M)], [(994,M,'redo'),(42,H,'redo'),(5,M,'redo')]),
 (3, [(62,M),(1143,M),(56,M),(57,M),(435,M),(253,M),(53,M),(763,M)], [(146,M,'redo'),(215,M,'redo'),(380,M,'new')]),
]

def dsa_queue():
    q, recaps = [], []
    for wi, (nl, core, recap) in enumerate(W, 1):
        for i in range(nl):
            q.append(dict(id=f'L{wi}.{i}', kind='lesson', diff=None, week=wi, srs=False))
        for pid, d in core:
            q.append(dict(id=f'P{pid}', kind='problem', diff=d, week=wi, srs=True, core=True))
        for pid, d, mode in recap:
            if mode == 'new' and not any(x['id'] == f'P{pid}' for x in q):
                q.append(dict(id=f'P{pid}', kind='problem', diff=d, week=wi, srs=True, core=False))
        recaps.append([(f'P{pid}', mode) for pid, d, mode in recap])
    return q, recaps

# ---------------- English content ----------------
CORE = [12,16,14,14,12,13,16,14,11,13]
def eng_queue(extended_weeks=3, per_week=30):
    q = []
    for wi, c in enumerate(CORE, 1):
        for i in range(c):
            q.append(dict(id=f'C{wi}.{i}', week=wi, tier='core'))
        q.append(dict(id=f'DERIVED@{wi}', week=wi, tier='derived-slot'))  # marker
        if wi <= extended_weeks:
            for i in range(max(0, per_week - c)):
                q.append(dict(id=f'X{wi}.{i}', week=wi, tier='extended'))
    return q

# ---------------- SRS ----------------
def apply_result(st, outcome, day, iv, mastered_after, relearn=None):
    N = len(iv)
    if st is None:
        st = dict(level=0, weak=False, top_successes=0, mastered=False, lapses=0)
    if st.get('last_day') == day:
        return st  # only first result per day counts
    st = dict(st); st['last_day'] = day
    L = st['level']
    if L == 0:
        st['level'] = 1; st['weak'] = outcome == 'fail'
    elif outcome == 'success':
        if L == N:
            st['top_successes'] += 1
            if mastered_after and st['top_successes'] >= mastered_after:
                st['mastered'] = True
        st['level'] = min(L + 1, N); st['weak'] = False
    elif outcome == 'fail':
        st['level'] = 1; st['weak'] = True; st['lapses'] += 1; st['top_successes'] = 0
    st['due'] = day + iv[st['level'] - 1]
    if relearn and outcome == 'fail':
        st['due'] = day + relearn
    return st

# ---------------- learners ----------------
def outcome_fn(profile, rng):
    if profile == 'ideal':
        return lambda: 'success'
    def f():
        r = rng.random()
        return 'success' if r < .8 else ('partial' if r < .9 else 'fail')
    return f

def skip_days(profile, days, rng):
    if profile == 'ideal':
        return set()
    s = set()
    for w in range(0, days, 7):
        s.add(w + rng.randrange(7))
    return s

# ---------------- DSA engine ----------------
def run_dsa(p, profile, seed, days=84, verbose=False):
    rng = random.Random(seed)
    out = outcome_fn(profile, rng)
    skips = skip_days(profile, days, rng)
    queue, recaps = dsa_queue()
    est_new = {E: p['E'], M: p['M'], H: p['H'], None: p['lesson']}
    introduced, state = set(), {}
    recap_done = set()
    last_plan, last_plan_done = None, True
    finish_day, log = None, []
    def week_of_next_core():
        for it in queue:
            if it.get('core') and it['id'] not in introduced:
                return it['week']
        return 11
    def review_cost(it_id):
        st = state[it_id]
        d = next(x['diff'] for x in queue if x['id'] == it_id)
        return round(est_new[d] * p['redo_factor']) if st['weak'] else p['recall']
    def due_list(day):
        ds = [(i, s) for i, s in state.items() if not s['mastered'] and s['due'] <= day]
        ds.sort(key=lambda x: (not x[1]['weak'], x[1]['due'], x[1]['level']))
        return [i for i, _ in ds]
    def fill_new(budget, allow_overshoot, planned):
        items, used = [], 0
        for it in queue:
            if it['id'] in introduced or it['id'] in planned:
                continue
            c = est_new[it['diff']]
            fits = used + c <= budget or (p['half_fit'] and used + c / 2 <= budget)
            if fits or (allow_overshoot and not items):
                items.append((it['id'], c, 'new')); used += c
            else:
                break
        return items, used
    def build(day):
        wd = day % 7  # 0..4 Mon-Fri, 5 Sat, 6 Sun
        B = p['budget']; blocks = []
        wk = week_of_next_core()
        if wd <= 4:
            used = 0
            dl = due_list(day)
            cap = p['weekday_review_cap']
            if any(day - state[i]['due'] > 7 for i in dl):
                cap = max(cap, p['debt_frac'] * B)
            for i in dl:
                c = review_cost(i)
                if used + c > cap:
                    break
                blocks.append((i, c, 'review')); used += c
            new, u2 = fill_new(B - used, True, {b[0] for b in blocks})
            blocks += new
        elif wd == 5:
            used = 0
            for i in due_list(day):
                c = review_cost(i)
                if used + c > B:
                    break
                blocks.append((i, c, 'review')); used += c
            if not blocks:  # empty-block fallback
                new, _ = fill_new(B, True, set()); blocks += new
            else:
                new, _ = fill_new(B - used, False, {b[0] for b in blocks}); blocks += new
        else:
            used = 0
            if wk >= 3 + 0 and p['mock']:
                blocks.append(('MOCK', 45, 'mock')); used += 45
            # recap: latest completed week not yet recapped
            src = None
            for wi in range(len(W), 0, -1):
                if wi < wk and wi not in recap_done:
                    src = wi; break
            picks = []
            if src:
                for iid, mode in recaps[src - 1]:
                    if iid in state:
                        c = review_cost(iid) if mode == 'redo' else p['explain']
                        picks.append((iid, c, 'recap'))
            cand = sorted(state.items(), key=lambda x: (x[1]['level'], x[1].get('last_day', 0)))
            for iid, s in cand:
                if len(picks) >= 3: break
                if not any(iid == q[0] for q in picks):
                    picks.append((iid, p['recall'], 'recap'))
            first = True
            for pk in picks[:3]:
                if used + pk[1] <= B or (first and not any(b[2] == 'recap' for b in blocks)):
                    blocks.append(pk); used += pk[1]
                first = False
            if src: recap_done.add(src)
            if p.get('sunday_spill'):
                new, _ = fill_new(B - used, False, {b[0] for b in blocks}); blocks += new
        return blocks
    def execute(blocks, day):
        for iid, c, kind in blocks:
            if iid == 'MOCK':
                continue
            if iid.startswith('L'):
                introduced.add(iid); continue
            o = out()
            introduced.add(iid)
            state[iid] = apply_result(state.get(iid), o, day, p['iv'], p['mastered_after'], p.get('relearn'))
    max_over, minutes = 0, []
    for day in range(days):
        if day in skips:
            last_plan_done = False
            log.append(dict(day=day, due=len(due_list(day)), mins=0, skipped=True)); continue
        if not last_plan_done and last_plan is not None:
            blocks = last_plan  # resume stale plan (gate closed)
        else:
            blocks = build(day)
        tot = sum(b[1] for b in blocks)
        biggest = max([b[1] for b in blocks] or [0])
        over = tot - p['budget']
        ok = tot <= p['budget'] or tot - biggest <= p['budget']
        minutes.append(tot)
        if not ok: max_over = max(max_over, over)
        execute(blocks, day)
        last_plan, last_plan_done = blocks, True
        log.append(dict(day=day, due=len(due_list(day + 1)), mins=tot, n_new=sum(1 for b in blocks if b[2]=='new'), n_rev=sum(1 for b in blocks if b[2]=='review')))
        if finish_day is None and all(it['id'] in introduced for it in queue):
            finish_day = day
    dues = [l['due'] for l in log]
    snap = {f'w{w}': dues[min(w*7-1, len(dues)-1)] for w in (6, 9, 12, 15, 18)}
    return dict(**snap, finish_week=None if finish_day is None else round((finish_day + 1) / 7, 1),
                max_due=max(dues), end_due=dues[-1], due_w8_12=statistics.mean(dues[56:]) if len(dues) > 56 else None,
                due_w4_8=statistics.mean(dues[28:56]),
                max_minutes=max(minutes), avg_minutes=round(statistics.mean(minutes), 1), budget_violation=max_over,
                weak=sum(1 for s in state.values() if s['weak']), introduced=len(introduced), total=len(queue))

# ---------------- English engine ----------------
def run_eng(p, profile, seed, days=84, dsa_unlock_per_day=None):
    rng = random.Random(seed)
    out = outcome_fn(profile, rng)
    skips = skip_days(profile, days, rng)
    queue = eng_queue()
    introduced, state = set(), {}
    derived_unlocked, derived_intro = 0, 0
    last_plan, last_done = None, True
    log, minutes, max_over = [], [], 0
    def due_list(day):
        ds = [(i, s) for i, s in state.items() if not s['mastered'] and s['due'] <= day]
        ds.sort(key=lambda x: (not x[1]['weak'], x[1]['due'], x[1]['level']))
        return [i for i, _ in ds]
    def new_items(n):
        nonlocal derived_intro
        res = []
        d_avail = derived_unlocked - derived_intro
        for it in queue:
            if len(res) >= n: break
            if it['tier'] == 'derived-slot':
                while d_avail > 0 and len(res) < n:
                    res.append(f'D{derived_intro + len(res)}'); d_avail -= 1
                continue
            if it['id'] not in introduced and it['id'] not in res:
                res.append(it['id'])
        return res
    def build(day):
        wd = day % 7; B = p['budget']; blocks = []
        due = due_list(day)
        n_due = len(due)
        eff = p['new_per_day']
        for thr, n in sorted(p['throttle']):
            if n_due > thr: eff = n
        if wd <= 4:
            reserved = p['exercise'] + p['shadow']
            blocks += [('EX', p['exercise'], 'practice'), ('SH', p['shadow'], 'practice')]
            used = reserved
            for i in due:
                if used + p['review'] > B: break
                blocks.append((i, p['review'], 'review')); used += p['review']
            cap = min(eff, int((B - used) // p['new']))
            for i in new_items(max(cap, 0)):
                blocks.append((i, p['new'], 'new')); used += p['new']
        elif wd == 5:
            used = 0
            for i in due:
                if used + p['review'] > B: break
                blocks.append((i, p['review'], 'review')); used += p['review']
            cap = min(eff, int((B - used) // p['new']))
            for i in new_items(max(cap, 0)):
                blocks.append((i, p['new'], 'new')); used += p['new']
        else:
            blocks.append(('WK', p['weekend'], 'practice')); used = p['weekend']
            for i in due:
                if used + p['review'] > B: break
                blocks.append((i, p['review'], 'review')); used += p['review']
        return blocks
    for day in range(days):
        derived_unlocked = min(int((day + 1) * dsa_unlock_per_day), 105) if dsa_unlock_per_day else 0
        if day in skips:
            last_done = False
            log.append(dict(day=day, due=len(due_list(day)))); continue
        blocks = last_plan if (not last_done and last_plan) else build(day)
        tot = sum(b[1] for b in blocks)
        minutes.append(tot)
        if tot > p['budget'] + p['new']:
            max_over = max(max_over, tot - p['budget'])
        for iid, c, kind in blocks:
            if kind == 'practice': continue
            if iid.startswith('D') and kind == 'new':
                derived_intro += 1
            introduced.add(iid)
            state[iid] = apply_result(state.get(iid), out(), day, p['iv'], p['mastered_after'], p.get('relearn'))
        last_plan, last_done = blocks, True
        log.append(dict(day=day, due=len(due_list(day + 1))))
    dues = [l['due'] for l in log]
    core_total = sum(CORE)
    core_done = sum(1 for i in introduced if i.startswith('C'))
    return dict(max_due=max(dues), end_due=dues[-1], due_w4_8=statistics.mean(dues[28:56]),
                due_w8_12=statistics.mean(dues[56:]), max_minutes=max(minutes),
                avg_minutes=round(statistics.mean(minutes), 1), budget_violation=max_over,
                core=f'{core_done}/{core_total}', introduced=len(introduced),
                mastered=sum(1 for s in state.values() if s['mastered']))

def agg(fn, p, profile, seeds=range(20), **kw):
    rs = [fn(p, profile, s, **kw) for s in seeds]
    keys = rs[0].keys(); res = {}
    for k in keys:
        vals = [r[k] for r in rs]
        if all(isinstance(v, (int, float)) for v in vals):
            res[k] = (min(vals), round(statistics.mean(vals), 1), max(vals))
        else:
            res[k] = vals[0] if len(set(map(str, vals))) == 1 else sorted(set(map(str, vals)))
    return res

def main_eng():
    base = dict(budget=25, new=1.5, review=0.5, exercise=5, shadow=3, weekend=15, new_per_day=8,
                throttle=[(40, 4), (60, 0)])
    print('iv mastered | due w6 w9 w12 w15 w18 | maxdue | core_done | introduced | maxmin avgmin | mastered')
    for iv in ([1,3,7,14], [1,3,7,14,30]):
        for m in (None, 2):
            for prof in ('ideal', 'realistic'):
                p = dict(base, iv=iv, mastered_after=m)
                rs = [run_eng(p, prof, sd, days=126, dsa_unlock_per_day=0.9) for sd in range(40)]
                def mean(k): return round(statistics.mean(r[k] for r in rs), 1)
                print(prof, iv, m, '|', mean('due_w4_8'), mean('due_w8_12'), '| max', max(r['max_due'] for r in rs),
                      '|', rs[0]['core'], '| intro', mean('introduced'), '| min', max(r['max_minutes'] for r in rs), mean('avg_minutes'),
                      '| mastered', mean('mastered'), '| viol', max(r['budget_violation'] for r in rs))

def main_grid3():
    base = dict(E=20, M=35, H=50, lesson=25, redo_factor=0.6, explain=8, mock=True,
                mastered_after=2, half_fit=True, weekday_review_cap=15, debt_frac=0.4, recall=5)
    print('budget iv spill | ideal_fin | real_fin(min,mean,max) | due w6 w9 w12 w15 w18 | maxdue | maxmin avgmin')
    for budget in (60, 75, 90):
        for iv in ([3,7,21,60], [7,21,60]):
            for spill in (False, True):
                p = dict(base, budget=budget, iv=iv, sunday_spill=spill)
                r = agg(run_dsa, p, 'realistic', days=126, seeds=range(40))
                i = agg(run_dsa, p, 'ideal', days=126)
                print(budget, iv, spill, '|', i['finish_week'][1], '|', r['finish_week'], '|', r['w6'][1], r['w9'][1], r['w12'][1], r['w15'][1], r['w18'][1], '|', r['max_due'][2], '|', r['max_minutes'][2], r['avg_minutes'][1])

def main_grid2():
    base = dict(E=20, M=35, H=50, lesson=25, redo_factor=0.6, explain=8, mock=True,
                mastered_after=2, half_fit=True)
    rows = []
    for budget in (60, 75, 90):
        for iv in ([3,7,21,60], [3,10,30,90], [7,21,60]):
            for cap, frac in ((15, 0.25), (15, 0.4), (20, 0.4)):
                for recall in (5, 6):
                    p = dict(base, budget=budget, iv=iv, weekday_review_cap=cap, debt_frac=frac, recall=recall)
                    r = agg(run_dsa, p, 'realistic', days=126)
                    i = agg(run_dsa, p, 'ideal', days=126)
                    rows.append((budget, str(iv), cap, frac, recall, i['finish_week'][1], r['finish_week'], r['w6'][1], r['w9'][1], r['w12'][1], r['w15'][1], r['w18'][1], r['max_due'][2], r['max_minutes'][2]))
    print('budget iv cap frac recall | ideal_fin | real_fin(min,mean,max) | due w6 w9 w12 w15 w18 | maxdue maxmin')
    for row in rows: print(*row)

def main_grid():
    base = dict(budget=60, E=20, M=35, H=50, lesson=25, redo_factor=0.6, recall=6, explain=8,
                weekday_review_cap=15, mock=True, mastered_after=2, half_fit=True)
    for budget in (60, 75, 90):
        for iv in ([3,7,21,60], [3,10,30,90]):
            for prof in ('ideal', 'realistic'):
                r = agg(run_dsa, dict(base, iv=iv, budget=budget), prof, days=126)
                print(budget, iv, prof, 'finish', r['finish_week'], 'due_w4_8', r['due_w4_8'], 'due_w8_12', r['due_w8_12'], 'max_due', r['max_due'], 'max_min', r['max_minutes'], 'avg', r['avg_minutes'], 'viol', r['budget_violation'])

DSA_CHOSEN = dict(E=20, M=35, H=50, lesson=25, redo_factor=0.6, explain=8, mock=True, mastered_after=2,
                  half_fit=True, weekday_review_cap=15, debt_frac=0.4, recall=5, sunday_spill=False,
                  iv=[7, 21, 60], relearn=3)
DSA_REJECTED = dict(DSA_CHOSEN, iv=[3, 7, 21, 60])
ENG_CHOSEN = dict(budget=25, new=1.5, review=0.5, exercise=5, shadow=3, weekend=15, new_per_day=8,
                  throttle=[(40, 4), (60, 0)], iv=[1, 3, 7, 14], mastered_after=2, relearn=1)

def pct(xs, q):
    xs = sorted(xs); k = (len(xs) - 1) * q; f = int(k); c = min(f + 1, len(xs) - 1)
    return round(xs[f] + (xs[c] - xs[f]) * (k - f), 1)

def report(n=200, days=126):
    global W
    print('| Scenario | Profile | Finish median | p90 | max | Unfinished @18w | Due p90 @w12 | Due p90 @w18 | Max due p90 | Max planned min |')
    print('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for label, params in (('chosen [7,21,60] relearn 3', DSA_CHOSEN), ('rejected [3,7,21,60]', DSA_REJECTED)):
        for variant, Wv, budget in (('8w', W8, 60), ('10w', W10, 60), ('10w', W10, 75), ('10w', W10, 90)):
            W = Wv
            for prof in ('ideal', 'realistic'):
                rs = [run_dsa(dict(params, budget=budget), prof, s, days=days) for s in range(1 if prof == 'ideal' else n)]
                fin = [r['finish_week'] if r['finish_week'] is not None else 99 for r in rs]
                unf = sum(1 for r in rs if r['finish_week'] is None)
                print(f"| DSA {variant} @ {budget} min, {label} | {prof} | {pct(fin,.5)} | {pct(fin,.9)} | {max(fin)} | {unf}/{len(rs)} | "
                      f"{pct([r['w12'] for r in rs],.9)} | {pct([r['w18'] for r in rs],.9)} | {pct([r['max_due'] for r in rs],.9)} | {max(r['max_minutes'] for r in rs)} |")
    W = W10
    print()
    print('| Scenario | Profile | Mean due w4-8 | Mean due w8-12 | Due p90 @w18 | Max due p90 | Max due | Max planned min | Core cards introduced |')
    print('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for label, params in (('chosen (mastered after 2)', ENG_CHOSEN), ('no mastered', dict(ENG_CHOSEN, mastered_after=None))):
        for prof in ('ideal', 'realistic'):
            rs = [run_eng(params, prof, s, days=days, dsa_unlock_per_day=0.9) for s in range(1 if prof == 'ideal' else n)]
            print(f"| English 25 min, 8/day, {label} | {prof} | {round(statistics.mean(r['due_w4_8'] for r in rs),1)} | "
                  f"{round(statistics.mean(r['due_w8_12'] for r in rs),1)} | {pct([r['end_due'] for r in rs],.9)} | {pct([r['max_due'] for r in rs],.9)} | "
                  f"{max(r['max_due'] for r in rs)} | {max(r['max_minutes'] for r in rs)} | {rs[0]['core']} |")

if __name__ == '__main__' and 'report' in sys.argv:
    report(); sys.exit()
if __name__ == '__main__' and 'eng' in sys.argv:
    main_eng(); sys.exit()
if __name__ == '__main__' and 'grid3' in sys.argv:
    main_grid3(); sys.exit()
if __name__ == '__main__' and 'grid2' in sys.argv:
    main_grid2(); sys.exit()
if __name__ == '__main__' and 'grid' in sys.argv:
    main_grid(); sys.exit()
if __name__ == '__main__':
    base = dict(budget=60, E=20, M=35, H=50, lesson=25, redo_factor=0.6, recall=6, explain=8,
                weekday_review_cap=15, mock=True, mastered_after=2)
    for iv in ([1,3,7,14,30], [3,7,21,60], [3,10,30,90], [7,21,60]):
        for prof in ('ideal', 'realistic'):
            print('DSA', iv, prof, json.dumps(agg(run_dsa, dict(base, iv=iv), prof, days=112)))
