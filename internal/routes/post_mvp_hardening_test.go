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

	"github.com/vladwithcode/tasktracker/internal/db"
)

func TestSharedManageCanEditTaskButViewCannot(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("hardowner_%d", time.Now().UnixNano()%1_000_000_000)
	managerUsername := fmt.Sprintf("hardmanager_%d", time.Now().UnixNano()%1_000_000_000)
	viewerUsername := fmt.Sprintf("hardviewer_%d", time.Now().UnixNano()%1_000_000_000)
	otherUsername := fmt.Sprintf("hardother_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	for _, username := range []string{ownerUsername, managerUsername, viewerUsername, otherUsername} {
		cleanupTaskRouteUser(t, username)
	}
	t.Cleanup(func() {
		for _, username := range []string{ownerUsername, managerUsername, viewerUsername, otherUsername} {
			cleanupTaskRouteUser(t, username)
		}
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	managerCookie := registerPhase5User(t, router, managerUsername, password)
	viewerCookie := registerPhase5User(t, router, viewerUsername, password)
	otherCookie := registerPhase5User(t, router, otherUsername, password)
	createPhase9Grant(t, router, ownerCookie, managerUsername, "manage")
	createPhase9Grant(t, router, ownerCookie, viewerUsername, "view")

	schedule := createRouteSchedule(t, router, ownerCookie, "Hardening managed task", "09:00", "10:00")
	task := findTaskBySchedule(t, getRouteTodayTasks(t, router, ownerCookie).Data.Tasks, schedule.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"currentCount": 2,
		"targetCount":  3,
		"title":        "Managed instance edit",
	}, []*http.Cookie{managerCookie})
	if status != http.StatusOK {
		t.Fatalf("expected manager edit OK, got %d body=%s", status, body)
	}
	taskState := getPhase6TaskState(t, task.ID)
	if taskState.Title.String != "Managed instance edit" {
		t.Fatalf("expected manager title edit, got %q", taskState.Title.String)
	}
	if taskState.CurrentCount != 2 {
		t.Fatalf("expected manager current_count=2, got %d", taskState.CurrentCount)
	}
	if getPhase6ScheduleState(t, schedule.Data.Schedule.ID).Title != "Hardening managed task" {
		t.Fatalf("shared instance edit should not mutate schedule")
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"apply_to_schedule": true,
		"title":             "Forbidden shared schedule edit",
	}, []*http.Cookie{managerCookie})
	if status != http.StatusForbidden {
		t.Fatalf("expected manager apply_to_schedule 403, got %d body=%s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{
		"title": "Viewer should not edit",
	}, []*http.Cookie{viewerCookie})
	if status != http.StatusForbidden {
		t.Fatalf("expected view-only edit 403, got %d body=%s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{
		"title": "Other should not edit",
	}, []*http.Cookie{otherCookie})
	if status != http.StatusForbidden {
		t.Fatalf("expected unrelated edit 403, got %d body=%s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"currentCount": 3,
		"status":       "completed",
		"targetCount":  3,
	}, []*http.Cookie{managerCookie})
	if status != http.StatusOK {
		t.Fatalf("expected manager completion OK, got %d body=%s", status, body)
	}
	if countTaskCompletions(t, task.ID) != 1 {
		t.Fatalf("expected one completion after manager complete")
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{
		"status": "completed",
	}, []*http.Cookie{managerCookie})
	if status != http.StatusOK {
		t.Fatalf("expected manager idempotent re-complete OK, got %d body=%s", status, body)
	}
	if countTaskCompletions(t, task.ID) != 1 {
		t.Fatalf("expected idempotent manager complete to keep one completion")
	}
}

func TestNotificationInboxListsAndMarksOwnPings(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("hardinboxowner_%d", time.Now().UnixNano()%1_000_000_000)
	granteeUsername := fmt.Sprintf("hardinboxgrantee_%d", time.Now().UnixNano()%1_000_000_000)
	otherUsername := fmt.Sprintf("hardinboxother_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	for _, username := range []string{ownerUsername, granteeUsername, otherUsername} {
		cleanupTaskRouteUser(t, username)
	}
	t.Cleanup(func() {
		for _, username := range []string{ownerUsername, granteeUsername, otherUsername} {
			cleanupTaskRouteUser(t, username)
		}
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	granteeCookie := registerPhase5User(t, router, granteeUsername, password)
	otherCookie := registerPhase5User(t, router, otherUsername, password)
	createPhase9Grant(t, router, ownerCookie, granteeUsername, "ping_only")
	schedule := createRouteSchedule(t, router, ownerCookie, "Hardening inbox task", "09:00", "10:00")
	task := findTaskBySchedule(t, getRouteTodayTasks(t, router, ownerCookie).Data.Tasks, schedule.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/tasks/"+task.ID+"/ping", map[string]string{
		"message": "inbox check",
	}, []*http.Cookie{granteeCookie})
	if status != http.StatusOK {
		t.Fatalf("expected ping OK, got %d body=%s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/notifications/inbox", nil, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("owner inbox status = %d body=%s", status, body)
	}
	inboxID := decodeInboxFirstID(t, body)
	if !strings.Contains(body, "Hardening inbox task") || !strings.Contains(body, granteeUsername) {
		t.Fatalf("owner inbox missing ping context: %s", body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/notifications/inbox", nil, []*http.Cookie{otherCookie})
	if status != http.StatusOK {
		t.Fatalf("other inbox status = %d body=%s", status, body)
	}
	if strings.Contains(body, inboxID) {
		t.Fatalf("other user should not see owner ping: %s", body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/notifications/inbox/"+inboxID+"/read", nil, []*http.Cookie{granteeCookie})
	if status != http.StatusNotFound {
		t.Fatalf("expected grantee mark-read 404, got %d body=%s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/notifications/inbox/"+inboxID+"/read", nil, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("expected owner mark-read OK, got %d body=%s", status, body)
	}
	if readAt := getPingReadAt(t, inboxID); !readAt.Valid {
		t.Fatalf("expected ping read_at to be set")
	}
}

func TestScheduledGeneratorIsIdempotentAndSkipsCancelledSchedules(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("hardgen_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)
	schedule := createRouteSchedule(t, router, authCookie, "Hardening generator active", "09:00", "10:00")
	cancelledSchedule := createRouteSchedule(t, router, authCookie, "Hardening generator cancelled", "11:00", "12:00")

	status, body, _, _ := performJSONPayload(router, http.MethodDelete, "/api/v1/schedules/"+cancelledSchedule.Data.Schedule.ID, nil, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("cancel schedule status = %d body=%s", status, body)
	}

	if _, err := db.GenerateTodayTasksForActiveUsers(context.Background()); err != nil {
		t.Fatalf("generator first run failed: %v", err)
	}
	if countTasksBySchedule(t, schedule.Data.Schedule.ID) != 1 {
		t.Fatalf("expected active schedule to generate exactly one task")
	}
	if countTasksBySchedule(t, cancelledSchedule.Data.Schedule.ID) != 0 {
		t.Fatalf("expected cancelled schedule to generate no tasks")
	}
	if _, err := db.GenerateTodayTasksForActiveUsers(context.Background()); err != nil {
		t.Fatalf("generator second run failed: %v", err)
	}
	if countTasksBySchedule(t, schedule.Data.Schedule.ID) != 1 {
		t.Fatalf("expected generator to be idempotent")
	}

	today := getRouteTodayTasks(t, router, authCookie)
	if len(today.Data.Tasks) != 1 {
		t.Fatalf("lazy generation should coexist with scheduler and keep one task, got %d", len(today.Data.Tasks))
	}
}

func TestScheduleDeletePolicyPreservesHistoryAndBlocksOtherUsers(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("harddeleteowner_%d", time.Now().UnixNano()%1_000_000_000)
	otherUsername := fmt.Sprintf("harddeleteother_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, ownerUsername)
	cleanupTaskRouteUser(t, otherUsername)
	t.Cleanup(func() {
		cleanupTaskRouteUser(t, ownerUsername)
		cleanupTaskRouteUser(t, otherUsername)
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	otherCookie := registerPhase5User(t, router, otherUsername, password)
	schedule := createRouteSchedule(t, router, ownerCookie, "Hardening delete history", "09:00", "10:00")
	task := findTaskBySchedule(t, getRouteTodayTasks(t, router, ownerCookie).Data.Tasks, schedule.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{
		"status": "completed",
	}, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("complete before delete status = %d body=%s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodDelete, "/api/v1/schedules/"+schedule.Data.Schedule.ID, nil, []*http.Cookie{otherCookie})
	if status != http.StatusForbidden {
		t.Fatalf("expected other user delete 403, got %d body=%s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodDelete, "/api/v1/schedules/"+schedule.Data.Schedule.ID, nil, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("owner delete status = %d body=%s", status, body)
	}
	if status := getScheduleStatus(t, schedule.Data.Schedule.ID); status != string(db.ScheduleTaskStatusCancelled) {
		t.Fatalf("expected schedule cancelled, got %q", status)
	}
	if countTasksBySchedule(t, schedule.Data.Schedule.ID) != 1 {
		t.Fatalf("expected historical task preserved")
	}
	if countTaskCompletions(t, task.ID) != 1 {
		t.Fatalf("expected completion preserved")
	}
	if _, err := db.GenerateTodayTasksForActiveUsers(context.Background()); err != nil {
		t.Fatalf("generator after delete failed: %v", err)
	}
	if countTasksBySchedule(t, schedule.Data.Schedule.ID) != 1 {
		t.Fatalf("cancelled schedule should not generate more tasks")
	}
}

func decodeInboxFirstID(t *testing.T, body string) string {
	t.Helper()

	var envelope struct {
		Data struct {
			Items []struct {
				ID string `json:"id"`
			} `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		t.Fatalf("decode inbox response: %v body=%s", err, body)
	}
	if len(envelope.Data.Items) == 0 || envelope.Data.Items[0].ID == "" {
		t.Fatalf("inbox response missing first item: %s", body)
	}
	return envelope.Data.Items[0].ID
}

func getPingReadAt(t *testing.T, pingID string) sql.NullTime {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var readAt sql.NullTime
	if err := conn.QueryRow(context.Background(), "SELECT read_at FROM task_pings WHERE id = $1", pingID).Scan(&readAt); err != nil {
		t.Fatalf("failed to read ping read_at: %v", err)
	}
	return readAt
}

func countTasksBySchedule(t *testing.T, scheduleID string) int {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var count int
	if err := conn.QueryRow(context.Background(), "SELECT COUNT(*) FROM tasks WHERE schedule_task_id = $1", scheduleID).Scan(&count); err != nil {
		t.Fatalf("failed to count tasks by schedule: %v", err)
	}
	return count
}

func getScheduleStatus(t *testing.T, scheduleID string) string {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var status string
	if err := conn.QueryRow(context.Background(), "SELECT status_level::text FROM schedule_tasks WHERE id = $1", scheduleID).Scan(&status); err != nil {
		t.Fatalf("failed to read schedule status: %v", err)
	}
	return status
}
