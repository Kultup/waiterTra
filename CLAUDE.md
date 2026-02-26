# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**First-time setup** (installs dependencies for root, server, and client):
```bash
npm run install-all
```

**Run full stack in development** (server + client concurrently):
```bash
npm run dev
```

**Run server only** (nodemon, port 5000):
```bash
npm run server
```

**Run client only** (CRA dev server, port 3000):
```bash
npm run client
```

**Build client for production:**
```bash
cd client && npm run build
```

**Run client tests:**
```bash
cd client && npm test
```

## Environment

The server reads from a `.env` file in `server/`:
- `MONGODB_URI` — defaults to `mongodb://localhost:27017/hr-system`
- `PORT` — defaults to `5000`

`client/.env` contains `HOST=0.0.0.0` which makes the CRA dev server bind to all network interfaces. The API URL is resolved dynamically via `window.location.hostname`, so the app works on both `localhost` and any LAN IP without configuration.

To find your LAN IP on Windows: `ipconfig` → look for IPv4 Address (e.g. `192.168.1.50`). Then share `http://192.168.1.50:3000` with students on the same network. The server on port `5000` is also accessible at the same IP.

## Architecture

This is a Ukrainian-language HR/training system for hospitality staff. It has two distinct user-facing roles:

- **Admin** — accesses `http://localhost:3000/` (the `AdminPanel` layout with sidebar)
- **Student/Candidate** — accesses `http://localhost:3000/test/:hash` (a standalone test page)

### Backend (`server/index.js`)

A single-file Express server. All Mongoose schemas and all route handlers are defined together in `server/index.js` — there are no separate model or route files.

**Models:**
- `Employee` — HR employee records
- `DeskItem` — individual items currently placed on the live virtual desk (persisted per session)
- `DeskTemplate` — saved named layouts (array of positioned dish items + optional time limit)
- `DeskTest` — a test instance created from a template; identified by a random 16-character hex `hash`
- `TestResult` — stores student submission outcomes (score, percentage, pass/fail)

**Key API routes:**
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PUT/DELETE | `/api/employees/:id?` | Employee CRUD |
| GET/POST/DELETE | `/api/desk-items/:id?` | Live desk state |
| GET/POST/PUT/DELETE | `/api/templates/:id?` | Desk templates |
| POST | `/api/tests` | Create test from `templateId`, returns hash |
| GET | `/api/tests/:hash` | Fetch test + populated template (used by student) |
| POST/GET | `/api/test-results` | Submit and list results |

### Frontend (`client/src/`)

React 18 with React Router v7. `API_URL` is defined once in `client/src/api.js` using `window.location.hostname` so it adapts automatically to any host (localhost or LAN IP). All components import from there.

**Routing split in `App.js`:**
- `/test/:hash` → `StudentTest` (no sidebar, public)
- `/*` → `AdminPanel` (sidebar nav wrapping sub-routes)

**Admin sub-routes:** `/` or `/dashboard` → Dashboard, `/virtual-desk` → VirtualDesk, `/test-results` → TestResults, `/settings` → placeholder.

### Core Flow: Test Creation and Grading

1. Admin uses **VirtualDesk** to place dish items (from a fixed `dishList`) on a 500×500 logical grid by clicking. Items are persisted to `DeskItem` in MongoDB.
2. Admin saves the current layout as a **DeskTemplate** (with optional time limit).
3. Admin clicks "Copy link" or "Share to Telegram" on a template — this POSTs to `/api/tests` which creates a `DeskTest` with a random hash and returns the shareable URL.
4. Student opens the URL, registers (first name, last name, position), then arranges dishes on a local-only desk (items are NOT saved to DB during a student test).
5. On submit, the client scores locally: each student item within **50px tolerance** of a matching template item (by type + coordinates) counts as correct. Passing threshold is **≥80%**.
6. Result is POSTed to `/api/test-results` and displayed immediately. Admin views results in TestResults.
