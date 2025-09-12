# AGENTS.md - Development Guidelines

## Build/Test Commands
- **Go Backend**: `go build -o ./tmp/main .` (dev with `air` for hot reload)
- **Frontend**: `cd frontend && bun run build` (dev: `bun run dev`)
- **Tests**: Go: `go test ./...`, Frontend: `cd frontend && bun test`
- **Single test**: `go test -run TestFunctionName ./path/to/package`

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
- Naming: PascalCase for components, camelCase for variables/functions
- Imports: React/external libs first, then relative imports
- Forms: Use `react-hook-form` with Zod validation

### General
- No comments unless absolutely necessary for business logic
- Prefer explicit over implicit, readable over clever