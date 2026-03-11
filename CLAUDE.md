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

**Run server tests:**
```bash
cd server && npm test
```

**Run a single server test file:**
```bash
cd server && npx jest tests/auth.test.js --detectOpenHandles --forceExit
```

**Run client tests:**
```bash
cd client && npm test
```

**Build client for production:**
```bash
cd client && npm run build
```

## Environment

`server/.env` variables:
- `MONGODB_URI` — defaults to `mongodb://localhost:27017/serviq`
- `PORT` — defaults to `5000`
- `JWT_SECRET` — required for authentication
- `JWT_EXPIRES_IN` — defaults to `8h`

`client/.env` contains `HOST=0.0.0.0` which binds to all network interfaces. The `API_URL` in `client/src/api.js` uses `window.location.hostname` so it adapts to localhost or any LAN IP automatically.

## Architecture

A Ukrainian-language training/assessment system for hospitality staff. The app is split into public student-facing pages (accessed via shareable hash links) and an authenticated admin panel.

### Authentication & Roles

JWT-based auth. Token stored in `localStorage`. The `auth` and `checkRole` middleware live in `server/middleware/authMiddleware.js`.

User roles and their access:
- `superadmin` — full access including user/city management
- `admin` — can create content and view their own results
- `trainer` — can build visual games and quizzes, view results
- `viewer` — read-only, filtered by their assigned `city`
- `localadmin` — sees only the Analytics dashboard (city-level oversight)

On first run with an empty DB, call `POST /api/auth/register-root` to create the initial superadmin. A system `localadmin` user (`kultup`) is auto-created on startup via `ensureSystemUsers()`.

### Backend (`server/`)

The server is modular: `server/index.js` bootstraps Express and mounts routers, all business logic lives in separate files.

**Directory structure:**
```
server/
  index.js              — Bootstrap, middleware, router mounting
  middleware/
    authMiddleware.js   — JWT auth + role-checking middleware
  models/               — Mongoose schemas (one file per model)
  routes/               — Express routers (one file per domain)
  utils/logger.js       — Winston logger
  uploads/              — Uploaded files (auto-created)
  tests/                — Jest + supertest integration tests
```

**Models:**
- `User` — admin accounts with role + optional city assignment
- `City` — city registry for multi-city data isolation
- `DeskItem` — items on the live virtual desk (persisted per admin session)
- `DeskTemplate` — saved named desk layouts with optional time limit
- `DeskTest` / `MultiDeskTest` — single/multi-desk test instances (identified by random hex `hash`)
- `TestResult` — desk test submissions
- `GameScenario` / `GameLink` / `GameResult` — branching scenario game
- `Quiz` / `QuizLink` / `QuizResult` — multiple-choice quiz
- `ComplexTest` / `ComplexTestLink` / `ComplexTestResult` — combined multi-module test
- `PageView` — analytics tracking (every student page load)

**Key API routes:**
| Path | Purpose |
|------|---------|
| `POST /api/auth/login` | Login, returns JWT |
| `GET /api/auth/me` | Get current user |
| `GET/POST/PUT/DELETE /api/auth/users` | User management (superadmin) |
| `GET/POST/DELETE /api/desk-items` | Live desk state |
| `GET/POST/PUT/DELETE /api/templates` | Desk templates |
| `POST /api/tests` | Create desk test from template, returns hash |
| `GET /api/tests/:hash` | Fetch test (public, student-facing) |
| `POST/GET /api/test-results` | Submit and list desk test results |
| `GET/POST/PUT/DELETE /api/game-scenarios` | Branching game scenarios |
| `GET/POST /api/game-links` | Create/fetch game links by hash |
| `POST/GET /api/game-results` | Submit and list game results |
| `GET/POST/PUT/DELETE /api/quiz` | Quiz management |
| `GET/POST/PUT/DELETE /api/complex-tests` | Complex test management |
| `GET /api/cities` | City list (public) |
| `POST/DELETE /api/cities` | City management (superadmin) |
| `GET /api/stats/overview` | Dashboard statistics |
| `GET /api/analytics/overview` | Analytics overview (localadmin) |
| `GET /api/analytics/traffic` | Daily traffic chart data |
| `GET /api/analytics/tests` | Top tests by views |
| `POST /api/upload` | File upload (multer) |

**Data isolation:** Non-superadmin users only see content they own (`ownerId: req.user._id`). `viewer` role is additionally filtered by `city`. The analytics routes require `localadmin` role via `checkRole(['localadmin'])`.

### Frontend (`client/src/`)

React 18 with React Router v7. All API calls use `API_URL` from `client/src/api.js`.

**Public routes (no login required):**
- `/test/:hash` → `StudentTest` — desk placement test
- `/game/:hash` → `GamePlay` — branching scenario game
- `/quiz/:hash` → `QuizPlay` — multiple-choice quiz
- `/multi-test/:hash` → `MultiDeskTest` — multi-desk test
- `/complex/:hash` → `ComplexTestPlay` — combined test
- `/inactive` → `InactiveTest` — expired link page

**Admin routes (authenticated):**
- `/*` → `AdminPanel` with `Sidebar` layout
- `localadmin` role is restricted to `/analytics` only — all other routes redirect there

**Admin sub-routes by role:**
- `/dashboard` — Dashboard (all roles except localadmin)
- `/analytics` — Analytics (localadmin + superadmin sees via Dashboard)
- `/virtual-desk` — Desk builder (superadmin, admin)
- `/visual-builder` — Visual game builder (superadmin, admin, trainer)
- `/quiz-builder` — Quiz builder (superadmin, admin, trainer)
- `/complex-builder` — Complex test builder (superadmin, admin)
- `/test-results` — All result types (all roles)
- `/users` — User management (superadmin)
- `/cities` — City management (superadmin)

### Core Test Flow (Desk Test)

1. Admin places dish items on a 500×500 logical grid in **VirtualDesk** → persisted to `DeskItem`.
2. Admin saves layout as a **DeskTemplate** (with optional time limit).
3. Admin shares a template — client POSTs to `/api/tests`, creating a `DeskTest` with a random 16-char hex hash.
4. Student opens the URL, registers (name, position), then arranges dishes locally (NOT saved to DB).
5. On submit, client scores locally: each item within **50px tolerance** of a matching template item (by type + coordinates) is correct. Pass threshold: **≥80%**.
6. Result is POSTed to `/api/test-results` and shown immediately.

### Analytics Tracking

Every student page load calls `PageView.create(...)` server-side (fire-and-forget). The `PageView` model records `testType`, `hash`, `ownerId`, `city`, and `ip`. The `/api/analytics` routes aggregate this for the `localadmin` dashboard.
