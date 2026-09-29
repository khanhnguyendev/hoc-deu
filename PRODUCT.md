# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Vietnamese IT learners (students, junior and mid-level developers) who want to get better at
interview-style DSA and at the English they use at work, but study in short, irregular slots
around a job or classes. They read Vietnamese; technical terms stay English. First audience of
the public pages: people the owner invites after two weeks of dogfooding (friends, colleagues).
Sign-up is open but every account needs admin approval before it can study.

## Product Purpose

Học Đều turns a long roadmap into one plan for today that fits the minutes a learner has. The
learner opens the app, sees today's plan, studies, and checks in. The roadmap moves forward only
on days the learner actually studies, and spaced repetition brings old material back when it is
due. Success: the learner keeps showing up, steadily ("đều"), and finishes the roadmap.

## Positioning

A roadmap that waits for you. Other courses run on a calendar and leave you behind after a missed
week; Học Đều's plan is recomputed from what you actually did, so a missed day costs nothing but
that day. Built for Vietnamese learners, in Vietnamese, around two concrete tracks rather than a
course catalogue.

## Operating Context

- Daily loop: open `/today` → study the blocks (lesson, problem, review cards) → check in with
  minutes and outcome (done / partial / skipped).
- Onboarding sets tracks, minutes per day, DSA variant (8 or 10 weeks, with a simulated finish
  date), start date, time zone, day start (default 04:00) and code language.
- Progress page: calendar heatmap of study minutes, streak, weekly summary.
- Used on a phone as often as on a laptop (375 px must work).

## Capabilities and Constraints

- v1.0 tracks: **DSA** (NeetCode 150 by pattern, ~110 problems; 8-week default below 75 min/day,
  10-week at 75+; solutions in Python, Java and Go; one lesson per pattern) and **English for IT
  workplaces** (10 weeks, flashcards ~30/week, runs in parallel).
- Deterministic baseline plan for everyone. AI personalisation exists behind an admin-only flag,
  default OFF; v1.0 public copy must not claim AI features as live. AI may be named as coming.
- Sign-in: Google and GitHub OAuth only. Account states: pending, active, rejected, suspended.
- Non-commercial (Vercel Hobby): no pricing, payments or plans.
- Never copy LeetCode problem statements; nothing calls leetcode.com.
- All UI copy in Vietnamese (`lib/i18n`); English learning content wrapped in `lang="en"`.

## Brand Commitments

- Name "Học Đều" (never all caps, never tightened tracking: diacritics collide).
- Mark: six heatmap cells in an even staircase (`docs/design/brand-kit/`), colours from the heat
  ramp only. "Đều" = steady, even.
- Existing design system is binding for the app: `docs/design/DESIGN_SYSTEM.md` ("calm study
  desk": warm stone neutrals, one teal focus colour, Be Vietnam Pro + JetBrains Mono, hairline
  borders, tokens only). Owner decision 2026-09-29: the landing page amplifies this world rather
  than replacing it.
- Voice: calm, direct, no hype, no gamification (no confetti, no sound, no fake urgency).

## Evidence on Hand

- Real product surfaces to show: today plan, check-in, review cards, heatmap, streak
  (`features/*`, `/dev/components`).
- Real content: DSA roadmap weeks and patterns, English decks (`content/tracks/**`).
- Brand kit SVG/PNG (`docs/design/brand-kit/`).
- None: testimonials, user counts, completion rates, press, benchmarks. Do not invent them; any
  demonstration data on public pages is labelled as an example.

## Product Principles

1. Today first: always answer "what do I do now?".
2. Steady beats intense: reward showing up, not streak pressure.
3. Honest claims: say only what v1.0 does.
4. Vietnamese-first, English where the craft is English.
5. Calm by default: colour and motion carry meaning, never decoration.

## Accessibility & Inclusion

WCAG 2.1 AA (axe in CI): visible focus, keyboard access, 44 px touch targets, never colour alone,
`prefers-reduced-motion` respected.
