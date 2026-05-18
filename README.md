# News API (Afrolink Assessment)

Production-oriented REST API where **Authors** publish articles and **Readers** consume them. Includes JWT authentication, RBAC, soft deletion, non-blocking read tracking, and a **GMT (UTC) daily analytics** pipeline backed by **pg-boss**.

## Tech stack

| Layer | Choice | Why |
|--------|--------|-----|
| Runtime | Node.js 20+ / TypeScript | Assessment requirement |
| HTTP | Express | Lightweight, widely adopted |
| Database | PostgreSQL + Prisma 5 | SQL-first, type-safe ORM |
| Auth | Argon2 + JWT | Strong password hashing, stateless API auth |
| Validation | Zod | Centralized request schemas |
| Job queue | pg-boss | Postgres-native queue (no extra broker) |
| Tests | Vitest + Supertest | All HTTP routes tested with in-memory repository mocks (assessment bonus) |

## Architecture (SOLID)

```
src/
  config/          # Environment loading
  domain/          # Shared types
  repositories/
    interfaces/    # Abstractions (DIP)
    prisma/        # Concrete persistence
  services/        # Business rules (SRP)
  controllers/     # HTTP adapters
  routes/          # Route wiring
  middleware/      # Auth, RBAC, errors
  jobs/            # Analytics scheduler (pg-boss)
  security/        # Token + password hashing
  validation/      # Zod schemas
  container.ts     # Composition root (DI)
```

- **S**ingle responsibility: controllers only adapt HTTP; services own rules.
- **O**pen/closed: new storage = new repository implementation, same interface.
- **L**iskov: services depend on repository interfaces, not Prisma directly.
- **I**nterface segregation: focused repo contracts (`IUserRepository`, etc.).
- **D**ependency inversion: high-level modules depend on abstractions wired in `container.ts`.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## Setup

```bash
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET

npm install
npx prisma migrate deploy   # or: npm run db:migrate
npm run dev
```

API base URL: `http://localhost:3000`

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (min 16 chars) |
| `JWT_EXPIRES_IN` | Token TTL (default `24h`) |
| `PORT` | HTTP port (default `3000`) |
| `READ_DEDUP_SECONDS` | Logged-in read dedup window (default `60`) |
| `DATABASE_SSL_CA_PATH` | Path to provider CA file (required for **Aiven** in production) |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Optional dev override if you cannot use the CA file yet |

### Aiven PostgreSQL setup

1. In Aiven → your service → **Connection information**, copy **Service URI**.
2. Paste it into `.env` as `DATABASE_URL` (both `postgres://` and `postgresql://` work).
3. Click **CA certificate** → download → save as `certs/aiven-ca.pem`.
4. Add to `.env`:

```env
DATABASE_SSL_CA_PATH=./certs/aiven-ca.pem
```

5. Run migrations:

```bash
npx prisma migrate deploy
npm run dev
```

Without the CA file, `development` still starts by relaxing SSL verification when `sslmode=require`. For production, always use the Aiven CA certificate.

## API overview

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Register (`author` \| `reader`) |
| POST | `/auth/login` | Login → JWT with `sub` + `role` |
| GET | `/auth/me` | Current profile (Bearer) |

### Articles

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/articles` | Public | Published, non-deleted feed (`category`, `author`, `q`, pagination) |
| GET | `/articles/:id` | Public (+ optional JWT) | Article detail + async read log |
| POST | `/articles` | Author | Create article |
| GET | `/articles/me` | Author | Author's articles (drafts included; `includeDeleted=true` optional) |
| PUT | `/articles/:id` | Author | Update own article |
| DELETE | `/articles/:id` | Author | Soft delete (`DeletedAt`) |

### Analytics

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/author/dashboard` | Author | Paginated articles + `TotalViews` from `DailyAnalytics` |

All responses follow the assessment envelope:

```json
{
  "Success": true,
  "Message": "…",
  "Object": {},
  "Errors": null
}
```

Paginated lists add `PageNumber`, `PageSize`, `TotalSize`.

## Analytics job (User Story 6)

- **Queue:** `daily-analytics-aggregation` (pg-boss)
- **Schedule:** `15 0 * * *` in **UTC** (GMT calendar days)
- **Logic:** Sum `ReadLog` rows per `articleId` for each UTC day and **upsert** `DailyAnalytics` (`articleId` + `date` unique)

Manual processing for a day:

```ts
// enqueue via scheduler after app start
await container.analyticsScheduler.enqueueDay("2026-05-17");
```

## Read tracking & refresh spam (bonus)

1. **Non-blocking:** `ReadTrackingService.enqueueRead` uses `setImmediate` so the HTTP response is not delayed by DB writes.
2. **Logged-in dedup:** Within `READ_DEDUP_SECONDS`, the same `readerId + articleId` does not create another `ReadLog`.
3. **Guest dedup (IP-based):** For unauthenticated readers, we use the requester's IP address to deduplicate reads within the same `READ_DEDUP_SECONDS` window. This prevents a guest from inflating view counts by repeatedly refreshing.
4. **Further hardening:** Additional layers like rate limiting at the load balancer or using client-side session IDs could further refine this.

## Scripts

```bash
npm run dev          # hot reload
npm run build && npm start
npm run typecheck    # TypeScript (app + vitest config)
npm test             # Vitest — all HTTP routes, mocked DB
npm run db:migrate   # Prisma migrate dev
```

## Example flow

```bash
# Sign up author
curl -s -X POST localhost:3000/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada Author","email":"ada@test.com","password":"Str0ng!pass","role":"author"}'

# Login
TOKEN=$(curl -s -X POST localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@test.com","password":"Str0ng!pass"}' | jq -r '.Object.token')

# Create & publish
curl -s -X POST localhost:3000/articles \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Hello","content":"Fifty characters minimum content requirement satisfied here.","category":"Tech","status":"Published"}'
```

## License

MIT
