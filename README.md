# CodeScope

**An engineering workflow platform that continuously understands a Python codebase and automatically analyzes the impact of every pull request — without anyone having to ask.**

[Screenshots](#screenshots)

---

## What is this?

Most AI coding tools are reactive — you paste code, ask a question, and the context disappears when the chat ends. CodeScope works the other way: it listens to a GitHub repo via webhooks, keeps a live dependency graph and semantic index of the code, and reacts automatically the moment a PR opens — no prompt required.

When a PR opens, CodeScope traverses the dependency graph to find every directly and transitively affected file, computes a **deterministic risk score**, retrieves similar past changes via pgvector, and sends Gemini the structural facts (not the raw diff) with instructions to explain the score using cited evidence. The result — risk level, evidence, potential issues, suggested tests — is **posted automatically as a comment on the PR**, before anyone asks, and stored for the dashboard.

The core rule: **the LLM explains the risk score, it never invents one.** Fan-out, core-module detection, diff size, and change frequency combine into a number first; Claude receives that number as a fact and returns structured JSON, not a paragraph — it's instructed, and structurally unable, to override it. That keeps the one part of the system that actually gates a merge decision fully deterministic and testable, while still getting natural-language reasoning where it adds real value.

| | Claude / Copilot in an editor | CodeScope |
|---|---|---|
| Trigger | Reactive — you ask | Proactive — a PR opens, it reasons |
| Memory | Forgets after the session | Persists across every commit |
| Context | You paste it in manually | Collected automatically via webhooks |
| Dependency awareness | None | Live graph, rebuilt on every push |
| Risk assessment | A confident guess | Computed deterministically, then explained |

---

## Features

**Always-fresh, not "as of your last question."** Every push triggers re-indexing automatically — the AST parser, dependency graph, and embeddings are rebuilt for the changed files in the background (Celery), with no manual re-sync needed. The graph and search index you see on the dashboard reflect the repo as of the last commit, not as of whenever someone last asked a question about it.

**Semantic code search**, not grep. Every file gets a sentence-transformer embedding (filepath, classes, functions, imports, docstring) generated locally — no per-query API cost. Search "payment processing" and get back the files that are conceptually about payment processing, not just ones that contain the string. The search endpoint distinguishes "no results" from "index isn't ready yet" (`not_indexed` / `indexing` / `ready` / `model_unavailable`) so a freshly connected repo doesn't look broken, it looks like it's catching up.

**An interactive dependency graph, not a text list.** The Analysis page renders the blast radius — changed files → directly affected → transitively affected — as an actual graph (React Flow), color-coded by distance from the change, with the same file list also available as a flat sidebar for quick scanning. Clicking a file highlights it in both views at once.

**A real dashboard, not just a webhook that fires and forgets.** Organizations → connected repos → per-repo analysis history → individual analysis detail, all backed by the same Postgres data the PR comment is generated from. Every analysis CodeScope ever ran is browsable after the fact, not just visible in the PR thread it was posted to.

---

## Screenshots

> _Before sharing this repo, add:_
> - _Dashboard (org → repo list)_
> - _Analysis page — risk score + evidence-based explanation_
> - _Dependency graph view (React Flow blast-radius visualization)_
> - _Semantic search results_
> - _An actual GitHub PR with the auto-posted CodeScope comment_
>
> _A GIF of a PR opening and the comment landing automatically is the single highest-impact thing you could add here — it's the moment that makes "proactive, not reactive" tangible instead of a claim._

---

## Architecture

```
GitHub
  │  push / pull_request webhook (HMAC-verified, delivery-ID deduplicated)
  ▼
FastAPI  ──────────────────────────────────────────────┐
  │  enqueues                                            │
  ▼                                                       │
Redis (Celery broker)                                     │
  │                                                        │
  ├── Worker: AST-parse changed files (Python's `ast`)     │   runs on
  ├── Worker: rebuild file-level dependency graph          │   EVERY push,
  └── Worker: generate sentence-transformer embeddings     │   not just PRs
                │                                          │
                ▼                                          │
      PostgreSQL + pgvector                                │
                │                                           │
                │  PR opened                                 │
                ▼                                             ▼
         LangGraph workflow (8 nodes)
    ┌───────────────┬────────────────┐
    │  BFS graph     │  pgvector      │
    │  traversal     │  similarity    │
    │  (blast radius)│  search        │
    └───────┬────────┴────────┬───────┘
            ▼                 ▼
      Deterministic risk score (no LLM)
                  │
        LLM reasoning (Claude) — explains
        the score, cites specific evidence,
        never sets or overrides it
                  │
                  ▼
        Structured JSON → PR comment + DB
                  │
                  ▼
          React dashboard (history,
          dependency graph, semantic search)
```

**Removing the LLM entirely still leaves a working product**: the dependency graph, deterministic risk scoring, semantic search, and full commit/PR history all function without it. The LLM adds the plain-English explanation and test suggestions on top — it's a layer, not the foundation.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Backend | FastAPI (async) | Fast, typed, first-class background task support |
| Database | PostgreSQL + pgvector | Relational data and vector search in one store — no separate vector DB service |
| Cache / broker | Redis | Backs Celery, low operational overhead |
| Background jobs | Celery | Indexing and analysis run off the request path |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`, local) | No per-embedding API cost, runs entirely on CPU |
| AI orchestration | LangGraph | Explicit, inspectable state machine instead of a single opaque prompt |
| LLM | Claude API | Structured JSON output for evidence-based risk explanations |
| GitHub integration | PyGithub + signed webhooks | Repo access, PR comments, idempotent event handling |
| Frontend | React + Vite + Tailwind | Fast iteration, small bundle |
| Auth | GitHub OAuth (Authlib) | Single sign-on, no separate credential store |
| Parsing | Python's built-in `ast` module | No hand-rolled parser to maintain |

---

## Key engineering decisions

A few choices worth knowing the reasoning behind, in case they come up:

- **Risk scoring is deterministic and runs before the LLM is invoked.** Fan-out, core-module detection, diff size, and change frequency are combined into a numeric score with fixed weights (`services/risk_service.py`). The LLM is given this score as a fact and instructed not to change it — the system prompt enforces this, and nothing downstream trusts an LLM-generated risk level.
- **The dependency graph is file-level, not symbol-level, for v1.** A full call graph (function-to-function resolution) is real scope, not a missing feature — it's the first item on the v2 roadmap. File-level BFS over a reverse-adjacency map is enough to answer "what does this change affect" correctly and is far simpler to get right and keep fast.
- **Webhook idempotency via a dedicated delivery-ID table**, not a narrower "does an analysis already exist for this PR" check — the latter wouldn't catch duplicate push events and could mask a legitimate second event that happens to share a PR number. GitHub retries deliveries that time out; this turns a retry into a cheap no-op.
- **The LLM returns structured JSON, not free text.** Early on, the model's explanation was a well-written but generic paragraph ("this touches authentication files, so risk is high"). The prompt now requires cited, structural evidence — specific file names, fan-out counts, and prior PR numbers pulled from the same context the deterministic scorer used — so the explanation reads like a reviewer citing facts, not a model restating the risk label in prose.
- **A full re-clone on every push**, rather than incrementally diffing the working tree. At the repo sizes this targets, a shallow clone is fast enough that the added complexity of incremental sync isn't worth it — this is a deliberate simplicity trade-off, not an oversight.
- **Indexing and embedding generation are separate Celery tasks**, chained rather than run inline. AST parsing is fast filesystem/CPU work; embedding generation is model inference with a different cost and failure profile. Splitting them means a slow or backed-up embedding step never blocks the dependency graph (used by impact analysis) from updating promptly after a push.
- **Search distinguishes "no results" from "not indexed yet."** A freshly connected repo and a repo with a genuinely unmatched query both return an empty `results` array — indistinguishable to a naive client. The search endpoint returns an explicit `status` field (`not_indexed` / `indexing` / `ready` / `model_unavailable`) so the frontend can show "still indexing" instead of a misleading "no matches," which is what a first-time user actually hits most often.

---

## Scope — v1

Python repositories, single GitHub repo per project, one AI workflow (Change Impact Analysis), solo-deployable via Docker Compose.

**Explicitly out of scope for v1** — 
- Symbol/function-level call graph (file-level only)
- Multi-language support
- Autonomous PR/issue creation, agent memory
- CI/CD or Slack integrations
- Fine-tuning or code generation

---

## Local setup

**Prerequisites:** Docker & Docker Compose, a GitHub OAuth App, an Anthropic/Gemini/OpenAI API key.

```bash
git clone https://github.com/<your-username>/codescope.git
cd codescope
cp .env.example .env   # fill in the values below
docker compose up --build
```

| Variable | Description |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_SYNC` | Postgres connection strings (async + sync) |
| `REDIS_URL` | Redis connection string, used by Celery |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | From your GitHub OAuth App |
| `GITHUB_WEBHOOK_SECRET` | Shared secret used to verify incoming webhook signatures |
| `PUBLIC_BASE_URL` | Publicly reachable backend URL (used to register the GitHub webhook) |
| `FRONTEND_URL` | Frontend origin, used for CORS and post-login redirect |
| `ANTHROPIC_API_KEY` | For the impact-analysis LLM step |
| `SECRET_KEY` | Session cookie signing key |
| `TOKEN_ENCRYPTION_KEY` | Fernet key used to encrypt stored GitHub access tokens at rest |

Generate secrets rather than reusing the examples in `.env.example`:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # TOKEN_ENCRYPTION_KEY
openssl rand -hex 32   # SECRET_KEY, GITHUB_WEBHOOK_SECRET
```

Once running: `http://localhost:8000/health` (backend) and `http://localhost:3000` (frontend). In local development, expose the backend with `ngrok` and point your GitHub App's webhook URL at it to receive real push/PR events.

---

## Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend + Celery worker | Railway |
| PostgreSQL (with pgvector) | Railway — deploy the **pgvector-enabled** Postgres template, not the default plugin |
| Redis | Railway |

Session auth uses cross-site cookies (`SameSite=None; Secure`) since the frontend and backend are on different domains — both must be served over HTTPS.

---

## API overview

```
GET  /auth/github               GitHub OAuth login
GET  /auth/github/callback      OAuth callback
GET  /auth/me                   Current session user
POST /auth/logout

POST /orgs                      Create organization
GET  /orgs                      List your organizations

POST /orgs/{org_id}/projects    Connect a GitHub repo
GET  /orgs/{org_id}/projects    List repos in an org
GET  /projects/{project_id}     Repo detail
POST /projects/{project_id}/sync  Manual re-index

POST /webhooks/github           GitHub push / pull_request events

GET  /projects/{project_id}/search?q=...   Semantic code search

GET  /projects/{project_id}/analyses       Analysis history
POST /projects/{project_id}/analyses       Trigger analysis manually
GET  /analyses/{analysis_id}               Full analysis detail
```

---

## Project structure

```
codescope/
├── backend/
│   ├── ai/           # LangGraph workflow, prompts, state, LLM client
│   ├── models/        # SQLAlchemy models
│   ├── routers/        # FastAPI route handlers
│   ├── services/         # Business logic (graph traversal, risk scoring, indexing, search)
│   ├── workers/            # Celery task definitions
│   └── utils/                # AST parser, git ops, embeddings, webhook signature verification
├── frontend/
│   └── src/
│       ├── pages/       # Dashboard, Project, Analysis, Search
│       ├── components/    # Dependency graph, risk tags, modals
│       └── hooks/            # Data fetching (TanStack Query-style hooks)
└── docker-compose.yml
```

---

## Roadmap (v2)

- Symbol/function-level call graph, not just file-level imports
- Multi-language support beyond Python
- Slack and CI/CD integrations
- Configurable, per-project core-module rules for risk scoring

---

## License

MIT — see [LICENSE](./LICENSE).

---

Built by [Mahek Shah](https://github.com/Mahek-S) · [LinkedIn](https://www.linkedin.com/in/maheksshah/)