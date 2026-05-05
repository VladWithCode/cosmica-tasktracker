package routes

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func TestSharingGrantLifecycle(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("phase9owner_%d", time.Now().UnixNano()%1_000_000_000)
	granteeUsername := fmt.Sprintf("phase9grantee_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, ownerUsername)
	cleanupTaskRouteUser(t, granteeUsername)
	t.Cleanup(func() {
		cleanupTaskRouteUser(t, ownerUsername)
		cleanupTaskRouteUser(t, granteeUsername)
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	granteeCookie := registerPhase5User(t, router, granteeUsername, password)

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/sharing/grants", map[string]string{
		"access_level": "view",
		"grantee":      granteeUsername,
	}, []*http.Cookie{ownerCookie})
	if status != http.StatusCreated {
		t.Fatalf("create grant status = %d body = %s", status, body)
	}
	grantID := decodePhase9GrantID(t, body)

	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/sharing/grants", map[string]string{
		"access_level": "view",
		"grantee":      granteeUsername,
	}, []*http.Cookie{ownerCookie})
	if status != http.StatusConflict {
		t.Fatalf("expected duplicate grant 409, got %d body = %s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/sharing/grants", map[string]string{
		"access_level": "view",
		"grantee":      ownerUsername,
	}, []*http.Cookie{ownerCookie})
	if status != http.StatusBadRequest {
		t.Fatalf("expected self-share 400, got %d body = %s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodDelete, "/api/v1/sharing/grants/"+grantID, nil, []*http.Cookie{granteeCookie})
	if status != http.StatusNotFound {
		t.Fatalf("expected non-owner revoke to be blocked, got %d body = %s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodDelete, "/api/v1/sharing/grants/"+grantID, nil, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("owner revoke status = %d body = %s", status, body)
	}
}

func TestSharedTasksTodayRequiresViewPermission(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("phase9viewowner_%d", time.Now().UnixNano()%1_000_000_000)
	granteeUsername := fmt.Sprintf("phase9viewgrantee_%d", time.Now().UnixNano()%1_000_000_000)
	otherUsername := fmt.Sprintf("phase9viewother_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, ownerUsername)
	cleanupTaskRouteUser(t, granteeUsername)
	cleanupTaskRouteUser(t, otherUsername)
	t.Cleanup(func() {
		cleanupTaskRouteUser(t, ownerUsername)
		cleanupTaskRouteUser(t, granteeUsername)
		cleanupTaskRouteUser(t, otherUsername)
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	granteeCookie := registerPhase5User(t, router, granteeUsername, password)
	otherCookie := registerPhase5User(t, router, otherUsername, password)
	ownerID := getPhase9UserID(t, ownerUsername)
	schedule := createRouteSchedule(t, router, ownerCookie, "Phase 9 shared view", "09:00", "10:00")
	_ = findTaskBySchedule(t, getRouteTodayTasks(t, router, ownerCookie).Data.Tasks, schedule.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodGet, "/api/v1/tasks/today?owner_user_id="+ownerID, nil, []*http.Cookie{granteeCookie})
	if status != http.StatusForbidden {
		t.Fatalf("expected no-permission shared feed 403, got %d body = %s", status, body)
	}

	createPhase9Grant(t, router, ownerCookie, granteeUsername, "view")
	status, body, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/tasks/today?owner_user_id="+ownerID, nil, []*http.Cookie{granteeCookie})
	if status != http.StatusOK {
		t.Fatalf("expected shared feed OK, got %d body = %s", status, body)
	}
	if !strings.Contains(body, "Phase 9 shared view") {
		t.Fatalf("shared feed did not include owner task: %s", body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/tasks/today?owner_user_id="+ownerID, nil, []*http.Cookie{otherCookie})
	if status != http.StatusForbidden {
		t.Fatalf("expected unrelated user shared feed 403, got %d body = %s", status, body)
	}
}

func TestSharedScheduleCreationRequiresCreatePermission(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("phase9createowner_%d", time.Now().UnixNano()%1_000_000_000)
	granteeUsername := fmt.Sprintf("phase9creategrantee_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, ownerUsername)
	cleanupTaskRouteUser(t, granteeUsername)
	t.Cleanup(func() {
		cleanupTaskRouteUser(t, ownerUsername)
		cleanupTaskRouteUser(t, granteeUsername)
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	granteeCookie := registerPhase5User(t, router, granteeUsername, password)
	ownerID := getPhase9UserID(t, ownerUsername)
	granteeID := getPhase9UserID(t, granteeUsername)

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/schedules", phase9SchedulePayload("Forbidden shared create", ownerID), []*http.Cookie{granteeCookie})
	if status != http.StatusForbidden {
		t.Fatalf("expected shared create without permission 403, got %d body = %s", status, body)
	}

	createPhase9Grant(t, router, ownerCookie, granteeUsername, "manage")
	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/schedules", phase9SchedulePayload("Allowed shared create", ownerID), []*http.Cookie{granteeCookie})
	if status != http.StatusCreated {
		t.Fatalf("expected shared create OK, got %d body = %s", status, body)
	}

	owner, creator := getPhase9ScheduleOwnership(t, "Allowed shared create")
	if owner != ownerID {
		t.Fatalf("expected owner_user_id=%s, got %s", ownerID, owner)
	}
	if creator != granteeID {
		t.Fatalf("expected created_by=%s, got %s", granteeID, creator)
	}
}

func TestTaskPingRequiresPermissionAndPersists(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("phase9pingowner_%d", time.Now().UnixNano()%1_000_000_000)
	granteeUsername := fmt.Sprintf("phase9pinggrantee_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, ownerUsername)
	cleanupTaskRouteUser(t, granteeUsername)
	t.Cleanup(func() {
		cleanupTaskRouteUser(t, ownerUsername)
		cleanupTaskRouteUser(t, granteeUsername)
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	granteeCookie := registerPhase5User(t, router, granteeUsername, password)
	granteeID := getPhase9UserID(t, granteeUsername)
	schedule := createRouteSchedule(t, router, ownerCookie, "Phase 9 ping target", "09:00", "10:00")
	task := findTaskBySchedule(t, getRouteTodayTasks(t, router, ownerCookie).Data.Tasks, schedule.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/tasks/"+task.ID+"/ping", nil, []*http.Cookie{granteeCookie})
	if status != http.StatusForbidden {
		t.Fatalf("expected ping without permission 403, got %d body = %s", status, body)
	}

	createPhase9Grant(t, router, ownerCookie, granteeUsername, "ping_only")
	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/tasks/"+task.ID+"/ping", map[string]string{
		"message": "please check this",
	}, []*http.Cookie{granteeCookie})
	if status != http.StatusOK {
		t.Fatalf("expected ping with permission OK, got %d body = %s", status, body)
	}
	if !strings.Contains(body, `"notification_sent":false`) {
		t.Fatalf("expected controlled no-push response, got %s", body)
	}
	if countPhase9Pings(t, task.ID, granteeID) != 1 {
		t.Fatalf("expected one persisted ping from grantee")
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/tasks/"+task.ID+"/ping", nil, []*http.Cookie{granteeCookie})
	if status != http.StatusConflict {
		t.Fatalf("expected ping rate limit 409, got %d body = %s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/tasks/"+task.ID+"/ping", nil, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("expected owner self-ping OK, got %d body = %s", status, body)
	}
}

func createPhase9Grant(t *testing.T, router *gin.Engine, ownerCookie *http.Cookie, grantee string, accessLevel string) string {
	t.Helper()

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/sharing/grants", map[string]string{
		"access_level": accessLevel,
		"grantee":      grantee,
	}, []*http.Cookie{ownerCookie})
	if status != http.StatusCreated {
		t.Fatalf("create phase9 grant status = %d body = %s", status, body)
	}
	return decodePhase9GrantID(t, body)
}

func decodePhase9GrantID(t *testing.T, body string) string {
	t.Helper()

	var envelope struct {
		Data struct {
			Grant struct {
				ID string `json:"id"`
			} `json:"grant"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		t.Fatalf("decode grant response: %v body=%s", err, body)
	}
	if envelope.Data.Grant.ID == "" {
		t.Fatalf("grant response missing id: %s", body)
	}
	return envelope.Data.Grant.ID
}

func phase9SchedulePayload(title string, ownerID string) map[string]interface{} {
	return map[string]interface{}{
		"frequency":           "daily",
		"is_required":         false,
		"owner_user_id":       ownerID,
		"priority_level":      "high",
		"schedule_end_time":   "12:00",
		"schedule_start_time": "11:00",
		"title":               title,
	}
}

func getPhase9UserID(t *testing.T, username string) string {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var userID string
	if err := conn.QueryRow(context.Background(), "SELECT id FROM users WHERE username = $1", username).Scan(&userID); err != nil {
		t.Fatalf("failed to get phase9 user id: %v", err)
	}
	return userID
}

func getPhase9ScheduleOwnership(t *testing.T, title string) (string, string) {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var ownerID string
	var createdBy sql.NullString
	if err := conn.QueryRow(
		context.Background(),
		`SELECT user_id, created_by::text
		 FROM schedule_tasks
		 WHERE title = $1
		 ORDER BY created_at DESC
		 LIMIT 1`,
		title,
	).Scan(&ownerID, &createdBy); err != nil {
		t.Fatalf("failed to read shared schedule ownership: %v", err)
	}
	return ownerID, createdBy.String
}

func countPhase9Pings(t *testing.T, taskID string, senderUserID string) int {
	t.Helper()

	count, err := db.CountTaskPings(context.Background(), taskID, senderUserID)
	if err != nil {
		t.Fatalf("failed to count pings: %v", err)
	}
	return count
}
