package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func TestAuthRoutes(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("authtest_%d", time.Now().UnixNano()%1_000_000_000)
	email := username + "@example.com"
	password := "Test1234"
	cleanupRouteTestUser(t, username)
	t.Cleanup(func() { cleanupRouteTestUser(t, username) })

	status, body, cookies, _ := performJSON(router, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    email,
		"fullname": "Auth Test User",
		"password": password,
		"username": username,
	}, nil)
	if status != http.StatusCreated {
		t.Fatalf("register status = %d body = %s", status, body)
	}
	if !strings.Contains(body, `"message":"Cuenta creada"`) {
		t.Fatalf("register body = %s", body)
	}
	if findCookie(cookies, auth.DefaultCookieName) == nil {
		t.Fatalf("expected auth cookie, got %#v", cookies)
	}

	status, body, _, _ = performJSON(router, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    "other-" + email,
		"fullname": "Auth Test User",
		"password": password,
		"username": username,
	}, nil)
	if status != http.StatusConflict || !strings.Contains(body, `"error":"username_taken"`) {
		t.Fatalf("duplicate register status = %d body = %s", status, body)
	}

	status, body, _, _ = performJSON(router, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"fullname": "Auth Test User",
		"password": "abcdefgh",
		"username": username + "weak",
	}, nil)
	if status != http.StatusUnprocessableEntity || !strings.Contains(body, `"error":"validation_error"`) {
		t.Fatalf("weak password status = %d body = %s", status, body)
	}

	status, body, cookies, _ = performJSON(router, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"password": password,
		"username": username,
	}, nil)
	if status != http.StatusOK || !strings.Contains(body, `"message":"Sesión iniciada"`) {
		t.Fatalf("login status = %d body = %s", status, body)
	}
	authCookie := findCookie(cookies, auth.DefaultCookieName)
	if authCookie == nil {
		t.Fatalf("expected login cookie, got %#v", cookies)
	}

	status, body, cookies, _ = performJSON(router, http.MethodPost, "/api/v1/auth/logout", nil, []*http.Cookie{authCookie})
	if status != http.StatusOK || !strings.Contains(body, `"message":"Sesión cerrada"`) {
		t.Fatalf("logout status = %d body = %s", status, body)
	}
	clearedCookie := findCookie(cookies, auth.DefaultCookieName)
	if clearedCookie == nil || clearedCookie.Value != "" || clearedCookie.MaxAge >= 0 {
		t.Fatalf("expected cleared cookie, got %#v", cookies)
	}

	// Legacy `/api/login` and `/api/logout` were removed in the post-MVP
	// hardening pass. Hitting them now must return 404 so callers migrate to
	// the canonical `/api/v1/auth/*` paths.
	status, _, _, _ = performJSON(router, http.MethodPost, "/api/login", map[string]string{
		"password": password,
		"username": username,
	}, nil)
	if status != http.StatusNotFound {
		t.Fatalf("expected legacy /api/login to return 404, got %d", status)
	}

	status, _, _, _ = performJSON(router, http.MethodPost, "/api/logout", nil, nil)
	if status != http.StatusNotFound {
		t.Fatalf("expected legacy /api/logout to return 404, got %d", status)
	}
}

func setupAuthRouteTest(t *testing.T) *gin.Engine {
	t.Helper()

	_ = godotenv.Load("../../.env")
	if os.Getenv("JWT_SECRET") == "" {
		t.Setenv("JWT_SECRET", strings.Repeat("a", 32))
	}
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL is not set")
	}

	pool, err := db.Connect(context.Background())
	if err != nil {
		t.Skipf("database unavailable for route integration test: %v", err)
	}
	t.Cleanup(pool.Close)

	auth.SetAuthParameters()
	gin.SetMode(gin.TestMode)
	return NewRouter()
}

func cleanupRouteTestUser(t *testing.T, username string) {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	_, err = conn.Exec(context.Background(), "DELETE FROM users WHERE username = $1", username)
	if err != nil {
		t.Fatalf("failed to cleanup route test user: %v", err)
	}
}

func performJSON(
	router *gin.Engine,
	method string,
	path string,
	payload map[string]string,
	cookies []*http.Cookie,
) (int, string, []*http.Cookie, http.Header) {
	var body bytes.Buffer
	if payload != nil {
		_ = json.NewEncoder(&body).Encode(payload)
	}

	req := httptest.NewRequest(method, path, &body)
	req.Header.Set("Content-Type", "application/json")
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	return recorder.Code, recorder.Body.String(), recorder.Result().Cookies(), recorder.Result().Header
}

func findCookie(cookies []*http.Cookie, name string) *http.Cookie {
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie
		}
	}

	return nil
}
