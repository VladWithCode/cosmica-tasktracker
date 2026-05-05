package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/vladwithcode/tasktracker/internal/db"
)

func TestNotificationPublicKeyEndpoint(t *testing.T) {
	router := setupAuthRouteTest(t)
	t.Setenv("VAPID_PUBLIC_KEY", "phase8-public-key")

	status, body, _, _ := performJSONPayload(router, http.MethodGet, "/api/v1/notifications/vapid-public-key", nil, nil)
	if status != http.StatusOK {
		t.Fatalf("public key status = %d body = %s", status, body)
	}

	var envelope struct {
		Data struct {
			PublicKey string `json:"publicKey"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		t.Fatalf("decode public key response: %v body=%s", err, body)
	}
	if envelope.Data.PublicKey != "phase8-public-key" {
		t.Fatalf("expected configured public key, got %q", envelope.Data.PublicKey)
	}
}

func TestNotificationPublicKeyMissingConfig(t *testing.T) {
	router := setupAuthRouteTest(t)
	t.Setenv("VAPID_PUBLIC_KEY", "")

	status, body, _, _ := performJSONPayload(router, http.MethodGet, "/api/v1/notifications/vapid-public-key", nil, nil)
	if status != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for missing public key, got %d body=%s", status, body)
	}
}

func TestNotificationSubscriptionLifecycle(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("phase8owner_%d", time.Now().UnixNano()%1_000_000_000)
	otherUsername := fmt.Sprintf("phase8other_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, ownerUsername)
	cleanupTaskRouteUser(t, otherUsername)
	t.Cleanup(func() {
		cleanupTaskRouteUser(t, ownerUsername)
		cleanupTaskRouteUser(t, otherUsername)
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	otherCookie := registerPhase5User(t, router, otherUsername, password)
	ownerID := getPhase8UserID(t, ownerUsername)
	endpoint := "https://example.com/push/" + ownerUsername
	validPayload := map[string]interface{}{
		"endpoint": endpoint,
		"keys": map[string]string{
			"auth":   "auth-key",
			"p256dh": "p256dh-key",
		},
	}

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/notifications/subscriptions", validPayload, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("subscribe status = %d body = %s", status, body)
	}
	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/notifications/subscriptions", validPayload, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("duplicate subscribe status = %d body = %s", status, body)
	}
	if countPhase8Subscriptions(t, ownerID, endpoint) != 1 {
		t.Fatalf("expected duplicate subscribe to keep one row")
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/notifications/subscriptions", map[string]interface{}{
		"endpoint": "https://example.com/push/invalid",
		"keys": map[string]string{
			"auth": "auth-key",
		},
	}, []*http.Cookie{ownerCookie})
	if status != http.StatusBadRequest {
		t.Fatalf("expected invalid payload 400, got %d body=%s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodDelete, "/api/v1/notifications/subscriptions", map[string]string{
		"endpoint": endpoint,
	}, []*http.Cookie{otherCookie})
	if status != http.StatusOK {
		t.Fatalf("other user unsubscribe status = %d body = %s", status, body)
	}
	if countPhase8Subscriptions(t, ownerID, endpoint) != 1 {
		t.Fatalf("expected other user delete to leave owner subscription intact")
	}

	status, body, _, _ = performJSONPayload(router, http.MethodDelete, "/api/v1/notifications/subscriptions", map[string]string{
		"endpoint": endpoint,
	}, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("owner unsubscribe status = %d body = %s", status, body)
	}
	if countPhase8Subscriptions(t, ownerID, endpoint) != 0 {
		t.Fatalf("expected owner subscription removed")
	}
}

func TestNotificationTestEndpointConfig(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("phase8test_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)
	t.Setenv("VAPID_PUBLIC_KEY", "phase8-public")
	t.Setenv("VAPID_PRIVATE_KEY", "phase8-private")
	t.Setenv("VAPID_SUBJECT", "mailto:test@example.com")

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/notifications/test", nil, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("test notification status = %d body = %s", status, body)
	}

	t.Setenv("VAPID_PRIVATE_KEY", "")
	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/notifications/test", nil, []*http.Cookie{authCookie})
	if status != http.StatusServiceUnavailable {
		t.Fatalf("expected missing private key 503, got %d body=%s", status, body)
	}
}

func getPhase8UserID(t *testing.T, username string) string {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var userID string
	if err := conn.QueryRow(context.Background(), "SELECT id FROM users WHERE username = $1", username).Scan(&userID); err != nil {
		t.Fatalf("failed to read user id: %v", err)
	}
	return userID
}

func countPhase8Subscriptions(t *testing.T, userID string, endpoint string) int {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var count int
	if err := conn.QueryRow(
		context.Background(),
		"SELECT COUNT(*) FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
		userID,
		endpoint,
	).Scan(&count); err != nil {
		t.Fatalf("failed to count push subscriptions: %v", err)
	}
	return count
}
