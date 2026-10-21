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
frontend on plain HTTP and proxying `/api/*` to the backend).
`docker-compose.yml` runs both plus PostgreSQL 16. It publishes no host
ports: `web` joins the shared `edge` network as `tasktracker-web`.

A single shared Caddy in [`deploy/edge/`](deploy/edge/) owns ports 80 and
443 on the server, terminates HTTPS for every app and routes each domain to
its container. Other apps join the same `edge` network the same way.

Images are built locally and shipped to the server as a tar archive, so the
server never builds anything and needs no source checkout.

### One-time server setup

```sh
docker network create edge
```

Copy [`deploy/edge/`](deploy/edge/) to `~/edge` on the server, then run
`docker compose up -d` inside it. Point each domain's DNS `A` record at the
server and open ports 80 and 443. After editing `caddy/Caddyfile`, reload it:

```sh
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### Tasktracker

Copy `.env.example` to `~/apps/tasktracker/.env` on the server and fill in
real values (at least `POSTGRES_PASSWORD`, `JWT_SECRET`, `CORS_ALLOW_ORIGINS`,
`USE_SECURE_COOKIES=true` and the VAPID keys). Use only letters and digits in
`POSTGRES_PASSWORD`, because it is inserted into `DATABASE_URL` as is.

Build, upload and start a release from your machine (Podman by default, set
`CONTAINER_ENGINE=docker` to use Docker):

```sh
deploy/release.sh deploy@tasktracker.lat
```

The first time, create the admin user on the server:

```sh
cd ~/apps/tasktracker
docker compose exec -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='<password>' app /app/initAdmin
```
