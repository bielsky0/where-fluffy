# Polishing this repo for public / portfolio presentation

A prioritized checklist of what's missing between "solid working codebase" and "repo that reads
as senior-architect-quality the moment someone opens it." Nothing here is required for the app to
run — this is about first-impression credibility for reviewers, recruiters, or collaborators.

## High priority — credibility gaps

- **Add a `LICENSE` file.** Right now the repo has no license at all, which technically means
  "all rights reserved" and blocks anyone from legally reusing or contributing to it. For a
  demo/portfolio-style backend like this, MIT or Apache-2.0 are the conventional choices
  (Apache-2.0 if you want the explicit patent grant; otherwise MIT is simpler and just as
  common). Once added, the README's license line and a `![License]` badge can both go live.

- **Add a root-level `.env.example`.** Today the only templates are `src/.env.example` and the
  100+-line `.env.production.example` — a newcomer has to read both plus the
  `docker-compose.prod.yml` header comment to know which variables are actually required. A
  single consolidated root `.env.example` (dev-friendly defaults, clearly marked required-vs-
  optional sections) removes that friction entirely.

- **Add ESLint + Prettier.** `CLAUDE.md` explicitly notes "No lint/format config is present in
  the repo." That's the one line in an otherwise very disciplined, well-documented codebase that
  visibly contradicts the "senior" impression — a missing lint config is one of the first things
  an experienced reviewer checks for.

- **Add a frontend test suite.** All four backend modules have real Jest unit + integration
  coverage, but `web/` has zero tests — no Vitest, no React Testing Library, no Playwright.
  Given how much interaction logic lives in the frontend (bbox debouncing, virtualized lists,
  wizard flows, chat), this asymmetry is the most visible gap to anyone comparing the two halves
  of the repo. Start with Vitest + RTL for the API hooks and a couple of the trickier components
  (`PetResultsList`'s virtualization, the add-listing wizard).

## Medium priority — presentation

- **`CONTRIBUTING.md` + issue/PR templates** (`.github/ISSUE_TEMPLATE/`,
  `PULL_REQUEST_TEMPLATE.md`). Even a solo-maintained repo benefits from this — it signals the
  project is maintained deliberately, not abandoned.

- **`SECURITY.md`.** Reasonable given the app handles JWTs, OAuth tokens, and location data —
  a short "how to report a vulnerability" file is standard practice for anything auth-adjacent.

- **Dependabot or Renovate config.** Signals active dependency hygiene; also just useful given
  the narrowly-pinned versions in `infra/ai-model/requirements.txt`.

- **GitHub repo metadata.** Set the repo description, add topics (`postgis`, `pgvector`,
  `socket-io`, `prisma`, `react`, `observability`, `bullmq`), and upload a social-preview image —
  these show up everywhere the repo link is shared and cost minutes to set up.

- **CI badge + branch protection on `main`.** The CI badge is already in the new README; pair it
  with actually requiring the `backend`/`frontend` jobs to pass before merge.

- **A demo GIF or screenshot in the README.** Single highest-leverage visual item on this list —
  a 10-second clip of the map explorer or the chat flow does more for a first impression than any
  amount of prose. Put it right under the tagline, above the badges or right below them.

- **`CHANGELOG.md` or GitHub Releases.** Commit history already uses conventional prefixes
  (`feat:`, `fix:`) — either keep a hand-written changelog or start tagging releases and let
  GitHub generate release notes from those commits.

## Lower priority — nice-to-have

- **Prisma ER diagram.** A generated diagram (e.g. via `prisma-erd-generator`) checked into
  `docs/` and linked from the README makes the `User`/`Pet`/`Comment`/`ChatRoom`/`Message`
  relationships legible at a glance instead of requiring a `schema.prisma` read.

- **A sequence diagram for the chat trust boundary.** The Postgres-check-once →
  Redis-cache-for-subsequent-checks flow in `chat.service.ts` is one of the most interesting
  design decisions in the repo and currently exists only as prose (in `CLAUDE.md` and now the
  README) — a diagram would make it immediately legible.

- **Reconcile the stray "Jaeger" mention in `CLAUDE.md`.** It's leftover wording from before the
  Alloy/Loki/Tempo/Prometheus/Grafana stack replaced Jaeger — harmless for an AI-agent guidance
  file, but worth a one-line fix so internal docs and the public README never disagree about
  what the observability stack actually is.

- **Code coverage badge (Codecov or similar).** Worth adding once the frontend has a test suite
  to report coverage for — premature before that.
