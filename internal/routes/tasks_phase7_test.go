package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestTaskHistoryEmptyRange(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("phase7empty_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)
	from := phase7Date(-1)
	to := phase7Date(0)

	history := getPhase7History(t, router, authCookie, from, to)
	if len(history.Days) != 2 {
		t.Fatalf("expected 2 days in empty history range, got %d", len(history.Days))
	}
	for _, day := range history.Days {
		if day.Total != 0 || day.Percentage != 0 {
			t.Fatalf("expected empty day totals, got %+v", day)
		}
	}

	metrics := getPhase7Metrics(t, router, authCookie, from, to)
	if metrics.Total != 0 {
		t.Fatalf("expected empty metrics total=0, got %d", metrics.Total)
	}
	if metrics.Percentage != 0 {
		t.Fatalf("expected empty metrics percentage=0, got %v", metrics.Percentage)
	}
	if metrics.DaysCount != 2 {
		t.Fatalf("expected days_count=2, got %d", metrics.DaysCount)
	}
}

func TestTaskHistoryAndMetricsRange(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("phase7range_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)
	scheduleA := createRouteSchedule(t, router, authCookie, "Phase 7 completed", "08:00", "09:00")
	scheduleB := createRouteSchedule(t, router, authCookie, "Phase 7 pending", "10:00", "11:00")
	scheduleC := createRouteSchedule(t, router, authCookie, "Phase 7 skipped", "12:00", "13:00")
	scheduleD := createRouteSchedule(t, router, authCookie, "Phase 7 failed", "14:00", "15:00")

	today := getRouteTodayTasks(t, router, authCookie)
	taskA := findTaskBySchedule(t, today.Data.Tasks, scheduleA.Data.Schedule.ID)
	taskB := findTaskBySchedule(t, today.Data.Tasks, scheduleB.Data.Schedule.ID)
	taskC := findTaskBySchedule(t, today.Data.Tasks, scheduleC.Data.Schedule.ID)
	taskD := findTaskBySchedule(t, today.Data.Tasks, scheduleD.Data.Schedule.ID)

	yesterday := phase7Date(-1)
	currentDay := phase7Date(0)
	updatePhase7Task(t, router, authCookie, taskA.ID, map[string]interface{}{
		"date":   yesterday.Format("2006-01-02"),
		"status": "completed",
	})
	updatePhase7Task(t, router, authCookie, taskB.ID, map[string]interface{}{
		"date": yesterday.Format("2006-01-02"),
	})
	updatePhase7Task(t, router, authCookie, taskC.ID, map[string]interface{}{
		"date":   currentDay.Format("2006-01-02"),
		"status": "skipped",
	})
	updatePhase7Task(t, router, authCookie, taskD.ID, map[string]interface{}{
		"date":   currentDay.Format("2006-01-02"),
		"status": "failed",
	})

	history := getPhase7History(t, router, authCookie, yesterday, currentDay)
	dayByDate := mapPhase7Days(history.Days)
	previousDay := dayByDate[yesterday.Format("2006-01-02")]
	if previousDay.Total != 2 || previousDay.Completed != 1 || previousDay.Pending != 1 || previousDay.Percentage != 50 {
		t.Fatalf("unexpected previous day stats: %+v", previousDay)
	}
	todayStats := dayByDate[currentDay.Format("2006-01-02")]
	if todayStats.Total != 2 || todayStats.Skipped != 1 || todayStats.Failed != 1 || todayStats.Percentage != 0 {
		t.Fatalf("unexpected current day stats: %+v", todayStats)
	}

	metrics := getPhase7Metrics(t, router, authCookie, yesterday, currentDay)
	if metrics.Total != 4 {
		t.Fatalf("expected total=4, got %+v", metrics)
	}
	if metrics.Completed != 1 || metrics.Pending != 1 || metrics.Skipped != 1 || metrics.Failed != 1 {
		t.Fatalf("unexpected status metrics: %+v", metrics)
	}
	if metrics.Percentage != 25 {
		t.Fatalf("expected percentage=25, got %v", metrics.Percentage)
	}
	if metrics.CompletionsCount != 1 {
		t.Fatalf("expected completions_count=1, got %d", metrics.CompletionsCount)
	}
}

func TestTaskHistoryMetricsDoNotExposeOtherUsers(t *testing.T) {
	router := setupAuthRouteTest(t)
	ownerUsername := fmt.Sprintf("phase7owner_%d", time.Now().UnixNano()%1_000_000_000)
	otherUsername := fmt.Sprintf("phase7other_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, ownerUsername)
	cleanupTaskRouteUser(t, otherUsername)
	t.Cleanup(func() {
		cleanupTaskRouteUser(t, ownerUsername)
		cleanupTaskRouteUser(t, otherUsername)
	})

	ownerCookie := registerPhase5User(t, router, ownerUsername, password)
	otherCookie := registerPhase5User(t, router, otherUsername, password)
	schedule := createRouteSchedule(t, router, ownerCookie, "Phase 7 private", "09:00", "10:00")
	task := findTaskBySchedule(t, getRouteTodayTasks(t, router, ownerCookie).Data.Tasks, schedule.Data.Schedule.ID)
	updatePhase7Task(t, router, ownerCookie, task.ID, map[string]interface{}{
		"status": "completed",
	})

	today := phase7Date(0)
	history := getPhase7History(t, router, otherCookie, today, today)
	if len(history.Days) != 1 {
		t.Fatalf("expected one day for other user history, got %d", len(history.Days))
	}
	if history.Days[0].Total != 0 || history.Days[0].Completed != 0 {
		t.Fatalf("expected other user history to be empty, got %+v", history.Days[0])
	}

	metrics := getPhase7Metrics(t, router, otherCookie, today, today)
	if metrics.Total != 0 || metrics.CompletionsCount != 0 {
		t.Fatalf("expected other user metrics to be empty, got %+v", metrics)
	}
}

func TestTaskHistoryRejectsInvalidDates(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("phase7dates_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	authCookie := registerPhase5User(t, router, username, password)
	assertPhase7BadRequest(t, router, authCookie, "/api/v1/tasks/history?from=bad-date")
	assertPhase7BadRequest(t, router, authCookie, "/api/v1/tasks/history?to=bad-date")
	assertPhase7BadRequest(t, router, authCookie, "/api/v1/tasks/history?from=2026-05-05&to=2026-05-01")
	assertPhase7BadRequest(t, router, authCookie, "/api/v1/tasks/metrics?from=2026-01-01&to=2026-05-01")
}

type phase7HistoryEnvelope struct {
	Data struct {
		History phase7History `json:"history"`
	} `json:"data"`
}

type phase7MetricsEnvelope struct {
	Data struct {
		Metrics phase7Metrics `json:"metrics"`
	} `json:"data"`
}

type phase7History struct {
	From string             `json:"from"`
	To   string             `json:"to"`
	Days []phase7HistoryDay `json:"days"`
}

type phase7HistoryDay struct {
	Date       string  `json:"date"`
	Total      int     `json:"total"`
	Completed  int     `json:"completed"`
	Pending    int     `json:"pending"`
	Skipped    int     `json:"skipped"`
	Failed     int     `json:"failed"`
	InProgress int     `json:"in_progress"`
	Percentage float64 `json:"percentage"`
}

type phase7Metrics struct {
	From             string  `json:"from"`
	To               string  `json:"to"`
	Total            int     `json:"total"`
	Completed        int     `json:"completed"`
	Pending          int     `json:"pending"`
	Skipped          int     `json:"skipped"`
	Failed           int     `json:"failed"`
	InProgress       int     `json:"in_progress"`
	Percentage       float64 `json:"percentage"`
	DaysCount        int     `json:"days_count"`
	CompletionsCount int     `json:"completions_count"`
	ActiveDays       int     `json:"active_days"`
	CurrentStreak    int     `json:"current_streak"`
}

func getPhase7History(t *testing.T, router *gin.Engine, authCookie *http.Cookie, from time.Time, to time.Time) phase7History {
	t.Helper()

	url := fmt.Sprintf("/api/v1/tasks/history?from=%s&to=%s", from.Format("2006-01-02"), to.Format("2006-01-02"))
	status, body, _, _ := performJSONPayload(router, http.MethodGet, url, nil, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("history status = %d body = %s", status, body)
	}
	var envelope phase7HistoryEnvelope
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		t.Fatalf("decode history response: %v body=%s", err, body)
	}
	return envelope.Data.History
}

func getPhase7Metrics(t *testing.T, router *gin.Engine, authCookie *http.Cookie, from time.Time, to time.Time) phase7Metrics {
	t.Helper()

	url := fmt.Sprintf("/api/v1/tasks/metrics?from=%s&to=%s", from.Format("2006-01-02"), to.Format("2006-01-02"))
	status, body, _, _ := performJSONPayload(router, http.MethodGet, url, nil, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("metrics status = %d body = %s", status, body)
	}
	var envelope phase7MetricsEnvelope
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		t.Fatalf("decode metrics response: %v body=%s", err, body)
	}
	return envelope.Data.Metrics
}

func updatePhase7Task(t *testing.T, router *gin.Engine, authCookie *http.Cookie, taskID string, payload map[string]interface{}) {
	t.Helper()

	status, body, _, _ := performJSONPayload(router, http.MethodPut, "/api/v1/tasks/"+taskID, payload, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("update task %s status = %d body = %s", taskID, status, body)
	}
}

func assertPhase7BadRequest(t *testing.T, router *gin.Engine, authCookie *http.Cookie, path string) {
	t.Helper()

	status, body, _, _ := performJSONPayload(router, http.MethodGet, path, nil, []*http.Cookie{authCookie})
	if status != http.StatusBadRequest {
		t.Fatalf("expected 400 for %s, got %d body=%s", path, status, body)
	}
}

func phase7Date(offsetDays int) time.Time {
	now := time.Now().UTC().AddDate(0, 0, offsetDays)
	return time.Date(now.Year(), now.Month(), now.Day(), 12, 0, 0, 0, time.UTC)
}

func mapPhase7Days(days []phase7HistoryDay) map[string]phase7HistoryDay {
	dayByDate := make(map[string]phase7HistoryDay, len(days))
	for _, day := range days {
		dayByDate[day.Date] = day
	}
	return dayByDate
}
