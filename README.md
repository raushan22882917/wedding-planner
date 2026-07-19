# MarryMap — AI Wedding Operations

**Repository:** [github.com/raushan22882917/wedding-planner](https://github.com/raushan22882917/wedding-planner)

MarryMap is an AI-assisted wedding operations workspace that turns the fragmented work of planning a wedding into one calm, actionable system. Couples can research and shortlist vendors, manage budget and timelines, import guests, create a published wedding site, communicate through WhatsApp, and run consented AI-assisted vendor availability calls.

## What we created

MarryMap treats a wedding as an operational project rather than a collection of spreadsheets and chat threads. It brings planning, communication, and follow-up into one authenticated workspace:

- **AI planning and research:** Search and save source-backed vendor leads, then convert the right leads into a private vendor shortlist.
- **Wedding operations:** Budget, tasks, timeline, guest management, bulk guest import, and wedding preferences in one dashboard.
- **Wedding website studio:** Choose a visual invitation template, edit each section manually or with AI assistance, publish it, and share one invitation link.
- **WhatsApp-first communication:** Connect a private OpenWA session by QR code; view synced chats and people, open message history, and send only manually approved messages.
- **Availability call campaigns:** Select vendors, confirm consent, optionally include the total budget, and launch a Dograh voice-agent workflow to collect availability, packages, quotes, and follow-up preferences. Results, gathered answers, recording/transcript links, and failures are saved to Supabase. The planner can then explicitly send a detailed WhatsApp or email follow-up.

The central privacy decision is deliberate: Supabase access is scoped per user, API keys never reach the browser, outbound messages require an explicit Send action, and call campaigns require recipient selection, a consent acknowledgement, and a final Start calls action.

## Architecture

```text
TanStack Start + React web app
          │ authenticated server functions
          ▼
Fastify API ───────────────► Supabase (private wedding data)
   │                │
   │                ├────────► OpenWA (QR-linked WhatsApp)
   │                └────────► Dograh (consented voice availability calls)
   ▼
Public-source research providers
```

## Tech stack

- **Web:** React, TypeScript, TanStack Start/Router/Query, Tailwind CSS, shadcn-style components
- **API:** Fastify, TypeScript, Zod, Supabase service client
- **Data & auth:** Supabase Postgres, Row Level Security, Supabase Auth
- **Communication:** [OpenWA](https://github.com/rmyndharis/OpenWA) for a private QR-linked WhatsApp gateway
- **Voice calls:** [Dograh](https://docs.dograh.com/voice-agent/api-trigger) outbound voice-agent workflow and run-result API

## Local setup

### Prerequisites

- Node.js 20.11+ (Node 22 also works)
- npm
- A Supabase project
- Optional: a local OpenWA instance for managed WhatsApp messaging
- Optional: a Dograh deployment with a telephony provider for live availability calls

### 1. Clone and install

```bash
git clone --recurse-submodules https://github.com/raushan22882917/wedding-planner.git
cd wedding-planner
npm ci
```

If the repository was cloned without submodules:

```bash
git submodule update --init --recursive
git -C apps/openwa apply ../../patches/openwa-marrymap.patch
```

### 2. Configure environment variables

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

In `apps/web/.env`, set the same Supabase project URL and publishable key for both regular and `VITE_` variables. Set the API URL:

```bash
SEARCH_BACKEND_URL=http://localhost:3002
```

In `apps/api/.env`, set:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
PORT=3002
CORS_ORIGINS=http://localhost:3000
```

Never commit any `.env` file or service-role/API key.

### 3. Apply database migrations

From the web app directory, authenticate with the Supabase CLI and push the migrations:

```bash
cd apps/web
npx supabase login
npx supabase db push
cd ../..
```

This includes the WhatsApp connection tables and the `voice_call_campaigns` / `voice_call_runs` tables used to save vendor-call outcomes.

### 4. Start the app

Use separate terminals:

```bash
npm run dev:api
npm run dev:web
```

Open `http://localhost:3000` and create an account. The API normally runs at `http://localhost:3002`.

### Optional: managed WhatsApp

Start the local gateway, then use **Messages → Connect WhatsApp** and scan the QR code from WhatsApp → Linked devices:

```bash
npm run whatsapp:gateway
```

### Optional: Dograh availability calls

Create and publish an outbound Dograh workflow with an API Trigger node and a configured telephony provider. Add the following **server-only** values to `apps/api/.env` and restart the API:

```bash
DOGRAH_TRIGGER_URL=https://your-dograh-instance/api/v1/public/agent/your-trigger-uuid
DOGRAH_RUNS_BASE_URL=https://your-dograh-instance
DOGRAH_API_KEY=dg_your_private_key
DOGRAH_WORKFLOW_ID=123
# Optional
DOGRAH_TELEPHONY_CONFIGURATION_ID=1
```

The Calls workspace remains usable without Dograh, but it intentionally will not place any calls until this configuration and the user consent step are complete.

## Demo data and judging path

No seed data is required.

1. Create an account and open **Settings**. Add partner names, wedding date, city, venue, guest count, and a budget.
2. Open **Vendors** and add a vendor, for example: `Riya Studio`, category `Photography`, city `Patna`, phone `9876543210`, email `hello@example.test`. Use a test number—do not use a real contact without permission.
3. Open **Messages** to see the WhatsApp inbox and the **Availability calls** workspace.
4. With OpenWA configured, connect via QR and send a manually approved WhatsApp inquiry.
5. With Dograh configured, select the test vendor, acknowledge consent, start one call, and review the saved outcome. Use **Send WhatsApp details** or **Email details** only after reviewing the result.
6. Open **Wedding website** to select, edit, and publish an invitation website.

## Quality checks

```bash
npm run typecheck
npm run test
npm run build
```

## How GPT-5.6 and Codex accelerated the build

Codex, powered by GPT-5.6, was used as a hands-on engineering collaborator rather than just a code-completion tool.

- **Product flow and UX:** It helped reshape the wedding-site journey from an editor-first experience into template selection → studio editing → publish-and-share, and designed the WhatsApp inbox and availability-call workspace around clear states, accessibility, and explicit actions.
- **Full-stack implementation:** It traced UI requirements through TanStack server functions, the Fastify API, Zod validation, Supabase migrations/RLS, and third-party integrations. This significantly reduced the time needed to connect the user interface to persisted, per-user data safely.
- **Integration decisions:** GPT-5.6 researched the OpenWA and Dograh API contracts, which informed the private QR connection flow, live chat-history fallback, Dograh run synchronization, and server-only credential boundaries.
- **Safety decisions:** Codex proposed and implemented key guardrails: no automatic WhatsApp sends, no browser-visible provider keys, no automatic call launch, a consent acknowledgement before a call campaign, optional budget sharing, bounded campaign sizes, and explicit post-call follow-up actions.
- **Verification:** It repeatedly ran TypeScript checks, production builds, local authenticated-route checks, and Supabase migration deployment, catching server-function and JSON-request edge cases during the build.

The important product decisions—especially the call-consent flow, private credential handling, the choice to make budget sharing opt-in, and manual post-call messaging—were made to keep the automation useful without making it intrusive.

## License

This project is released under the [MIT License](LICENSE). OpenWA and other dependencies remain subject to their own licenses.
