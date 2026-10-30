# TravelMate Backend

Phase 1 + Phase 2 backend foundation for the AI-assisted Malaysian tourism planning system.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 17+ (for Prisma migration and seed verification)

## Setup

```bash
npm install
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` if the `.env` file does not already exist.

## Environment Variables

```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_URL="<SET_DATABASE_URL>"
```

`CORS_ORIGIN` accepts a comma-separated list for multiple frontend origins.

## Database Setup

1. Install PostgreSQL locally or via a managed service.
2. Create a database named `travelmate_dev`.
3. Update the `DATABASE_URL` in `.env` with the actual local PostgreSQL credentials.
4. Run Prisma generation:

```bash
npx prisma generate
```

5. Run the migration:

```bash
npx prisma migrate dev --name init
```

6. Run the seed script:

```bash
npx prisma db seed
```

7. Start the backend:

```bash
npm run dev
```

## Prisma Structure

```text
backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   └── config/
│       └── env.ts
```

## ERD

The schema models the following core entities:

- User
- UserPreference
- Destination
- Place
- SavedPlace
- Itinerary
- ItineraryItem

## Commands

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Demo preparation

Before starting the demo stack:

1. Close games and browsers using the GPU. Plug in power and select Windows best-performance power mode.
2. Run `nvidia-smi` and check that GPU memory use is below about 1.5 GB before loading the model.
3. From `backend/`, run `npm run warm-ai`, then check `ollama ps` for `qwen3:8b` residency.
4. Start the backend and frontend demo services.

The standalone warm-up script sends one Ollama chat request using the backend's current system instruction, tool definitions and generation options, with `keep_alive: "30m"`. It prints Ollama's load, prompt evaluation and total durations in milliseconds, the local wall time, and the output of `ollama ps`. It does not call the TravelMate API or write to the database.

## API Overview

### Health

```text
GET /api/health
```

Expected response:

```json
{
  "success": true,
  "message": "Backend API is running"
}
```

## Current Phase 2 Scope

Implemented:

- Prisma installation and client setup
- PostgreSQL datasource configuration
- Prisma schema for core travel entities
- seed script for demo data
- database configuration documentation

Not implemented yet:

- JWT authentication
- login/register APIs
- AI integration
- recommendation logic
- admin APIs
- production database deployment
