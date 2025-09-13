# AGENTS.md - Development Guidelines

## Build/Test Commands
- **Go Backend**: `go build -o ./tmp/main .` (dev with `air` for hot reload: `air`)
- **Frontend**: `cd frontend && bun run build` (dev: `bun run dev`)
- **Full Stack**: Backend on port 8080, Frontend on port 3000
- **Tests**: Go: `go test ./...`, Frontend: `cd frontend && bun test`
- **Single test**: `go test -run TestFunctionName ./path/to/package`
- **Database Migrations**: Use goose for PostgreSQL migrations in `sql/migrations/`

## Code Style Guidelines

### Go Backend
- Use `gin-gonic/gin` for HTTP routing, `pgx/v5` for PostgreSQL
- Package imports: std lib, third-party, internal (`github.com/vladwithcode/tasktracker/internal/`)
- Error handling: log errors, return structured JSON responses with Spanish messages
- Naming: camelCase for variables/functions, PascalCase for exported items
- Context: pass `context.Context` as first parameter for database operations

### Frontend (React + TanStack Router)
- Use Shadcn components: `bunx --bun shadcn@canary add <component>`
- TypeScript strict mode, functional components with hooks
- Styling: TailwindCSS with utility classes
- State management: TanStack Query for server state, Zustand for client state
- Naming: PascalCase for components, camelCase for variables/functions
- Imports: React/external libs first, then relative imports
- Forms: Use `react-hook-form` with Zod validation

### General
- No comments unless absolutely necessary for business logic
- Prefer explicit over implicit, readable over clever

## Project Structure
- `cmd/`: Go commands (e.g., initAdmin)
- `internal/`: Private Go packages (auth, db, routes)
- `frontend/`: React frontend with Vite
- `sql/migrations/`: Database migration files (using goose)
- `vendor/`: Go vendor directory