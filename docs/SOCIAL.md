# Drivemode "by Cline" — the showcase

*Instagram for coding projects — except you can build in the same place.*

## Thesis

Inspiration and construction live in different apps today: you see a
friend's project somewhere social, then the actual work happens somewhere
else, alone. Drive already has the missing half — live working sessions,
directed demos, agents that publish typed work. The showcase adds the
first half: a place where projects are *seen*, friends react, and the
distance from "that's cool" to "I'm in the session helping" is one tap.

Working name: **Drivemode "by Cline"**. Cline is the resident builder —
every project square quietly carries the mark.

## The shapes

- **Profile = a grid of project squares.** Your profile is not a feed of
  moments; it's your shelf of projects, each square a cover generated
  from the project's identity and state (building / shipped / live now).
- **Project page = README + DEMO + people.**
  - `README.md` — what it is, rendered natively.
  - `DEMO.md` — *the demo is a directed beat program.* Not a screen
    recording: the same plan → diagram → edit → tests → result beats the
    Spotlight plays live, replayable by anyone. Drive's replay artifact
    **is** the demo format — no new media type needed.
  - **People** — who's building it, and the *Join project* invitation.
- **Comments, like commenting on a friend's profile.** Threads on a
  project from your close friends; warm by construction (see graph).

## The graph: close friends, not followers

No follower counts, no public metrics race. You have **friends** —
mutual, small-circle — and you **invite** them (people don't like being
followed; they like being invited — the session language extends here).
A friend can:

- comment on your projects,
- get inspired (fork-style "start from this README" later),
- **join the project** — which is just receiving a working-session
  invitation. The social layer terminates in the product's core loop.

## Privacy posture (locked)

- Projects **private by default**; publishing a square is explicit.
- Publishing exposes README/DEMO/team — *never source code*. Demos are
  typed-event replays; pixels and files never leave.
- Owner moderates their space: remove any comment, unpublish any time.
- Block works both ways and is total. Report exists from day one.
- Full details live in PRIVACY-POLICY.md §Social and DATA-POLICY class E.

## Phases

- **P0 — in-app prototype (this build).** Local demo data: your grid,
  friends rail, project pages with README/DEMO (replay player)/comments,
  Join-project CTA. Proves the feel; collects feedback via feedback mode.
- **P1 — org-backed.** Squares map to real repos (README from the repo,
  DEMO from a chosen replay artifact); teammates = repo collaborators.
  Rides the integrations/VCS initiative (GitHub adapter) — no new backend.
- **P2 — hosted social.** Profiles, friends, comments, invites as a small
  service with block-list sync + moderation tooling (Data class E).
- **P3 — discovery.** Cross-circle inspiration ("friends of friends
  shipped this week"), template forks, curated showcases.

## Risks, named

- **Moderation debt** — comments are user content; P2 doesn't ship
  without remove/block/report + audit. P0/P1 sidestep it (local/friends).
- **Code leakage via README** — publishing UX shows exactly what becomes
  visible; lint for secret-shaped strings before publish.
- **Clout dynamics** — follower-count culture would poison the
  close-friends warmth; the no-public-metrics rule is a product decision,
  not a missing feature.

## Open owner decisions

- Name lockup: "Drivemode by Cline" vs "Drive Showcase".
- Comment identity: display name only vs avatar+name.
- P1 repo mapping: org-only or any GitHub repo.
