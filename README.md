# TravelMate

TravelMate is a trip-planning web application focused on destinations in Malaysia. Visitors can browse destinations and places, while signed-in users can save places and manage itineraries. The application includes an Express API, a React frontend, a Python recommendation service, and an optional local AI assistant.

## Repository layout

| Path | Purpose |
| --- | --- |
| `docs/` | Image credit notes and the reviewed place-import manifest with its evidence files. |
| `src/` | React, TypeScript, and Vite frontend. |
| `backend/` | Express API, Prisma schema and migrations, tests, and backend scripts. |
| `backend/ai/` | Python recommendation code, model files, and evaluation utilities. |
| `public/` | Static frontend assets. |
| `scripts/` | Admin, photo, and privacy checks and utilities. |
| `CREDITS.md` | Image and other asset credits. |

## Requirements and setup

Use Node.js and npm, PostgreSQL, and Python. Ollama is optional and is used by the AI assistant; the example configuration selects `qwen3:8b`. The Prisma packages specified in `backend/package.json` use version range `^7.10.0`; this repository does not specify Node.js, PostgreSQL, or Python runtime versions.

Create a new development database, then copy `.env.example` to `.env` and `backend/.env.example` to `backend/.env`. Set local database credentials and a private JWT signing secret in `backend/.env`. Set `VITE_API_BASE_URL` for the frontend and configure the backend's `CORS_ORIGIN` for the frontend origin. Do not commit environment files.

From the repository root, install the JavaScript dependencies:

```powershell
npm install
Push-Location backend
npm install
```

In `backend/`, create a Python environment with one of:

```powershell
py -m venv .venv
```

or

```powershell
python -m venv .venv
```

Then install the Python requirements, generate Prisma Client, apply migrations, and seed the new development database:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm run db:generate
npx prisma migrate deploy
npm run db:seed
Pop-Location
```

For the optional assistant, install Ollama, then fetch and run the configured model:

```powershell
ollama pull qwen3:8b
ollama serve
```

Start the API from `backend/` with `npm run dev` and the frontend from the repository root with `npm run dev`. The weather feature additionally requires `WEATHER_API_KEY`.

## Catalogue data

`npm run db:seed` creates 36 places in 3 destinations. The repository includes a reviewed 16-entry batch manifest with its evidence files. From `backend/`, run the importer commands:

```powershell
npx tsx scripts/import-place-expansion-batch.ts --commercial-batch
npx tsx scripts/import-place-expansion-batch.ts --commercial-batch --apply
npx tsx scripts/import-place-expansion-batch.ts --commercial-batch
```

The 56-place catalogue used in the demonstration was produced by earlier import batches and a private database snapshot that are not included in this repository.

## Testing

From `backend/`, run the backend checks:

```powershell
npm run typecheck
npm test
```

The observed backend suite contains 34 test files and 268 tests. The security-hardening test checks HTTP headers and served frontend behavior; build the frontend first from the repository root with `VITE_API_BASE_URL=/api` and `npm run build`.

From the repository root, run the 12 frontend tests:

```powershell
node --test scripts/admin/admin-shell.test.mjs scripts/admin/profile-entry.test.mjs scripts/photos/credits-note.test.mjs scripts/photos/overlay-license.test.mjs scripts/photos/placeholder.test.mjs
```

Run the four privacy checks with:

```powershell
node scripts/privacy/privacy-notice.test.mjs
```

The Python test files are `backend/ai/recommendation/test_runner_safety.py` and `backend/ai/data/test_generate_place_candidates.py`.

## Data sources and licences

See `CREDITS.md` for asset credits. OpenStreetMap data is made available under the Open Database License (ODbL). Wikimedia Commons assets retain the licence terms stated by their individual source pages.

## Known limitations

- The security middleware does not set a Content-Security-Policy header.
- Account Settings provides no self-service account deletion or data export.
- Ratings are present for some places; the place model has no review feature.
- Place discovery uses catalogue tools, and personalized recommendations use saved preferences. The chat does not collect preference settings, budget, or trip length through an intake flow; users select itinerary days and slots themselves.
- Itineraries are created and populated by the user; the application does not generate a complete itinerary.
- The Python recommender runs as a new process for each recommendation request.
- The reviewed commercial batch has no imported restaurants for Melaka.
- Map tiles depend on OpenStreetMap access, and itinerary lines show visit order rather than road routes.

## Maintenance utilities

Some utilities under `backend/ai/data`, `backend/ai/evaluation`, `backend/scripts` (report/PDF, import, and validation), and the browser verification tools under `scripts/photos` and `scripts/admin` read or write documentation outputs or private local paths. Those external documentation outputs and private paths are not included in this repository and are not needed to run the application.

## Privacy notice

The public privacy notice is available at `/privacy`.
