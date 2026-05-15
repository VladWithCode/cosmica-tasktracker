package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

// TestCompleteTaskAppendOnlyHistory exercises the Phase 5 atomic completion
// path: completing a task creates a row in task_completions, re-completing the
// same task does not produce a duplicate row, and direct UPDATE/DELETE attempts
// against task_completions fail because of the append-only triggers.
func TestCompleteTaskAppendOnlyHistory(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("phase5done_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)
	scheduleA := createRouteSchedule(t, router, authCookie, "Phase 5 task", "09:00", "10:00")

	today := getRouteTodayTasks(t, router, authCookie)
	if len(today.Data.Tasks) != 1 {
		t.Fatalf("expected 1 task generated, got %d body=%+v", len(today.Data.Tasks), today)
	}
	taskA := findTaskBySchedule(t, today.Data.Tasks, scheduleA.Data.Schedule.ID)

	status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+taskA.ID, map[string]string{
		"status": "completed",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("complete task status = %d body = %s", status, body)
	}

	completionCount := countTaskCompletions(t, taskA.ID)
	if completionCount != 1 {
		t.Fatalf("expected 1 task_completions row after first complete, got %d", completionCount)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+taskA.ID, map[string]string{
		"status": "completed",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("re-complete task status = %d body = %s", status, body)
	}

	completionCount = countTaskCompletions(t, taskA.ID)
	if completionCount != 1 {
		t.Fatalf("expected idempotent re-complete to keep 1 row, got %d", completionCount)
	}

	scheduleB := createRouteSchedule(t, router, authCookie, "Phase 5 concurrent task", "11:00", "12:00")
	today = getRouteTodayTasks(t, router, authCookie)
	taskB := findTaskBySchedule(t, today.Data.Tasks, scheduleB.Data.Schedule.ID)

	var waitGroup sync.WaitGroup
	statuses := make([]int, 2)
	bodies := make([]string, 2)
	for index := range statuses {
		waitGroup.Add(1)
		go func(index int) {
			defer waitGroup.Done()
			status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+taskB.ID, map[string]string{
				"status": "completed",
			}, []*http.Cookie{authCookie})
			statuses[index] = status
			bodies[index] = body
		}(index)
	}
	waitGroup.Wait()

	for index, status := range statuses {
		if status != http.StatusOK {
			t.Fatalf("concurrent complete %d status = %d body = %s", index, status, bodies[index])
		}
	}
	completionCount = countTaskCompletions(t, taskB.ID)
	if completionCount != 1 {
		t.Fatalf("expected concurrent complete to keep 1 row, got %d", completionCount)
	}

	if err := tryUpdateTaskCompletion(taskA.ID); err == nil {
		t.Fatalf("expected UPDATE on task_completions to fail because of append-only trigger")
	} else if !strings.Contains(err.Error(), "append-only") {
		t.Fatalf("expected append-only error, got: %v", err)
	}

	if err := tryDeleteTaskCompletion(taskA.ID); err == nil {
		t.Fatalf("expected DELETE on task_completions to fail because of append-only trigger")
	} else if !strings.Contains(err.Error(), "append-only") {
		t.Fatalf("expected append-only error on delete, got: %v", err)
	}
}

// TestProgressEndpointReturnsCorrectCounts verifies the GET /tasks/progress
// endpoint counts tasks per status correctly, computes a percentage and never
// divides by zero when there are no tasks.
func TestProgressEndpointReturnsCorrectCounts(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("phase5prog_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)

	progress := getProgress(t, router, authCookie, "")
	if progress.Total != 0 {
		t.Fatalf("expected total=0 with no schedules, got %d", progress.Total)
	}
	if progress.Percentage != 0 {
		t.Fatalf("expected percentage=0 with no tasks, got %v", progress.Percentage)
	}

	scheduleA := createRouteSchedule(t, router, authCookie, "Phase 5 progress A", "09:00", "10:00")
	scheduleB := createRouteSchedule(t, router, authCookie, "Phase 5 progress B", "11:00", "12:00")
	_ = scheduleB

	today := getRouteTodayTasks(t, router, authCookie)
	if len(today.Data.Tasks) != 2 {
		t.Fatalf("expected 2 tasks generated, got %d", len(today.Data.Tasks))
	}
	taskA := findTaskBySchedule(t, today.Data.Tasks, scheduleA.Data.Schedule.ID)

	progress = getProgress(t, router, authCookie, "")
	if progress.Total != 2 {
		t.Fatalf("expected total=2, got %d", progress.Total)
	}
	if progress.Completed != 0 {
		t.Fatalf("expected completed=0, got %d", progress.Completed)
	}
	if progress.Pending != 2 {
		t.Fatalf("expected pending=2, got %d", progress.Pending)
	}
	if progress.Percentage != 0 {
		t.Fatalf("expected percentage=0 before completing, got %v", progress.Percentage)
	}

	status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+taskA.ID, map[string]string{
		"status": "completed",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("complete status = %d body = %s", status, body)
	}

	progress = getProgress(t, router, authCookie, "")
	if progress.Total != 2 {
		t.Fatalf("expected total=2 after complete, got %d", progress.Total)
	}
	if progress.Completed != 1 {
		t.Fatalf("expected completed=1, got %d", progress.Completed)
	}
	if progress.Pending != 1 {
		t.Fatalf("expected pending=1, got %d", progress.Pending)
	}
	if progress.Percentage != 50 {
		t.Fatalf("expected percentage=50, got %v", progress.Percentage)
	}

	dateStr := time.Now().Format("2006-01-02")
	progressByDate := getProgress(t, router, authCookie, dateStr)
	if progressByDate.Date != dateStr {
		t.Fatalf("expected date=%q, got %q", dateStr, progressByDate.Date)
	}
	if progressByDate.Total != 2 {
		t.Fatalf("expected total=2 with explicit date, got %d", progressByDate.Total)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/tasks/progress?date=not-a-date", nil, []*http.Cookie{authCookie})
	if status != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid date, got %d body=%s", status, body)
	}
}

type progressEnvelope struct {
	Data struct {
		Progress phase5Progress `json:"progress"`
	} `json:"data"`
}

type phase5Progress struct {
	Date       string  `json:"date"`
	Total      int     `json:"total"`
	Completed  int     `json:"completed"`
	Pending    int     `json:"pending"`
	Skipped    int     `json:"skipped"`
	Failed     int     `json:"failed"`
	InProgress int     `json:"in_progress"`
	Percentage float64 `json:"percentage"`
}

func registerPhase5User(t *testing.T, router *gin.Engine, username, password string) *http.Cookie {
	t.Helper()

	status, body, cookies, _ := performJSONPayload(router, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    username + "@example.com",
		"fullname": "Phase Five User",
		"password": password,
		"username": username,
	}, nil)
	if status != http.StatusCreated {
		t.Fatalf("register status = %d body = %s", status, body)
	}
	authCookie := findCookie(cookies, auth.DefaultCookieName)
	if authCookie == nil {
		t.Fatalf("expected auth cookie, got %#v", cookies)
	}
	return authCookie
}

func getProgress(t *testing.T, router *gin.Engine, authCookie *http.Cookie, date string) phase5Progress {
	t.Helper()

	url := "/api/v1/tasks/progress"
	if date != "" {
		url = url + "?date=" + date
	}
	status, body, _, _ := performJSONPayload(router, http.MethodGet, url, nil, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("progress status = %d body = %s", status, body)
	}
	var envelope progressEnvelope
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		t.Fatalf("decode progress response: %v body=%s", err, body)
	}
	return envelope.Data.Progress
}

func countTaskCompletions(t *testing.T, taskID string) int {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var count int
	if err := conn.QueryRow(
		context.Background(),
		"SELECT COUNT(*) FROM task_completions WHERE task_id = $1",
		taskID,
	).Scan(&count); err != nil {
		t.Fatalf("failed to count task_completions: %v", err)
	}
	return count
}

func tryUpdateTaskCompletion(taskID string) error {
	conn, err := db.GetConn(context.Background())
	if err != nil {
		return err
	}
	defer conn.Release()

	_, err = conn.Exec(
		context.Background(),
		"UPDATE task_completions SET notes = 'mutated' WHERE task_id = $1",
		taskID,
	)
	return err
}

func tryDeleteTaskCompletion(taskID string) error {
	conn, err := db.GetConn(context.Background())
	if err != nil {
		return err
	}
	defer conn.Release()

	_, err = conn.Exec(
		context.Background(),
		"DELETE FROM task_completions WHERE task_id = $1",
		taskID,
	)
	return err
}
