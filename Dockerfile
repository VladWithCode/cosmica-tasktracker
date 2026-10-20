FROM docker.io/oven/bun:1.2 AS web-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

FROM docker.io/library/golang:1.25-alpine AS go-build
ENV CGO_ENABLED=0
WORKDIR /src
RUN go install -tags no_clickhouse,no_libsql,no_mssql,no_mysql,no_sqlite3,no_vertica,no_ydb github.com/pressly/goose/v3/cmd/goose@v3.27.1
COPY go.mod go.sum main.go ./
COPY vendor/ vendor/
COPY cmd/ cmd/
COPY internal/ internal/
RUN go build -mod=vendor -o /out/tasktracker . && go build -mod=vendor -o /out/initAdmin ./cmd/initAdmin

FROM docker.io/library/alpine:3.22 AS app
RUN apk add --no-cache ca-certificates tzdata && adduser -D -H app
WORKDIR /app
COPY --from=go-build /go/bin/goose /usr/local/bin/goose
COPY --from=go-build /out/ /app/
COPY sql/migrations /app/migrations
ENV GIN_MODE=release
USER app
EXPOSE 8080
CMD ["sh", "-c", "goose -dir /app/migrations postgres \"$DATABASE_URL\" up && exec /app/tasktracker"]

FROM docker.io/library/caddy:2.10-alpine AS web
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /src/frontend/dist /srv
