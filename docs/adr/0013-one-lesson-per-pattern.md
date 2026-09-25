# ADR-0013: One lesson per pattern; notes upgradeable to deep-dives

- **Status:** accepted
- **Date:** 2026-09-25
- **Spec:** platform design §0.1 (Q4, Q5), §3.4 (lesson formats), §3.5 (problem notes,
  deep-dives), §3.6 (cross-reference checks), §5.4 (new-item order, review blocks); implementation
  plan Part B-M3 decision 4, tasks 3.2c and 3.7b

## Context

The DSA track has 114 problems (decision 29) in 15 topics, and each topic is one problem-solving
pattern: Arrays & Hashing, Two Pointers, Sliding Window, and so on. A learner needs to meet each
pattern once, properly, and then practise it on problems; a full lesson per problem would repeat
the same explanation many times and cost a 25-minute lesson estimate (§3.4 `estimates.lesson`) for
every problem. Some problems still deserve more than a compact note (Trapping Rain Water,
Largest Rectangle in Histogram), and the v1.1 content loop proposes deep-dives for problems many
learners fail (§6.1). Content arrives in phases too: notes and lessons for W1–W3 first (Q5), the
rest by hand or by the bot later, so a missing lesson must not break the build.

## Decision

- **One pattern lesson per topic.** `lessons/<topic>.mdx` (so `dsa:lesson-<topic>`, ADR-0010)
  with `format: pattern` and the manifest's sections in this order: `signals`, `analogy`, `visual`,
  `approach`, `code`, `complexity`, `bilingual`, `practice`, `quiz`. It names two problems:
  - `anchor` — the worked example: the `visual` and `approach` sections walk through it, and the
    `code` section shows the pattern's template in Python (the anchor's full Python, Java and Go
    solution stays in its note, so code lives in one place);
  - `practice` — the problem the learner tries next. The `practice` section links it with
    `<Practice problem>`; wherever a `<Practice>` appears, its `problem` must equal the frontmatter
    `practice`.
- **Rules**, checked by `pnpm content:build` (`tools/content/crossref.ts`):
  - on every lesson: `anchor!=practice` — practising the worked example tests recall of the
    walk-through, not transfer of the pattern; and `same-topic` — anchor and practice are problems
    of this track whose topic is the lesson's;
  - among lessons that are not retired: `one-per-topic` — **at most** one pattern lesson per
    topic: the first by ID holds the place and any other is an error. A second take on a pattern
    is a deep-dive about a problem, not a second pattern lesson.
- **Choosing the pair:** the anchor is the simplest problem that shows the whole pattern (often
  Easy), the practice one that needs a single extra step. For example arrays-hashing uses 1 → 49:
  Two Sum shows the lookup, Group Anagrams adds grouping by a designed key. Each lesson's
  frontmatter is the source of truth; `content:build` checks it.
- **Every problem gets a compact note** (`note.mdx`, §3.5): key idea, steps, complexity,
  `<Solution />` and a `<Bilingual>` one-liner, which becomes the derived English "Explaining code"
  card. The note is where a problem's own tricks go (271's length prefix, 36's box index).
- **A note is upgradeable to a deep-dive** without schema or route changes: add one lesson with
  `format: deep-dive` and `about: <problemId>` (sections without `signals`; requires `about` and
  `practice`; rules `practice!=about` and `same-topic` on every deep-dive, `max-1-per-about` among
  those not retired). The file is `lessons/deep-dive-lc-NNNN.mdx`, named after the problem it is
  about, so its ID is `dsa:lesson-deep-dive-lc-NNNN` (ADR-0010: lesson IDs are
  `<track>:lesson-<file>`; the `dsa:deep-dive-lc-0049` in platform design §6.4.2 predates that
  rule). The note stays — it holds the solution, the verification badge and the Bilingual card —
  and the catalog's reverse lookup (`deepDiveIndex`) lets the problem page link to the deep-dive.
  In review, a Weak problem's uncompleted deep-dive is placed right before it (§5.4). No deep-dive
  is written in M3.
- **A missing lesson is coverage, not an error** (decision 4). The rule is "at most one", never
  "exactly one": `content:build` reports each roadmap week's topics without a lesson
  (`— (arrays-hashing missing)`), `/admin/content` flags weeks a learner reaches within 14 days
  without them (§0, §2.4), and the plan skips the lesson while still scheduling the week's
  problems (§5.9).

## Consequences

- Easier: 14 DSA pattern lessons plus an optional Tries lesson (Q4) instead of one per problem.
  The learner meets each pattern once, with a worked example, then practises transfer on a
  different problem of the same pattern.
- Easier: notes stay short and uniform, so W4–W10 can be written (by hand or, from v1.1, by the
  bot as drafts) one problem at a time. Upgrading a note to a deep-dive is one added file; the
  problem keeps its ID, its note and its learners' history.
- Easier: lessons and notes land in any order; the build stays green and the coverage report says
  what is left.
- Harder: a topic with several sub-patterns must fit one lesson. Arrays & Hashing, for example,
  covers lookup, counting, grouping and prefix products; the lesson teaches the common idea (trade
  memory for an `O(1)` lookup), and each variant's details live in its problem's note.
- Accepted: changing a topic's anchor or practice means editing its one lesson in place. The file
  names the ID (ADR-0010), so the lesson keeps its ID and learners who completed it keep that
  history, even though they studied the old pair.
