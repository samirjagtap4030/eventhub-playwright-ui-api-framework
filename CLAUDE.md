# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EventHub is a full-stack event ticket booking platform (Next.js 14 frontend + Express.js backend) with per-user data sandboxing — each user sees their own dynamic events plus shared static admin events.

## Common Commands

### Development
```bash
npm run setup        # Install deps in backend & frontend
npm run dev          # Start both API (port 3001) + frontend (port 3000) concurrently
```

### Database
```bash
npm run migrate      # Interactive Prisma migration (creates migration files)
npm run db:push      # Non-interactive schema push (no migration files)
npm run seed         # Seed static events + test user
```

### Frontend (from `/frontend`)
```bash
npm run build        # Next.js production build
npm run lint         # ESLint check
npx tsc --noEmit    # TypeScript type check
```

### Testing (Playwright E2E)
```bash
npm run test         # Headless Playwright tests
npm run test:ui      # Playwright interactive UI mode
npm run test:report  # Open HTML test report
```

## Architecture

### Stack
- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, TanStack React Query, Axios
- **Backend**: Express.js, Node.js, Prisma ORM (MySQL 8+), JWT auth, express-validator, Swagger UI
- **Testing**: Playwright E2E (base URL: `https://eventhub.rahulshettyacademy.com`)
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`, `deploy.yml`)

### Backend Layered Architecture (`/backend/src/`)
```
routes/       → Express routers with Swagger JSDoc annotations
controllers/  → Thin HTTP layer; delegates to services
services/     → Business logic, transactions, prune logic
repositories/ → Pure Prisma data access layer
middleware/   → JWT auth validation, error handling, request logging
utils/        → Custom domain errors (NotFoundError, InsufficientSeatsError, etc.)
config/       → Centralized env, database, Swagger config
```

Entry points: `server.js` (bootstrap/DB connect) → `app.js` (Express app setup, routes, error handler)

### Frontend Architecture (`/frontend/`)
```
app/              → Next.js App Router pages
components/       → Feature-grouped: events, bookings, auth, admin, ui, layout
lib/api/          → Axios API clients (events.ts, bookings.ts, auth.ts)
lib/hooks/        → React Query hooks (useEvents, useBookings) + useAuth context
```

Entry point: `app/layout.tsx` wraps everything in `<Providers>` (React Query, Toast, Auth context) and `<AuthGuard>`.

### Auth Flow
- JWT stored in `localStorage`, attached to all requests via Axios request interceptor
- Backend validates via `authMiddleware` (Bearer token → `req.user = { userId, email }`)
- 401 responses trigger auto-logout in Axios response interceptor
- Protected routes use `<AuthGuard>` component in the frontend layout

### Key Data Model Rules
- **`isStatic` events**: Admin-seeded, never decrement seats, never deletable, visible to all users
- **Dynamic events**: User-owned (`userId` field), visible only to owning user
- **Seat tracking**: Computed dynamically by subtracting the requesting user's own bookings
- **FIFO pruning**: Max 9 bookings per user (oldest deleted), max 6 dynamic events per user
- **Booking references**: Format `EVT-XXXXXX` (alphanumeric), stored as unique in DB

### API Base
`http://localhost:3001/api` — Swagger docs at `/api/docs`

Key route groups (all require JWT except `/auth/register` and `/auth/login`):
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET|POST|PUT|DELETE /events`, `GET /events/:id`
- `GET|POST|DELETE /bookings`, `GET /bookings/:id`, `GET /bookings/ref/:ref`
- `DELETE /bookings` (clear all user bookings)
- `GET /health`, `GET /config`

### Environment Variables
```
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/eventhub"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
JWT_SECRET=your_jwt_secret_here
SHOW_EXPLORE_LINKS=false
```

### Frontend Test Selectors (`data-testid`)
Used in Playwright tests: `event-card`, `book-now-btn`, `customer-name`, `customer-email`, `customer-phone`, `confirm-booking-btn`, `booking-ref`, `cancel-booking-btn`, `admin-event-form`, `event-title-input`, `add-event-btn`, `nav-events`, `nav-bookings`
