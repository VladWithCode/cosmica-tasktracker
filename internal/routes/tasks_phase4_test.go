package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func TestTasksTodayLazyGenerationAndApplyToSchedule(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("taskphase4_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	status, body, cookies, _ := performJSONPayload(router, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    username + "@example.com",
		"fullname": "Task Phase Four",
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

	scheduleA := createRouteSchedule(t, router, authCookie, "Phase 4 A", "09:00", "10:00")

	today := getRouteTodayTasks(t, router, authCookie)
	if len(today.Data.Tasks) != 1 {
		t.Fatalf("after schedule A expected 1 task, got %d body=%+v", len(today.Data.Tasks), today)
	}
	taskA := findTaskBySchedule(t, today.Data.Tasks, scheduleA.Data.Schedule.ID)

	scheduleB := createRouteSchedule(t, router, authCookie, "Phase 4 B", "14:00", "15:00")

	for index := 0; index < 4; index++ {
		today = getRouteTodayTasks(t, router, authCookie)
		if len(today.Data.Tasks) != 2 {
			t.Fatalf("iteration %d expected 2 tasks, got %d body=%+v", index, len(today.Data.Tasks), today)
		}
	}
	_ = findTaskBySchedule(t, today.Data.Tasks, scheduleB.Data.Schedule.ID)

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+taskA.ID, map[string]string{
		"status": "completed",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("complete task status = %d body = %s", status, body)
	}

	today = getRouteTodayTasks(t, router, authCookie)
	if len(today.Data.Tasks) != 2 {
		t.Fatalf("after completion expected 2 tasks, got %d", len(today.Data.Tasks))
	}
	completedA := findTaskBySchedule(t, today.Data.Tasks, scheduleA.Data.Schedule.ID)
	if completedA.StatusLevel != "completed" {
		t.Fatalf("expected completed task A, got %q", completedA.StatusLevel)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+taskA.ID, map[string]string{
		"title": "Instance Only Title",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("instance update status = %d body = %s", status, body)
	}
	scheduleDetail := getRouteSchedule(t, router, authCookie, scheduleA.Data.Schedule.ID)
	if scheduleDetail.Data.Schedule.Title != "Phase 4 A" {
		t.Fatalf("expected schedule title unchanged, got %q", scheduleDetail.Data.Schedule.Title)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+taskA.ID, map[string]interface{}{
		"apply_to_schedule": true,
		"is_required":       true,
		"priority_level":    "urgent",
		"title":             "Global Routine Title",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("global update status = %d body = %s", status, body)
	}
	scheduleDetail = getRouteSchedule(t, router, authCookie, scheduleA.Data.Schedule.ID)
	if scheduleDetail.Data.Schedule.Title != "Global Routine Title" {
		t.Fatalf("expected schedule title updated, got %q", scheduleDetail.Data.Schedule.Title)
	}
	if scheduleDetail.Data.Schedule.Priority != "urgent" {
		t.Fatalf("expected schedule priority urgent, got %q", scheduleDetail.Data.Schedule.Priority)
	}
	if !scheduleDetail.Data.Schedule.IsRequired {
		t.Fatalf("expected schedule to be required")
	}
}

type routeScheduleResponse struct {
	Data struct {
		Schedule struct {
			ID         string `json:"id"`
			IsRequired bool   `json:"isRequired"`
			Priority   string `json:"priority"`
			Title      string `json:"title"`
		} `json:"schedule"`
	} `json:"data"`
}

type routeTodayResponse struct {
	Data struct {
		Tasks []routeTaskFeedItem `json:"tasks"`
	} `json:"data"`
}

type routeTaskFeedItem struct {
	ID          string `json:"id"`
	ScheduleID  string `json:"schedule_id"`
	StatusLevel string `json:"status_level"`
	Title       string `json:"title"`
}

func createRouteSchedule(
	t *testing.T,
	router *gin.Engine,
	authCookie *http.Cookie,
	title string,
	startTime string,
	endTime string,
) routeScheduleResponse {
	t.Helper()

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/schedules", map[string]interface{}{
		"frequency":           "daily",
		"is_required":         false,
		"priority_level":      "urgent",
		"schedule_end_time":   endTime,
		"schedule_start_time": startTime,
		"title":               title,
	}, []*http.Cookie{authCookie})
	if status != http.StatusCreated {
		t.Fatalf("create schedule status = %d body = %s", status, body)
	}

	var response routeScheduleResponse
	if err := json.Unmarshal([]byte(body), &response); err != nil {
		t.Fatalf("decode schedule response: %v body=%s", err, body)
	}
	if response.Data.Schedule.ID == "" {
		t.Fatalf("schedule response missing id: %s", body)
	}
	return response
}

func getRouteTodayTasks(t *testing.T, router *gin.Engine, authCookie *http.Cookie) routeTodayResponse {
	t.Helper()

	status, body, _, _ := performJSONPayload(router, http.MethodGet, "/api/v1/tasks/today", nil, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("today tasks status = %d body = %s", status, body)
	}
	var response routeTodayResponse
	if err := json.Unmarshal([]byte(body), &response); err != nil {
		t.Fatalf("decode today response: %v body=%s", err, body)
	}
	return response
}

func getRouteSchedule(
	t *testing.T,
	router *gin.Engine,
	authCookie *http.Cookie,
	scheduleID string,
) routeScheduleResponse {
	t.Helper()

	status, body, _, _ := performJSONPayload(router, http.MethodGet, "/api/v1/schedules/"+scheduleID, nil, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("schedule detail status = %d body = %s", status, body)
	}
	var response routeScheduleResponse
	if err := json.Unmarshal([]byte(body), &response); err != nil {
		t.Fatalf("decode schedule detail response: %v body=%s", err, body)
	}
	return response
}

func findTaskBySchedule(t *testing.T, tasks []routeTaskFeedItem, scheduleID string) routeTaskFeedItem {
	t.Helper()

	for _, task := range tasks {
		if task.ScheduleID == scheduleID {
			return task
		}
	}
	t.Fatalf("task for schedule %s not found in %+v", scheduleID, tasks)
	return routeTaskFeedItem{}
}

func cleanupTaskRouteUser(t *testing.T, username string) {
	t.Helper()

	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(context.Background(), `ALTER TABLE task_completions DISABLE TRIGGER prevent_task_completion_delete`); err != nil {
		t.Fatalf("failed to disable task completion cleanup trigger: %v", err)
	}
	defer func() {
		if _, err := conn.Exec(context.Background(), `ALTER TABLE task_completions ENABLE TRIGGER prevent_task_completion_delete`); err != nil {
			t.Fatalf("failed to re-enable task completion cleanup trigger: %v", err)
		}
	}()

	queries := []string{
		`WITH target_user AS (SELECT id FROM users WHERE username = $1)
		 DELETE FROM task_completions WHERE user_id IN (SELECT id FROM target_user)`,
		`WITH target_user AS (SELECT id FROM users WHERE username = $1)
		 DELETE FROM tasks WHERE user_id IN (SELECT id FROM target_user)`,
		`WITH target_user AS (SELECT id FROM users WHERE username = $1)
		 DELETE FROM schedule_tasks WHERE user_id IN (SELECT id FROM target_user)
			OR created_by IN (SELECT id FROM target_user)`,
		`DELETE FROM users WHERE username = $1`,
	}
	for _, query := range queries {
		if _, err := conn.Exec(context.Background(), query, username); err != nil {
			t.Fatalf("failed to cleanup task route user: %v", err)
		}
	}
}

func performJSONPayload(
	router *gin.Engine,
	method string,
	path string,
	payload interface{},
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
