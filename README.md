# MarryMap

MarryMap is an AI-assisted wedding planning workspace. This repository is an npm workspace monorepo with independently deployable web and API applications.

## Structure

```text
apps/
  web/        TanStack Start + React client
  api/        Fastify search and document-ingestion API
  openwa/     OpenWA gateway (pinned Git submodule)
```

The apps keep separate environment files and deployment lifecycles, while the root provides one place to build, test, and type-check the whole product.

## Getting started

Use Node.js 20.11 or later. From the repository root, install the workspace dependencies:

```bash
git submodule update --init --recursive
npm install
```

The OpenWA submodule is pinned to a tested upstream commit. MarryMap's small
compatibility adjustment for WhatsApp Web is preserved in
[`patches/openwa-marrymap.patch`](patches/openwa-marrymap.patch). Apply it once
after initialising the submodule:

```bash
git -C apps/openwa apply ../../patches/openwa-marrymap.patch
```

For a local Docker gateway bound only to your computer, use the checked-in
override file:

```bash
docker compose -f apps/openwa/docker-compose.yml -f infra/openwa/docker-compose.marrymap.yml up
```

Run each app in its own terminal:

```bash
npm run dev:web
npm run dev:api
```

The web app uses its own Supabase configuration in `apps/web/.env`; the API configuration is in `apps/api/.env`. Start from each app's `.env.example` file and never commit real secrets.

## Quality commands

```bash
npm run typecheck
npm run test
npm run build
```

The API can also be built into a standalone container:

```bash
docker build -f apps/api/Dockerfile apps/api
```

## Application docs

- [Web application](apps/web/package.json)
- [API setup and endpoint guide](apps/api/README.md)
