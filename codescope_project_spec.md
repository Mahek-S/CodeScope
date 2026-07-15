# CodeScope — Engineering Workflow Platform
## Complete Project Specification (v1)

---

## What Is CodeScope?

CodeScope is an engineering workflow platform that continuously understands your Python codebase and automatically analyzes the impact of every code change — without anyone having to ask.

When a developer opens a pull request, CodeScope:
- Parses the changed files
- Traverses the dependency graph to find affected modules
- Computes a deterministic risk score
- Searches for similar past bugs using semantic similarity
- Reasons over the architecture context using AI
- Posts a structured impact analysis as a GitHub PR comment

The AI is one layer on top of deterministic infrastructure. Remove the LLM and the indexing, graph traversal, risk scoring, webhook pipeline, and semantic search all still work.

---

## Core Value Proposition

**Claude can answer questions about code you paste.**
**CodeScope maintains persistent engineering knowledge that updates automatically on every commit.**

| Claude / Copilot | CodeScope |
|---|---|
| Reactive — you ask, it answers | Proactive — events happen, it reasons |
| Forgets everything after session | Remembers full project history |
| You provide context manually | Context collected automatically via webhooks |
| No dependency awareness | Live dependency graph updated on every push |
| No project history | Correlates changes with past bugs |
| Risk assessment is a guess | Risk score is computed deterministically, then explained |

---

## Scope — Version 1

- Python repositories only
- Single GitHub repository per project
- One AI workflow: Change Impact Analysis
- Web app + GitHub App installation
- Solo-deployable via Docker Compose

**Explicitly out of scope for v1** (named as deliberate scoping decisions, not oversights):
- Knowledge graph (symbol/class/method-level relationships)
- Call graph (function-to-function call resolution)
- Architecture graph
- Multi-language support
- Agent memory / autonomous PR or issue creation
- CI/CD or Slack integrations
- Fine-tuning, code generation

These are named as the v2 roadmap, not gaps.

---

## Features

### Platform Features
- GitHub OAuth login
- Create organizations
- Create projects linked to GitHub repositories
- Repository sync on connect
- GitHub webhook listener (push events, PR events)
- Activity dashboard
- Semantic code search ("find files related to payment processing")
- Analysis history per repository

### Intelligence Pipeline (runs automatically)
- Repository parser — uses Python's built-in `ast` module to extract imports, classes, functions, and exports per file (not a hand-rolled parser)
- Dependency graph builder — file-level graph only: File A imports File B
- Embedding generator — semantic vector for each file using sentence-transformers
  - **Stretch (v1.5, only if time allows after Day 5):** additional embeddings per class/function, stored separately, so a large `utils.py` doesn't collapse 30 unrelated helpers into one blurry vector
- Event logger — stores every commit, PR, changed file
- All triggered automatically on every push via GitHub webhook

### AI Feature: Change Impact Analysis
Triggered when a PR is opened.

**Input:**
- List of changed files in the PR

**Steps:**
1. Graph traversal — find all files that import the changed files (direct + transitive)
2. **Deterministic risk scoring** — computed *before* the LLM sees anything:
   - Number of transitively affected files (fan-out)
   - Whether a "core" module changed (e.g. flagged infra/shared files)
   - Size of the diff
   - Historical change frequency of the touched files
   - These combine into a numeric score → mapped to Low / Medium / High
3. Vector search — find semantically similar files and past bugs
4. LLM reasoning — given the score, the affected files, and similar past bugs, the LLM **explains** the risk in plain English; it does not invent the risk level itself

**Output posted as GitHub PR comment:**
- List of directly affected modules
- List of transitively affected modules
- Similar past incidents or bugs
- Suggested test files to rerun
- Risk level: Low / Medium / High, with the underlying score
- Plain English explanation of why

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend framework | FastAPI | Async, fast, great for APIs |
| Database | PostgreSQL | Relational data, reliable |
| Vector storage | pgvector (PostgreSQL extension) | Embeddings inside existing DB, no extra service |
| Cache + message broker | Redis | Fast, Celery needs it |
| Background jobs | Celery | Async workers for indexing pipeline |
| Embeddings | sentence-transformers (local) | Free, no API cost, runs locally |
| AI workflow | LangGraph | Structured multi-step reasoning |
| LLM | Claude API or OpenAI GPT-4o | Reasoning and synthesis |
| GitHub integration | PyGithub + webhooks | Repo access, PR comments |
| Frontend | React + Tailwind CSS | Clean UI, widely known |
| Auth | GitHub OAuth via Authlib | Single sign-on with GitHub |
| Containerization | Docker + Docker Compose | One command to run everything |
| Local webhook testing | ngrok (dev only) | Expose localhost to GitHub |

---

## System Architecture

```
GitHub
  │
  │  push event / PR opened
  ▼
FastAPI Webhook Endpoint
  │
  │  queues task
  ▼
Redis (message broker)
  │
  ├── Celery Worker 1: Parse Python files (AST) → extract imports/classes/functions
  ├── Celery Worker 2: Build/update dependency graph (file-level)
  └── Celery Worker 3: Generate embeddings → store in pgvector
                │
                ▼
         PostgreSQL + pgvector
                │
                │  PR opened event
                ▼
         LangGraph Workflow
                │
         ┌──────┴──────┐
         │             │
    Graph Traversal  Vector Search
    (affected files) (similar bugs)
         │             │
         └──────┬──────┘
                │
         Deterministic Risk Score
                │
           LLM Reasoning
           (Claude/GPT — explains the score)
                │
                ▼
         Format Output
                │
         ┌──────┴──────┐
         │             │
  Post PR Comment   Store in DB
  (GitHub API)      (PostgreSQL)
         │
         ▼
  React Dashboard
  (analysis history,
   search, dependency view)
```

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id BIGINT UNIQUE NOT NULL,
    email TEXT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    access_token TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Org memberships
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    org_id UUID REFERENCES organizations(id),
    role TEXT DEFAULT 'member', -- 'admin' | 'member'
    joined_at TIMESTAMP DEFAULT NOW()
);

-- Projects (linked to GitHub repos)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    repo_full_name TEXT NOT NULL, -- e.g. "username/reponame"
    repo_url TEXT NOT NULL,
    default_branch TEXT DEFAULT 'main',
    webhook_secret TEXT,
    indexed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- File nodes (one per Python file in repo)
CREATE TABLE file_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    filepath TEXT NOT NULL, -- relative path e.g. "src/services/user_service.py"
    language TEXT DEFAULT 'python',
    classes TEXT[],
    functions TEXT[],
    exports TEXT[],
    content_hash TEXT, -- to detect changes
    embedding vector(384), -- sentence-transformers dimension, file-level summary embedding
    last_indexed TIMESTAMP,
    UNIQUE(project_id, filepath)
);

-- Symbol embeddings (STRETCH — class/function-level, only if time allows)
CREATE TABLE file_symbol_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_node_id UUID REFERENCES file_nodes(id),
    symbol_name TEXT NOT NULL, -- class or function name
    symbol_type TEXT NOT NULL, -- 'class' | 'function'
    embedding vector(384),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Dependency edges (file A imports file B)
CREATE TABLE dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    source_file_id UUID REFERENCES file_nodes(id),
    target_file_id UUID REFERENCES file_nodes(id),
    UNIQUE(source_file_id, target_file_id)
);

-- Commits
CREATE TABLE commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    sha TEXT NOT NULL,
    message TEXT,
    author_name TEXT,
    author_email TEXT,
    changed_files TEXT[], -- array of filepaths
    committed_at TIMESTAMP,
    UNIQUE(project_id, sha)
);

-- Pull requests
CREATE TABLE pull_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    pr_number INTEGER NOT NULL,
    title TEXT,
    author TEXT,
    changed_files TEXT[],
    base_branch TEXT,
    head_branch TEXT,
    opened_at TIMESTAMP,
    UNIQUE(project_id, pr_number)
);

-- Impact analyses
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    pr_number INTEGER,
    trigger TEXT, -- 'pr_opened' | 'manual'
    changed_files TEXT[],
    directly_affected TEXT[],
    transitively_affected TEXT[],
    similar_past_bugs JSONB,
    suggested_tests TEXT[],
    risk_score NUMERIC, -- deterministic score before LLM reasoning
    risk_level TEXT, -- 'low' | 'medium' | 'high', derived from risk_score
    explanation TEXT, -- LLM's plain-English explanation of the score
    raw_llm_output TEXT,
    github_comment_id BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## LangGraph Workflow

```python
# State definition
class ImpactAnalysisState(TypedDict):
    project_id: str
    pr_number: int
    changed_files: list[str]
    directly_affected: list[str]
    transitively_affected: list[str]
    similar_bugs: list[dict]
    risk_score: float
    risk_level: str
    explanation: str
    suggested_tests: list[str]

# Nodes
Node 1: load_changed_files
  → fetch changed files from DB

Node 2: traverse_dependency_graph
  → BFS/DFS over dependency edges
  → find all files that import changed files
  → separate direct vs transitive

Node 3: compute_risk_score
  → deterministic function, no LLM involved
  → inputs: fan-out count, core-module flag, diff size, change frequency
  → output: numeric score → mapped to low/medium/high

Node 4: retrieve_similar_bugs
  → embed changed file names + context
  → pgvector similarity search
  → return top 5 similar past analyses

Node 5: build_context
  → assemble structured context string
  → include: changed files, affected modules,
    risk score, similar bugs, project name

Node 6: llm_reasoning
  → send context to Claude/GPT
  → prompt: "Given this risk score and these affected
    modules, explain the impact in plain English and
    suggest tests. Do not override the risk score."
  → parse structured response

Node 7: format_output
  → structure into: affected files,
    risk level, suggested tests, explanation

Node 8: post_github_comment
  → format markdown comment
  → post via GitHub API
  → store comment ID in DB
```

---

## API Endpoints

```
Auth
  GET  /auth/github          → redirect to GitHub OAuth
  GET  /auth/github/callback → handle callback, set session

Organizations
  POST /orgs                 → create organization
  GET  /orgs                 → list user's organizations

Projects
  POST /orgs/{org_id}/projects    → create project, connect repo
  GET  /orgs/{org_id}/projects    → list projects
  GET  /projects/{project_id}     → project detail
  POST /projects/{project_id}/sync → trigger manual re-index

Webhooks
  POST /webhooks/github      → receive GitHub webhook events

Search
  GET  /projects/{project_id}/search?q=payment+processing
                             → semantic search over file embeddings

Analyses
  GET  /projects/{project_id}/analyses      → list analyses
  GET  /analyses/{analysis_id}              → analysis detail
  POST /projects/{project_id}/analyses      → trigger manual analysis
```

---

## Folder Structure

```
codescope/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # settings, env vars
│   ├── database.py                # SQLAlchemy setup
│   ├── models/
│   │   ├── user.py
│   │   ├── organization.py
│   │   ├── project.py
│   │   ├── file_node.py
│   │   ├── dependency.py
│   │   ├── commit.py
│   │   ├── pull_request.py
│   │   └── analysis.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── organizations.py
│   │   ├── projects.py
│   │   ├── webhooks.py
│   │   ├── search.py
│   │   └── analyses.py
│   ├── services/
│   │   ├── github_service.py      # PyGithub wrapper
│   │   ├── indexing_service.py    # parse + embed files
│   │   ├── graph_service.py       # dependency graph logic
│   │   ├── risk_service.py        # deterministic risk scoring
│   │   ├── search_service.py      # vector search
│   │   └── analysis_service.py    # trigger + store analyses
│   ├── workers/
│   │   ├── celery_app.py          # Celery configuration
│   │   ├── indexing_tasks.py      # parse, embed, graph tasks
│   │   └── analysis_tasks.py      # trigger LangGraph
│   ├── ai/
│   │   ├── workflow.py            # LangGraph graph definition
│   │   ├── nodes.py               # individual node functions
│   │   ├── state.py               # TypedDict state
│   │   └── prompts.py             # LLM prompt templates
│   └── utils/
│       ├── parser.py              # AST-based import/class/function parser
│       ├── embeddings.py          # sentence-transformers wrapper
│       └── security.py            # webhook signature verification
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Project.jsx
│   │   │   ├── Analysis.jsx
│   │   │   └── Search.jsx
│   │   └── components/
│   │       ├── AnalysisCard.jsx
│   │       ├── DependencyGraph.jsx
│   │       └── SearchBar.jsx
│   └── package.json
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── .env.example
└── README.md
```

---

## Environment Variables

```bash
# .env
DATABASE_URL=postgresql://codescope:password@db:5432/codescope
REDIS_URL=redis://redis:6379/0

GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret

OPENAI_API_KEY=your_openai_key         # or use Anthropic
ANTHROPIC_API_KEY=your_anthropic_key

SECRET_KEY=your_session_secret_key
```

---

## Docker Compose

```yaml
version: "3.9"
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: codescope
      POSTGRES_PASSWORD: password
      POSTGRES_DB: codescope
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    depends_on: [db, redis]
    env_file: .env

  worker:
    build:
      context: .
      dockerfile: Dockerfile.backend
    command: celery -A workers.celery_app worker --loglevel=info
    depends_on: [db, redis]
    env_file: .env

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

---

## 6-Day Build Plan (Jul 2 → Jul 7)

### Day 1 (Jul 2) — Backend Skeleton
- FastAPI, PostgreSQL, Redis, Celery, Docker Compose
- pgvector extension enabled
- All database models created with SQLAlchemy
- No AI, no LangGraph yet
- **Done when:** `docker compose up` brings up Postgres, Redis, backend, and worker cleanly

### Day 2 (Jul 3) — GitHub Integration
- GitHub OAuth, connect repository, store token, fetch repositories
- Webhook endpoint receives `push` and `pull_request` events and stores them (no processing yet)
- **Done when:** you can connect a real repo and see webhook payloads land in the DB

### Day 3 (Jul 4) — Repository Indexer
- Clone/pull repo → walk files → AST parser → extract imports, classes, functions
- Store files and dependencies → build file-level dependency graph
- Implement BFS traversal for affected-files lookup
- **Done when:** pointing at a real repo gives a correct affected-files list

### Day 4 (Jul 5) — Embeddings
- Generate file-level embeddings, store in pgvector
- Semantic search endpoint working
- (Stretch, only if ahead of schedule: class/function-level embeddings)
- **Done when:** searching "payment processing" returns sensible files

### Day 5 (Jul 6) — Impact Analysis
- LangGraph workflow: graph traversal → risk scoring → vector search → context → LLM reasoning → formatted JSON
- No GitHub posting yet — return JSON only
- **Done when:** a real PR produces a structured JSON analysis with a defensible risk score

### Day 6 (Jul 7) — Polish
- GitHub PR comment posting
- Dashboard, analysis history, semantic search UI
- Test end-to-end on a real open-source repo you didn't build
- README with setup instructions and demo screenshots

---

## What to Say in Interviews

**30-second version:**
"I built CodeScope, an engineering workflow platform that listens to GitHub via webhooks, maintains a live dependency graph and vector index of a Python codebase, computes a deterministic risk score, and runs an AI impact analysis when a PR opens — posting results as a GitHub comment without anyone asking. The AI explains the risk; it doesn't invent it. It's one LangGraph workflow sitting on top of deterministic infrastructure."

**Technical deep-dive topics:**
- Why pgvector over a separate vector database
- How the dependency graph handles circular imports
- Why Celery over FastAPI background tasks
- How webhook idempotency is handled (duplicate events)
- Why risk scoring is computed deterministically before the LLM runs
- The LangGraph state machine and why each node is separate
- How chunking strategy affects semantic search quality
- Why Python-only, file-level-only for v1 (realistic scoping decisions)
- What you'd add next: function-level call graph, TypeScript support, Architecture Explorer

---

## What Makes This Not Just an LLM Wrapper

Remove the LLM and you still have:
- Live dependency graph updated on every push
- Deterministic risk scoring
- Semantic code search across the entire codebase
- Full history of every PR and changed file
- Automated webhook-driven indexing pipeline
- Cross-repository visibility dashboard

Add the LLM and you get:
- Proactive impact analysis without anyone asking
- Natural language explanation of a risk score computed independently of it
- Correlation of current changes with past bugs
- Suggested test files with reasoning

The LLM synthesizes. The infrastructure reasons deterministically. That is the correct architecture.
