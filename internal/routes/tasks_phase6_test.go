package routes

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/vladwithcode/tasktracker/internal/db"
)

func TestTaskUpdateInstanceOnlyDoesNotTouchSchedule(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("phase6inst_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)
	schedule := createRouteSchedule(t, router, authCookie, "Phase 6 base", "09:00", "10:00")
	task := findTaskBySchedule(t, getRouteTodayTasks(t, router, authCookie).Data.Tasks, schedule.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"currentCount": 4,
		"description":  "Instance description",
		"notes":        "Instance note",
		"status":       "in_progress",
		"targetCount":  8,
		"title":        "Instance title",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("instance update status = %d body = %s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"currentCount": 0,
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("current_count reset status = %d body = %s", status, body)
	}

	taskState := getPhase6TaskState(t, task.ID)
	if taskState.Title.String != "Instance title" {
		t.Fatalf("expected task title override, got %q", taskState.Title.String)
	}
	if taskState.Description.String != "Instance description" {
		t.Fatalf("expected task description override, got %q", taskState.Description.String)
	}
	if taskState.Notes.String != "Instance note" {
		t.Fatalf("expected task notes override, got %q", taskState.Notes.String)
	}
	if taskState.CurrentCount != 0 {
		t.Fatalf("expected explicit current_count=0, got %d", taskState.CurrentCount)
	}
	if !taskState.TargetCount.Valid || taskState.TargetCount.Int64 != 8 {
		t.Fatalf("expected target_count=8, got %+v", taskState.TargetCount)
	}

	scheduleState := getPhase6ScheduleState(t, schedule.Data.Schedule.ID)
	if scheduleState.Title != "Phase 6 base" {
		t.Fatalf("expected schedule title unchanged, got %q", scheduleState.Title)
	}
	if scheduleState.Description.Valid {
		t.Fatalf("expected schedule description unchanged/null, got %q", scheduleState.Description.String)
	}
}

func TestTaskUpdateApplyToScheduleUpdatesTaskAndSchedule(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("phase6global_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)
	schedule := createRouteSchedule(t, router, authCookie, "Phase 6 routine", "09:00", "10:00")
	task := findTaskBySchedule(t, getRouteTodayTasks(t, router, authCookie).Data.Tasks, schedule.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"apply_to_schedule":   true,
		"description":         "Global description",
		"duration_minutes":    45,
		"is_required":         true,
		"priority_level":      "urgent",
		"schedule_end_time":   "15:15",
		"schedule_start_time": "14:30",
		"title":               "Global phase 6 routine",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("apply_to_schedule update status = %d body = %s", status, body)
	}

	taskState := getPhase6TaskState(t, task.ID)
	if taskState.Title.String != "Global phase 6 routine" {
		t.Fatalf("expected task title updated, got %q", taskState.Title.String)
	}
	if taskState.Description.String != "Global description" {
		t.Fatalf("expected task description updated, got %q", taskState.Description.String)
	}

	scheduleState := getPhase6ScheduleState(t, schedule.Data.Schedule.ID)
	if scheduleState.Title != "Global phase 6 routine" {
		t.Fatalf("expected schedule title updated, got %q", scheduleState.Title)
	}
	if scheduleState.Description.String != "Global description" {
		t.Fatalf("expected schedule description updated, got %q", scheduleState.Description.String)
	}
	if scheduleState.Priority != "urgent" {
		t.Fatalf("expected schedule priority urgent, got %q", scheduleState.Priority)
	}
	if !scheduleState.IsRequired || !scheduleState.Required {
		t.Fatalf("expected schedule required flags true, got required=%v is_required=%v", scheduleState.Required, scheduleState.IsRequired)
	}
	if !scheduleState.DurationMinutes.Valid || scheduleState.DurationMinutes.Int64 != 45 {
		t.Fatalf("expected duration_minutes=45, got %+v", scheduleState.DurationMinutes)
	}
	if !scheduleState.StartTime.Valid || scheduleState.StartTime.String != "14:30:00" {
		t.Fatalf("expected schedule_start_time=14:30:00, got %+v", scheduleState.StartTime)
	}
	if !scheduleState.EndTime.Valid || scheduleState.EndTime.String != "15:15:00" {
		t.Fatalf("expected schedule_end_time=15:15:00, got %+v", scheduleState.EndTime)
	}
}

func TestTaskUpdateRejectsOtherUser(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("phase6owner_%d", time.Now().UnixNano()%1_000_000_000)
	otherUsername := fmt.Sprintf("phase6other_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, ownerUsername)
	cleanupTaskRouteUser(t, otherUsername)
	t.Cleanup(func() {
		cleanupTaskRouteUser(t, ownerUsername)
		cleanupTaskRouteUser(t, otherUsername)
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	otherCookie := registerPhase5User(t, router, otherUsername, password)
	schedule := createRouteSchedule(t, router, ownerCookie, "Phase 6 private", "09:00", "10:00")
	task := findTaskBySchedule(t, getRouteTodayTasks(t, router, ownerCookie).Data.Tasks, schedule.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"title": "Forbidden update",
	}, []*http.Cookie{otherCookie})
	if status != http.StatusForbidden {
		t.Fatalf("expected 403 for other user update, got %d body = %s", status, body)
	}

	taskState := getPhase6TaskState(t, task.ID)
	if taskState.Title.Valid {
		t.Fatalf("expected task title override to remain null, got %q", taskState.Title.String)
	}
}

func TestTaskUpdateDoesNotMutateTaskCompletions(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("phase6hist_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)
	schedule := createRouteSchedule(t, router, authCookie, "Phase 6 history", "09:00", "10:00")
	task := findTaskBySchedule(t, getRouteTodayTasks(t, router, authCookie).Data.Tasks, schedule.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{
		"status": "completed",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("complete status = %d body = %s", status, body)
	}

	before := getPhase6CompletionSnapshot(t, task.ID)

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"description": "Edited after completion",
		"notes":       "Task note after completion",
		"title":       "Edited completed task",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("edit completed task status = %d body = %s", status, body)
	}

	after := getPhase6CompletionSnapshot(t, task.ID)
	if before.ID != after.ID {
		t.Fatalf("expected same completion id, before=%s after=%s", before.ID, after.ID)
	}
	if !before.CompletedAt.Equal(after.CompletedAt) {
		t.Fatalf("expected completed_at unchanged, before=%s after=%s", before.CompletedAt, after.CompletedAt)
	}
	if before.Count != after.Count {
		t.Fatalf("expected completion count unchanged, before=%d after=%d", before.Count, after.Count)
	}
	if before.Notes.String != after.Notes.String || before.Notes.Valid != after.Notes.Valid {
		t.Fatalf("expected completion notes unchanged, before=%+v after=%+v", before.Notes, after.Notes)
	}
	if countTaskCompletions(t, task.ID) != 1 {
		t.Fatalf("expected exactly one completion row after editing completed task")
	}
}

type phase6TaskState struct {
	Title        sql.NullString
	Description  sql.NullString
	CurrentCount int
	TargetCount  sql.NullInt64
	Notes        sql.NullString
}

type phase6ScheduleState struct {
	Title           string
	Description     sql.NullString
	Priority        string
	Required        bool
	IsRequired      bool
	DurationMinutes sql.NullInt64
	StartTime       sql.NullString
	EndTime         sql.NullString
}

type phase6CompletionSnapshot struct {
	ID          string
	CompletedAt time.Time
	Count       int
	Notes       sql.NullString
}

func getPhase6TaskState(t *testing.T, taskID string) phase6TaskState {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var state phase6TaskState
	if err := conn.QueryRow(
		context.Background(),
		`SELECT title, description, current_count, target_count, notes
		 FROM tasks
		 WHERE id = $1`,
		taskID,
	).Scan(&state.Title, &state.Description, &state.CurrentCount, &state.TargetCount, &state.Notes); err != nil {
		t.Fatalf("failed to read task state: %v", err)
	}
	return state
}

func getPhase6ScheduleState(t *testing.T, scheduleID string) phase6ScheduleState {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var state phase6ScheduleState
	if err := conn.QueryRow(
		context.Background(),
		`SELECT
			title,
			description,
			priority_level::text,
			required,
			is_required,
			duration_minutes,
			schedule_start_time::text,
			schedule_end_time::text
		 FROM schedule_tasks
		 WHERE id = $1`,
		scheduleID,
	).Scan(
		&state.Title,
		&state.Description,
		&state.Priority,
		&state.Required,
		&state.IsRequired,
		&state.DurationMinutes,
		&state.StartTime,
		&state.EndTime,
	); err != nil {
		t.Fatalf("failed to read schedule state: %v", err)
	}
	return state
}

func getPhase6CompletionSnapshot(t *testing.T, taskID string) phase6CompletionSnapshot {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var snapshot phase6CompletionSnapshot
	if err := conn.QueryRow(
		context.Background(),
		`SELECT id, completed_at, count, notes
		 FROM task_completions
		 WHERE task_id = $1
		 ORDER BY completed_at DESC
		 LIMIT 1`,
		taskID,
	).Scan(&snapshot.ID, &snapshot.CompletedAt, &snapshot.Count, &snapshot.Notes); err != nil {
		t.Fatalf("failed to read completion snapshot: %v", err)
	}
	return snapshot
}
