# Continuous Integration

GitHub Actions runs the workflow defined in
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) on every pull
request and on every push to `prueba-para-bladi`, `main` and `master`.

The workflow is split into three independent jobs that can run in parallel.

## What the CI validates

### Job 1 — `forbidden-files`

A small guard step that fails the build if any of these paths are found in
the git index:

- `.env` and `.env.<anything>`
- `cookies.txt`
- Anything inside `tmp/`
- Anything inside `.claude/`
- Anything inside `frontend/node_modules/`, `frontend/dist/`, or top-level
  `dist/`
- Any `*.log`
- Any `*.exe`

The guard is intentionally narrow: it matches real path components, never a
substring inside legitimate filenames. It does **not** scan file contents,
so legitimate references to environment variable names like
`VAPID_PRIVATE_KEY` inside `os.Getenv(...)` calls do not trigger false
positives.

### Job 2 — `backend`

Runs against a fresh PostgreSQL 16 service container.

Steps:

1. `actions/checkout@v4`.
2. `actions/setup-go@v5` with the project's Go version (1.24.5) and module
   cache enabled.
3. Waits up to 60 seconds for the PostgreSQL service to become ready
   (`pg_isready` health check).
4. Installs Goose 3.27.1 (`go install github.com/pressly/goose/v3/cmd/goose@v3.27.1`).
5. Applies all migrations from scratch
   (`goose -dir sql/migrations postgres "$DATABASE_URL" up`).
6. Reports `goose status` for visibility.
7. Runs `go vet ./...`.
8. Runs `go test -count=1 ./...`. Integration tests in
   `internal/routes/*_test.go` connect to the service container via
   `DATABASE_URL`, so they actually execute (no `t.Skip` due to missing DB).

The PostgreSQL service is configured with **dummy CI credentials**:

| Variable | CI value | Notes |
| --- | --- | --- |
| `POSTGRES_USER` | `postgres` | Default service user |
| `POSTGRES_PASSWORD` | `postgres` | Dummy, only valid inside the container |
| `POSTGRES_DB` | `tasktracker` | Matches the project's database name |
| Host port | `55432` | Same port as the local development cluster |

These credentials never match anything used in real environments. **Never
put production credentials in this workflow file.**

### Job 3 — `frontend`

Steps:

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` with Node 20 LTS (compatible with Vite 6 and
   Vitest 3).
3. Detects whether `frontend/package-lock.json` exists:
   - if it exists, runs `npm ci` for a deterministic install;
   - otherwise falls back to `npm install --no-audit --no-fund`.
4. `npm run build` (Vite production build + `tsc`, plus the PWA service
   worker bundle).
5. `npm run test` (Vitest, headless).

`bun.lock` is not consumed by the CI: GitHub-hosted runners use npm because
the project is npm-script driven and bun is only used optionally during
local development.

## Recommended local commands before pushing

Run the same checks locally to catch problems before opening a PR:

```bash
# Backend (requires PostgreSQL on 127.0.0.1:55432 with database "tasktracker")
go vet ./...
go test -count=1 ./...

# Frontend (from repo root)
cd frontend
npm install        # or `npm ci` if you have package-lock.json
npm run build
npm run test
cd ..

# Migrations from a clean database (Goose 3.27.1)
goose -dir sql/migrations postgres "$DATABASE_URL" status
```

If you do not have PostgreSQL running, the integration tests in
`internal/routes/*_test.go` are designed to `t.Skip` gracefully. Unit tests
under `internal/auth` will still run.

For a temporary local cluster you can rely on the `tmp/phase5-pgdata`
folder used in earlier phases:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D 'tmp\phase5-pgdata' -l 'tmp\local-pg.log' -o '-p 55432' start

# ... run tests ...

& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D 'tmp\phase5-pgdata' stop
```

## Environment variables consumed by the backend

The full list of variables the backend reads from the environment is:

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | All database access | `postgres://user:pass@host:port/db?sslmode=...` |
| `PORT` | HTTP server port | Defaults to `8080` if unset |
| `JWT_SECRET` | Signing/verifying auth tokens | Use a long random string in real environments |
| `CORS_ALLOW_ORIGINS` | CORS middleware | Comma-separated list of allowed origins |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `cmd/initAdmin` only | Only used by the seeder binary, never read at runtime |
| `USE_SECURE_COOKIES` | Production hardening | Set to `true` over HTTPS |
| `USE_HTTP_ONLY_COOKIES` | Cookie hardening | Defaults to `true` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push (Phase 8) | Production needs real VAPID keypair generated via `webpush-go` |

The CI workflow injects dummy values for all of these. Tests that exercise
Web Push behaviour (`internal/routes/notifications_phase8_test.go`) override
them with `t.Setenv` so they do not depend on the workflow defaults being
cryptographically valid.

## Secrets and how to add them

Anything sensitive (real VAPID keys, production database URL, deploy tokens,
etc.) **must** live in GitHub Actions secrets, exposed at workflow time
through `${{ secrets.<NAME> }}`.

Never commit:

- `.env` or any `.env.<environment>` file.
- A real `JWT_SECRET`, `VAPID_PRIVATE_KEY`, or production `DATABASE_URL`.
- Cookies, tokens, API keys, or vendor credentials.
- Backups of `tmp/`, logs, executables.

The `forbidden-files` job exists precisely to fail the build if one of
those slips into a commit.
