# Krishi Sathi

A bounded, evidence-grounded agricultural research agent. This repository is a **starter scaffold** for Milestone 0 / Milestone 1; it is not an integration into any pre-existing Krishi Sathi codebase.

## Locked project decisions
- Initial use case: agricultural research.
- Start with one bounded agent runtime; evolve to a multi-agent platform later.
- Backend: Node.js + Express + TypeScript.
- AI: Gemini behind a server-side model adapter.
- Database: Supabase PostgreSQL.
- Weather: Open-Meteo.
- Initial tools: read-only.
- Deterministic agricultural engines remain authoritative for calculations.

## Quick start
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in server-side credentials.
3. Install dependencies: `npm install`
4. Run type-check: `npm run typecheck`
5. Run tests: `npm test`
6. Start the development server: `npm run dev`

The HTTP server starts at `http://localhost:5000`. `GET /health` is available without credentials. The starter research endpoint is intentionally a placeholder until authentication, trusted retrieval tools and the Gemini adapter are implemented.

## Repository layout
- `docs/` product, architecture, contracts, backlog and acceptance criteria.
- `src/agentic/` bounded runtime, typed contracts, tool registry and evidence handling.
- `src/server/` minimal Express entry point.
- `database/migrations/` draft SQL only. Do not apply before reconciling with the existing Supabase schema, auth model and RLS conventions.
- `tests/` unit, integration and security test locations.

## Safety boundaries
The model does not enforce its own permissions. The runtime enforces step, evidence, timeout and tool limits. Retrieved documents are untrusted data, not instructions. No shell, arbitrary code execution, farm-record mutation, purchasing, spraying or equipment control is enabled in this starter.

## Before integrating with an existing application
Audit its package manager, scripts, environment conventions, API layout, Supabase schema/RLS, authentication, deterministic agricultural engines and test suite. Merge this scaffold additively; do not replace working application files blindly.
