# Multi-Agent Orchestration Platform

## What this is
Four specialised AI agents (planner, executor, critic, plus an API gateway)
coordinate on a task via Pub/Sub. Postgres is the source of truth for state.
Resume project. Must stay inside the GCP free-tier credit.

## Architecture
- 4 Cloud Run services: api-gateway, planner-agent, executor-agent, critic-agent
- Pub/Sub topics: tasks.planning, tasks.execution, tasks.review, tasks.done, tasks.dead-letter
- Push subscriptions with OIDC auth (private services, run.invoker on a service account)
- Cloud SQL for PostgreSQL, db-f1-micro, connected via Auth Proxy Unix socket
- Tables: tasks, subtasks (attempt_count and trace_id live in subtasks)

## Rules
- Region is asia-south1 for everything. Never mix regions.
- Agents are stateless. State lives in Postgres, never in memory.
- At-least-once delivery: every handler must be idempotent.
- Pub/Sub push payload is base64 in message.data. Decode before parsing.
- Return 200 only on success. Do NOT catch errors and return 200 (breaks retries).
- Never hardcode secrets. Use Secret Manager.
- Min instances 0, agent concurrency 1.

## Stack
Node.js, PostgreSQL, Cloud Run, Pub/Sub, Secret Manager.

## Working style
Small steps. Explain tradeoffs briefly. Point out bugs directly.

## Git
- Never run git add, git commit, git push, or create branches. I do all git operations myself.
- You may run read-only commands: git status, git diff, git log.