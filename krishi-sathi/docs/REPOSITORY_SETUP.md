# Repository Setup

## Prerequisites
- Node.js 20+
- npm
- Git

## Local setup
```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run dev
```

## Git initialization
```bash
git init
git add .
git commit -m "chore: initialize Krishi Sathi agentic starter"
```

## Integration checklist
Before merging into an existing project, inspect package scripts, frontend/backend layout, authentication, Supabase schema and RLS, deterministic agricultural engines, existing Gemini usage, Open-Meteo integration and regression tests. Merge additively.

## Database warning
The SQL file in `database/migrations` is a draft reference only. Do not apply it until reconciled with existing schema, naming, auth ownership model and RLS policies.
