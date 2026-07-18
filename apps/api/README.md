# Scrape & Fetch Backend

TypeScript/Supabase API for authorized public-source scraping, document ingestion, and full-text search. Wedding-planner domain logic lives elsewhere; this service only registers sources, queues fetch jobs, stores its indexed data in `search_documents`, and serves search.

It deliberately does **not** bypass logins, robots rules, paywalls, or platform access controls. Only add sources you are authorized to retrieve, and configure an allow-list in production.

## Included

- Source registry for a single webpage, RSS/Atom feed, or semantic web-search query
- Background scrape jobs with atomic claiming, retries, status/error tracking, and horizontally safe workers
- Manual document ingest with content hashing and deduplication
- Weighted `tsvector` search with ranking, highlighting, date/source filters, and search analytics
- Agent Reach-compatible providers: Jina Reader for webpages, XML/RSS retrieval, and Exa via its API or the local `mcporter` route
- Bearer-token validation against Supabase Auth, rate limiting, CORS, Helmet headers, SSRF guard, timeouts, response-size limits, and an optional outbound-host allow-list
- OpenAPI UI at `/docs`, health endpoint, and a small safety test suite

## Setup

```bash
cd apps/api
cp .env.example .env
npm install
npm run supabase:push
npm run dev
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` before starting. For a local API smoke test without Supabase Auth, use `SUPABASE_AUTH_REQUIRED=false`; set it to `true` for every deployed environment.

Apply the migration in `supabase/migrations/`. It is designed for a standard Supabase Postgres project and needs no vector extension.

## Agent Reach provider configuration

Web and RSS use the public Jina Reader/RSS routes described by Agent Reach. For semantic web search, choose one:

```bash
# Preferred server integration: Exa API
EXA_PROVIDER=api
EXA_API_KEY=...

# Or use the Agent Reach local MCP route. `mcporter` must be installed in the container/host.
EXA_PROVIDER=mcporter
MCPORTER_BIN=mcporter
# Path is resolved from apps/api when using the monorepo dev command.
MCPORTER_CONFIG=../../config/mcporter.json
```

The `mcporter` invocation uses `spawn(..., { shell: false })` and passes the user query as a JSON string; it never interpolates the query into a shell command.

Set `SCRAPER_ALLOWED_HOSTS=example.com,feeds.example.org` in production. An empty value permits public hosts but still blocks loopback, private, and link-local addresses.

## Dashboard vendor research

The web dashboard can create a `web_search` source and queue a scrape job. When it finishes, the source documents (including any public contact, map, and image links extracted from the content) appear in the dashboard and are available to the AI planner.

For that flow, configure both applications against the same Supabase project:

- `apps/api/.env` needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RUN_WORKER=true`, and an enabled search provider. The Agent Reach installer creates `config/mcporter.json` at the monorepo root; use `EXA_PROVIDER=mcporter` and `MCPORTER_CONFIG=../../config/mcporter.json` so the API can resolve it when started from `apps/api`. Alternatively use `EXA_PROVIDER=api` with `EXA_API_KEY`.
- `apps/web/.env` needs `SEARCH_BACKEND_URL` pointed at this API (for example, `http://localhost:3002`).

The API deliberately stores and displays only public-source information. A research query never claims live availability or invents contact details when a source does not contain them.

## WhatsApp-first vendor communication

MarryMap includes the official [OpenWA](https://github.com/rmyndharis/OpenWA) source in `apps/openwa`. For local development, start the gateway from the repository root:

```bash
npm run whatsapp:gateway
```

The development gateway is bound to `127.0.0.1`, and MarryMap configures the local connection automatically. When a signed-in user chooses **Connect WhatsApp** on the Messages page, MarryMap creates a private OpenWA session for that user and shows the gateway QR code. The user scans it in WhatsApp → Linked devices. MarryMap stores only the user-to-session mapping in Supabase; it never sends gateway credentials or another user's session ID to the browser.

For a remote or production gateway, set `OPENWA_USE_LOCAL_GATEWAY=false` plus both `OPENWA_BASE_URL` and `OPENWA_API_KEY` in the API environment. Use a dedicated, least-privilege OpenWA **OPERATOR** key.

The API exposes authenticated status, connection, QR, conversation-history, and send routes. A message is sent only after the user explicitly presses Send. If OpenWA is not configured, users can still open their WhatsApp app or WhatsApp Web with a prefilled message.

## Dograh availability calls

MarryMap can run consented vendor availability calls with a private [Dograh voice-agent workflow](https://docs.dograh.com/voice-agent/api-trigger). In Dograh, configure a telephony provider, create and publish an outbound workflow that captures availability, package, price, and follow-up preferences, then copy its API Trigger URL.

Set the following server-only variables in `apps/api/.env`:

```bash
DOGRAH_TRIGGER_URL=https://your-dograh-instance/api/v1/public/agent/your-trigger-uuid
DOGRAH_RUNS_BASE_URL=https://your-dograh-instance
DOGRAH_API_KEY=dg_your_private_key
DOGRAH_WORKFLOW_ID=123
# Optional: select a specific Dograh telephony configuration
DOGRAH_TELEPHONY_CONFIGURATION_ID=1
```

On **Messages → Availability calls**, the planner selects vendors, chooses whether to share the total budget, and confirms consent before any call can begin. MarryMap stores the call run, gathered answers, transcript/recording links, and failed-call reasons per wedding. While the page is open, it synchronizes the active Dograh runs automatically. Follow-up WhatsApp and email actions remain explicit user actions.

## API workflow

All `/v1/*` endpoints require `Authorization: Bearer <Supabase access token>` when `SUPABASE_AUTH_REQUIRED=true`.

```bash
# 1. Register a webpage or feed source
curl -X POST http://localhost:3000/v1/sources \
  -H 'content-type: application/json' -H 'authorization: Bearer <token>' \
  -d '{"name":"Vendor feed","kind":"rss","url":"https://feeds.example.org/vendors.xml"}'

# 2. Queue a scrape job
curl -X POST http://localhost:3000/v1/sources/<source-id>/jobs \
  -H 'authorization: Bearer <token>'

# 3. Poll job status, then search indexed documents
curl http://localhost:3000/v1/jobs/<job-id> \
  -H 'authorization: Bearer <token>'
curl -G http://localhost:3000/v1/search --data-urlencode 'q=photographer' \
  -H 'authorization: Bearer <token>'
```

Key endpoints:

| Method                     | Path                         | Purpose                                       |
| -------------------------- | ---------------------------- | --------------------------------------------- |
| `POST` / `GET`             | `/v1/sources`                | Register and list sources                     |
| `GET` / `PATCH` / `DELETE` | `/v1/sources/:sourceId`      | Manage a source                               |
| `POST`                     | `/v1/sources/:sourceId/jobs` | Queue scrape work                             |
| `GET`                      | `/v1/jobs/:jobId`            | Poll job status                               |
| `POST`                     | `/v1/documents`              | Securely ingest an authorized manual document |
| `DELETE`                   | `/v1/documents/:documentId`  | Delete an indexed document                    |
| `GET`                      | `/v1/search?q=...`           | Full-text search with rank/snippets/filters   |

## Production notes

- Put the API and worker in separate deployments for high volume. Set `RUN_WORKER=false` in API replicas and `true` in worker replicas; `claim_scrape_job()` prevents duplicate claims.
- Use a dedicated service-role secret only in this server. Do not expose it in a frontend.
- For RSS/web source scheduling, trigger the job endpoint from a scheduler (Supabase Cron, GitHub Actions, or your platform scheduler) with an appropriate service account.
- The supplied providers are intentionally bounded to one-page/RSS/search-result ingestion. Add per-site providers only where you have permission and a compliant access route.
