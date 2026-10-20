# Cosmica Task Tracker

The future app to track task and everything in your life. 

Gym, study, work related tasks, and anything you want to keep track of. 
This app will help you register what you want to do, what you are doing, and when you are done.

Start tracking your everyday and improve your productivity.

## Continuous integration

Every pull request and every push to `prueba-para-bladi`, `main` or `master`
runs the GitHub Actions workflow defined in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). It validates:

- Backend: `go vet`, `go test -count=1 ./...` against a PostgreSQL 16 service
  container with all Goose migrations applied from scratch.
- Frontend: `npm run build` and `npm run test` (Vite + Vitest).
- Forbidden files: fails the build if `.env`, `tmp/`, `*.log`, `*.exe`,
  `node_modules/` or `dist/` are tracked by git.

See [`docs/ci.md`](docs/ci.md) for the full description, environment
variables consumed by the backend, and the local commands to run before
pushing.

## Deployment (Docker)

The `Dockerfile` builds two images: `app` (Go backend, `initAdmin` and Goose
migrations, applied on every start) and `web` (Caddy serving the built
frontend and proxying `/api/*` to the backend, with automatic HTTPS).
`docker-compose.yml` runs both plus PostgreSQL 16.

On the server, create a `.env` next to `docker-compose.yml`:

```env
DOMAIN=tasks.example.com
POSTGRES_PASSWORD=<url-safe random string>
JWT_SECRET=<long random string>
CORS_ALLOW_ORIGINS=https://tasks.example.com
USE_SECURE_COOKIES=true
VAPID_PUBLIC_KEY=<key>
VAPID_PRIVATE_KEY=<key>
VAPID_SUBJECT=mailto:you@example.com
ENABLE_TASK_GENERATOR=true
```

Point the domain's DNS `A` record at the server, open ports 80 and 443, then:

```sh
docker compose up -d --build
docker compose exec -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='<password>' app /app/initAdmin
```

Leave `DOMAIN` unset to serve plain HTTP on port 80 (no TLS). In that case
also leave `USE_SECURE_COOKIES` unset, or the login cookie is rejected.
