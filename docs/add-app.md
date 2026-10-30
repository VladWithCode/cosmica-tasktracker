# Adding another app to the droplet

The droplet that hosts Tasktracker can host any number of other apps, each
in its own Docker Compose project. This guide shows how to add one.

Throughout this guide, replace:

- `myapp` with a short, unique name for the new app.
- `myapp.example.com` with its domain.
- `deploy@tasktracker.lat` with your SSH login for the droplet.

## How the droplet is organized

```
internet ──HTTPS──> edge Caddy (~/edge, the only container with host ports 80/443)
                      ├─ tasktracker.lat    ──> tasktracker-web:80
                      └─ myapp.example.com  ──> myapp-web:<port>
```

- `~/edge` runs one shared Caddy container. It owns ports 80 and 443,
  obtains and renews HTTPS certificates, and routes each domain to a
  container on the shared `edge` Docker network.
- Each app lives in `~/apps/<name>` with its own `docker-compose.yml` and
  `.env`. No source code is needed on the server.
- Images are built on your machine and shipped as a tar archive. The droplet
  has 1 GB of memory and must not build images.

An app needs only three things to fit in:

1. Its public-facing container joins the external `edge` network under a
   unique alias.
2. No container publishes host ports.
3. The edge `Caddyfile` has a block that sends the app's domain to that
   alias.

## 1. Point the domain at the droplet

Create an `A` record for `myapp.example.com` with the droplet's IPv4
address. If you also create an `AAAA` record, it must hold the droplet's
IPv6 address. A wrong `AAAA` record breaks the site in most browsers even
when the `A` record is correct.

Check from your machine before continuing:

```sh
dig +short myapp.example.com A
dig +short myapp.example.com AAAA
```

Caddy cannot obtain a certificate until the record resolves to the droplet.

## 2. Prepare the app's compose file

In the app's repository, write a `docker-compose.yml` that follows these
rules:

- Give every image you build a fixed name with `image:`. The server uses
  these names to find the images you upload, so it never tries to build.
- Put the public-facing service on both the `default` network and the
  external `edge` network, with an alias that starts with the app's name.
  The alias must be unique on the droplet. Do not use generic aliases like
  `web` or `app`.
- Do not add a `ports:` section to any service.
- Keep databases, caches and internal services on `default` only, so other
  apps cannot reach them.
- Store persistent data in named volumes.

Example for an app with a web service and a PostgreSQL database:

```yaml
services:
  db:
    image: docker.io/library/postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: myapp
    volumes:
      - pgdata:/var/lib/postgresql/data

  web:
    image: localhost/myapp-web:latest
    build:
      context: .
    restart: unless-stopped
    env_file: .env
    depends_on:
      - db
    networks:
      default:
      edge:
        aliases:
          - myapp-web

networks:
  edge:
    external: true

volumes:
  pgdata:
```

Image references that the server downloads itself, like `postgres`, should
use the full name (`docker.io/library/...`) so they also work with Podman on
your machine.

## 3. Create a release script

Copy [`deploy/release.sh`](../deploy/release.sh) into the new app's
repository and adjust it:

- Set `remote_dir` to `apps/myapp`.
- Set `images` to the app's image names from `docker-compose.yml`.
- Change the `build` lines to build each of those images. Use one line per
  image, with `--target` only if the `Dockerfile` has several stages to
  pick from.

Keep `--platform linux/amd64` on every build so the images run on the
droplet even if you build on an ARM machine.

## 4. Create the app's `.env` on the droplet

The `.env` file holds secrets, so it never goes through the release script.
Create it once on the server:

```sh
ssh deploy@tasktracker.lat
mkdir -p ~/apps/myapp && cd ~/apps/myapp
nano .env
chmod 600 .env
```

Generate random secrets with `openssl rand -hex 32`. Hex output is safe to
put inside database URLs.

## 5. Release the app

From the app's repository on your machine:

```sh
deploy/release.sh deploy@tasktracker.lat
```

Then check on the droplet that every container is running:

```sh
cd ~/apps/myapp
docker compose ps
docker compose logs --tail 50
```

## 6. Route the domain in the edge Caddy

On the droplet, add a block to `~/edge/caddy/Caddyfile`. Use the alias from
step 2 and the port the container listens on inside Docker (not a host
port):

```
myapp.example.com {
	reverse_proxy myapp-web:3000
}
```

Reload Caddy. A reload applies the new configuration without dropping
existing connections:

```sh
cd ~/edge
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
docker compose logs --tail 30 caddy
```

The logs show when the certificate for the new domain is obtained. This
usually takes a few seconds.

Common variations:

```
# Redirect www to the bare domain
www.myapp.example.com {
	redir https://myapp.example.com{uri} permanent
}

# Static site with no backend: point at a container that serves files,
# or serve them from a folder mounted into the edge container.
docs.example.com {
	reverse_proxy myapp-docs:80
}
```

WebSockets and HTTP/2 work through `reverse_proxy` without extra
configuration.

## 7. Verify

```sh
curl -I https://myapp.example.com
```

Open the site in a browser and check that its API calls succeed in the
DevTools Network tab.

## Requirements for the app itself

- **Real client IP.** Requests reach the app from the edge Caddy, so the app
  sees the proxy's address unless it trusts the `X-Forwarded-For` header
  from Docker networks. Configure the app's framework to trust proxies in
  `172.16.0.0/12`, as Tasktracker does in `internal/routes/routes.go`.
- **HTTPS awareness.** The edge Caddy terminates HTTPS and talks to the app
  over plain HTTP. Mark cookies as `Secure` through configuration (like
  Tasktracker's `USE_SECURE_COOKIES=true`), and do not make the app redirect
  HTTP to HTTPS itself. Caddy already does that, and doing it twice causes a
  redirect loop.
- **Listening address.** The app must listen on `0.0.0.0`, not
  `127.0.0.1`, or the edge Caddy cannot reach it.
- **Memory.** The droplet has 1 GB of memory shared by every app. Check
  headroom before adding an app, and again after it runs for a while:

  ```sh
  free -h
  docker stats --no-stream
  ```

## Removing an app

1. Delete the app's block from `~/edge/caddy/Caddyfile` and reload Caddy.
2. Stop the app:

   ```sh
   cd ~/apps/myapp
   docker compose down
   ```

3. Only if you no longer need its data, delete its volumes. This cannot be
   undone, so back up any database first:

   ```sh
   docker compose down -v
   ```

4. Remove `~/apps/myapp` and run `docker image prune -a` to free disk space.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Browser shows `ERR_CONNECTION_REFUSED` | The edge Caddy is down, or firewalld or the DigitalOcean Cloud Firewall blocks ports 80/443. Check `docker compose ps` in `~/edge` and `sudo firewall-cmd --list-all`. |
| `502 Bad Gateway` | The edge Caddy cannot reach the app. Check that the alias and port in the `Caddyfile` match the compose file, that the service is on the `edge` network, and that the container is running. |
| Certificate errors in the Caddy logs | DNS does not point at the droplet yet, or an `AAAA` record points elsewhere. |
| `permission denied` reading a mounted file | SELinux on Fedora blocks the mount. Add the `z` option to the volume, as in `./config:/etc/myapp:ro,z`. |
| `docker compose up` tries to build or pull the app's image | The `image:` name in `docker-compose.yml` does not match the name in the release script. |
| Container keeps restarting | Read `docker compose logs <service>`. A missing or malformed variable in `.env` is the most common cause. After fixing `.env`, run `docker compose up -d --force-recreate <service>`; a plain restart does not reload it. |

## Instructions for an agent: adding Docker support to an existing project

This section is written for an AI coding agent working in a project
repository that has no Docker setup yet. Your goal is to make the project
deployable on this droplet by following the steps earlier in this guide.
Read the whole guide before you start; the sections above describe the
environment your output must fit.

### Facts about the target environment

- The droplet runs Fedora with SELinux enforcing, 1 GB of memory and an
  x86_64 CPU. It runs Docker Engine with the `docker compose` plugin.
- Images are never built on the droplet. They are built on the developer's
  machine (usually with Podman), saved as a tar archive and loaded on the
  droplet by `deploy/release.sh`.
- A shared Caddy on the external `edge` network terminates HTTPS and
  forwards plain HTTP to each app. Apps never publish host ports and never
  handle TLS.
- Each app lives in `~/apps/<name>` on the droplet. Only
  `docker-compose.yml`, `.env` and the uploaded images are there; there is
  no source code.

### What to deliver

1. **`Dockerfile`** at the repository root, multi-stage:
   - Build stages use the project's own toolchain and lockfile (for
     example `bun install --frozen-lockfile`, `npm ci`, `go build
     -mod=vendor`, `pip install -r requirements.txt`). Pin major versions of
     base images and use fully qualified names (`docker.io/library/...`,
     `docker.io/oven/bun:...`).
   - Runtime stages are small (Alpine or distroless where the stack allows),
     run as a non-root user and contain only what the app needs at runtime.
     Add `tzdata` and `ca-certificates` when the app loads time zones or
     makes outbound HTTPS requests.
   - Use one named target per image (for example `app` and `web`).
2. **`.dockerignore`** that excludes `.git`, `.env*`, dependency folders
   (`node_modules`, `vendor` only if it is not used for builds), build
   output, logs and editor folders. Secrets must never enter an image.
3. **`docker-compose.yml`** that follows step 2 of this guide: fixed
   `image: localhost/<name>-<service>:latest` names, a `build:` section for
   local use, `restart: unless-stopped`, `env_file: .env`, named volumes for
   persistent data, no `ports:`, internal services on `default` only, and
   the public-facing service on `edge` with the alias `<name>-web` (or
   `<name>-<service>` if that reads better).
4. **`deploy/release.sh`** adapted from Tasktracker's script as described in
   step 3.
5. **`.env.example`** listing every environment variable the app reads,
   grouped and commented, with placeholder values only. Search the code for
   every variable it reads (for example `os.Getenv`, `process.env`,
   `import.meta.env`, `os.environ`) instead of guessing. Check the
   repository's `.gitignore` and CI rules; if they would ignore or reject
   `.env.example`, report that instead of changing them silently.
6. **Documentation** in the project's README: how to create `.env` on the
   droplet, how to run `deploy/release.sh`, any one-time setup commands
   (such as creating an admin user) and the exact `Caddyfile` block to add to
   the edge Caddy.

### Application changes that are usually needed

Inspect the code for each item and change it only when it applies:

- **Listening address and port.** The server must listen on `0.0.0.0` and
  read its port from configuration.
- **Missing `.env` file.** In Docker, variables come from `env_file`, not a
  file inside the container. If the app fails when `.env` is absent (for
  example `godotenv.Load()` or `dotenv` with a required flag), make a
  missing file non-fatal while keeping other load errors fatal.
- **Database migrations.** Run them automatically when the container
  starts, before the server, so a release applies them without manual
  steps. Tasktracker's `app` image runs `goose ... up && exec` the server.
- **Proxy trust.** Configure the framework to trust `X-Forwarded-For` from
  `172.16.0.0/12` so the app sees real client IPs. If the project adds its
  own internal reverse proxy (such as a Caddy serving a frontend), that
  proxy must also trust private ranges
  (`servers { trusted_proxies static private_ranges }` in Caddy).
- **HTTPS.** Remove any HTTP-to-HTTPS redirect inside the app. Make
  `Secure` cookies a configuration option and document setting it to
  `true` in production.
- **Frontends.** A single-page app is built in a build stage and served by
  a small Caddy image with an `index.html` fallback, as in Tasktracker's
  `Caddyfile`. If the frontend calls the backend with relative paths
  (`/api/...`), keep both on one domain and let that Caddy proxy the API
  path to the backend container. If it uses an absolute API URL, the URL
  must be set at build time; document this.
- **Memory.** Prefer settings that keep the runtime footprint small, since
  every app shares 1 GB. Do not add services such as Redis or a separate
  database server unless the app already depends on them.

### Verify locally before reporting

Run these checks with Podman (or Docker) on the development machine:

1. Build every target with `--platform linux/amd64` and confirm each build
   succeeds.
2. Start the stack the way the droplet will, behind a stand-in for the edge
   Caddy:

   ```sh
   podman network create edge
   mkdir -p /tmp/edge-test
   printf ':80 {\n\treverse_proxy <alias>:<port>\n}\n' > /tmp/edge-test/Caddyfile
   # start the app's containers on their own network plus edge (with the alias),
   # using a test .env with dummy values
   podman run -d --name edge-test --network edge -p 18080:80 \
     -v /tmp/edge-test:/etc/caddy:ro,z docker.io/library/caddy:2.10-alpine
   curl -i http://localhost:18080/
   ```

   Exercise the main page, a deep link for single-page apps and at least one
   API endpoint. Confirm migrations ran in the logs.
3. Save the images exactly as `deploy/release.sh` does and confirm the
   archive's `manifest.json` lists the expected `localhost/...` names.
4. Remove every test container, network and temporary file you created.

### Boundaries

- Do not deploy, connect to the droplet or edit the edge `Caddyfile`. Hand
  the `Caddyfile` block and any server steps to the human.
- Do not commit secrets, real `.env` values or built images.
- Do not change application behavior beyond what Docker deployment
  requires. List every application code change in your report with the
  reason for it.

### Report

When done, report:

- The files you added or changed.
- The image names, the edge alias and port, and the `Caddyfile` block.
- Every environment variable the app needs, marking which are secrets.
- The verification you ran and its results, including anything you could
  not verify.
- One-time setup steps the human must run on the droplet.
