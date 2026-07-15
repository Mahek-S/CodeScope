# CodeScope

**CodeScope** is an AI-powered code intelligence platform that helps engineering teams understand the impact of code changes before they are merged. It automatically analyzes repository structure, builds dependency graphs, evaluates pull requests, and provides contextual insights to reduce regression risk and accelerate code reviews.

## Motivation

Understanding the impact of a code change in large codebases is difficult. Developers often have to manually inspect dependencies, trace affected modules, and estimate potential risks before approving a pull request.

CodeScope automates this workflow by combining static code analysis, dependency graph construction, graph traversal algorithms, and LLM-powered reasoning to provide actionable insights directly within the development workflow.

---

## Key Features

- GitHub OAuth authentication
- Organization and project management
- Repository integration with GitHub
- Automatic webhook registration
- Repository synchronization
- Static code parsing using Python AST
- Dependency graph generation
- Impact analysis for pull requests
- Risk scoring for code changes
- Semantic code search
- AI-assisted pull request summaries and explanations

---

## System Architecture

```
                    GitHub
                       │
         OAuth + Webhooks + Repository API
                       │
                       ▼
                FastAPI Backend
                       │
     ┌─────────────────┼──────────────────┐
     │                 │                  │
     ▼                 ▼                  ▼
 PostgreSQL         Redis             Celery
     │                                  │
     └───────────────┬──────────────────┘
                     ▼
            Analysis Services
                     │
      AST Parser • Dependency Graph
      Impact Analysis • Risk Engine
                     │
                     ▼
                AI Reasoning Layer
```

---

## Technology Stack

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- Redis
- Celery
- Docker

### GitHub Integration

- GitHub OAuth
- GitHub Webhooks
- PyGithub

### Code Analysis

- Python AST
- Graph-based dependency analysis

### AI

- LangGraph
- OpenAI API
- Vector Search (planned)

---

## Current Capabilities

- Authenticate users with GitHub OAuth
- Manage organizations and repositories
- Connect GitHub repositories
- Synchronize repositories
- Receive GitHub webhook events
- Store repository metadata
- Build the foundation for automated code intelligence

---

## Project Structure

```
backend/
├── routers/
├── services/
├── models/
├── dependencies/
├── database.py
├── config.py
└── main.py

worker/

docker-compose.yml
```

---

## Running Locally

Clone the repository

```bash
git clone https://github.com/Mahek-S/CodeScope.git
cd CodeScope
```

Create the environment file

```bash
cp .env.example .env
```

Fill in the required GitHub OAuth credentials and secrets.

Start the application

```bash
docker compose up --build
```

Backend

```
http://localhost:8000
```

API Documentation

```
http://localhost:8000/docs
```

---

## Roadmap

- Repository indexing
- Dependency graph construction
- Graph traversal engine
- Incremental repository synchronization
- AI-powered pull request review
- Semantic code search
- Risk prediction engine
- Multi-language support

---

## Future Enhancements

- Java and TypeScript support
- Code ownership analysis
- Architectural drift detection
- CI/CD integration
- VS Code extension
- Enterprise analytics dashboard

---

## License

MIT License