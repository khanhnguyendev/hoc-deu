# Dogfooding: the owner's two weeks

Step 5 of `docs/ops/production.md` — once production is live and smoke-tested, the owner is its
only learner for one to two weeks before any invite goes out (ADR-0038's rollout). No secrets,
project refs or e-mail addresses live in this file.

## Daily use

Study on production as any learner would: onboarding once, then `/today` every day, checking in as
the day's blocks are actually done — not ahead of time, and not backdated. Note, each day:

- **What broke or felt wrong:** an error state, a slow screen, copy that reads oddly, a missing
  note or lesson ("Chưa có ghi chú" on more than the expected early weeks), anything on
  `/admin` that looks off.
- **What the plan asked for vs. what actually happened:** whether the day's blocks fit the budget,
  whether the gate or "Học tiếp hôm nay" behaved as expected after a skipped day, whether a setting
  change (budget, variant, time zone, day start) landed the way §5.9's edge-case table says it
  should.
- **The roadmap week reached**, each day it changes (`/progress` or `/t/<track>` shows it) — this
  is the number the pace check (below) reads back at the end.

Log these as GitHub issues or a running note, whichever the owner already uses; this file does not
prescribe a format, only what to capture.

## The pace check (decision 37)

After **14 days**, compare the roadmap week the owner actually reached against the onboarding
projection for their chosen DSA variant and budget (ADR-0014's skip-day model; the projection
table itself is `lib/domain/plan/projections.generated.json`, ADR-0037).

**Worked example** (from ADR-0014's calibration, 8-week variant at 60 min/day): the realistic
finish is a **median of 10.7 weeks, p90 11.4**. If the owner's own 14 days of real use pointed to a
finish around **13.3 weeks** instead, that is about 17 % slower than the p90 the model
projected — over the threshold below.

**The rule:** if the owner's actual pace is **more than 15 % slower** than the projection for their
variant and budget, stop before inviting anyone and revisit:

- the simulation's learner model (`lib/domain/plan/simulate.ts`, ADR-0014) — is the 80/10/10
  success split, or the one-skip-per-week assumption, too generous for a real learner;
- the SRS parameters and templates the model assumes (`lib/content/*/track.yaml`'s `srs`,
  `weeklyTemplate`, `defaults`) — is the review load in practice higher than simulated;
- the defaults shown at onboarding (budget, variant) — should the default budget or the 8w/10w
  split (ADR-0015) change.

Only once the pace is within 15 % (or the model and defaults have been revised and re-simulated,
`pnpm sim:projections`) does the owner decide whether to open invites (sign-up with approval,
already built — platform design §2.5, §4.5).

## The week-4 content and harness constraint (spec §0)

Independent of the pace check, **before any learner (the owner included) reaches roadmap week 4 of
either track**:

- the `content-verify` harness phases **M3b** and **M3c** must be done (week 4 brings linked lists
  and design problems such as 146 LRU Cache, which need them to run at all); **and**
- either the week 4–5 notes and pattern lessons have been written by hand, or v1.1's content loop
  has shipped so it can fill them in.

`/admin` and `/admin/content` show a **red warning** for every roadmap week an active learner will
reach within 14 days whose notes or lessons are still missing (decision 25) — if the owner sees
that warning during dogfooding, it is expected until the content above is written, not a bug to
chase. Do not invite learners while a red warning is up for a week they could reach within two
weeks of signing up.
