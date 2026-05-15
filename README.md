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
