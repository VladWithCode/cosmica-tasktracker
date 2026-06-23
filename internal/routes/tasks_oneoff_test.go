package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
)

type routeDayResponse struct {
	Data struct {
		Date  string                 `json:"date"`
		Tasks []routeDayTaskFeedItem `json:"tasks"`
	} `json:"data"`
}

type routeDayTaskFeedItem struct {
	ID                string  `json:"id"`
	ScheduleID        string  `json:"schedule_id"`
	StatusLevel       string  `json:"status_level"`
	Title             string  `json:"title"`
	ScheduleStartTime *string `json:"schedule_start_time"`
}

func getRouteDayTasks(
	t *testing.T,
	router *gin.Engine,
	authCookie *http.Cookie,
	date string,
) routeDayResponse {
	t.Helper()

	status, body, _, _ := performJSONPayload(
		router,
		http.MethodGet,
		"/api/v1/tasks/day?date="+date,
		nil,
		[]*http.Cookie{authCookie},
	)
	if status != http.StatusOK {
		t.Fatalf("day tasks status = %d body = %s", status, body)
	}
	var response routeDayResponse
	if err := json.Unmarshal([]byte(body), &response); err != nil {
		t.Fatalf("decode day response: %v body=%s", err, body)
	}
	return response
}

func countTasksByTitle(tasks []routeDayTaskFeedItem, title string) []routeDayTaskFeedItem {
	matches := make([]routeDayTaskFeedItem, 0, len(tasks))
	for _, task := range tasks {
		if task.Title == title {
			matches = append(matches, task)
		}
	}
	return matches
}

// TestOneOffTaskAppearsOnlyOnSelectedAgendaDate verifies the Agenda quick
// one-off flow end to end against a real DB: a non-repeating "custom" task
// created for a future selected date with a nighttime start time must appear
// only on that date (not today), must not duplicate, and must keep its
// schedule_start_time.
func TestOneOffTaskAppearsOnlyOnSelectedAgendaDate(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("oneoff_%d", time.Now().UnixNano()%1_000_000_000)
	password := "Test1234"
	cleanupTaskRouteUser(t, username)
	t.Cleanup(func() { cleanupTaskRouteUser(t, username) })

	status, body, cookies, _ := performJSONPayload(router, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    username + "@example.com",
		"fullname": "One Off Tester",
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

	today := time.Now()
	todayStr := today.Format("2006-01-02")
	selected := today.AddDate(0, 0, 7)
	selectedStr := selected.Format("2006-01-02")

	const title = "Agenda one-off test"
	// Literal-UTC strings, mirroring the frontend payload: the wall-clock day
	// and hour are preserved server-side without timezone drift.
	status, body, _, _ = performJSONPayload(router, http.MethodPost, "/api/v1/tasks", map[string]interface{}{
		"title":           title,
		"startDate":       selectedStr + "T00:00:00Z",
		"startTime":       selectedStr + "T23:30:00Z",
		"repeating":       false,
		"frequency":       "custom",
		"frequencyConfig": map[string]interface{}{"singleInstance": true},
		"priority":        "medium",
	}, []*http.Cookie{authCookie})
	if status != http.StatusOK {
		t.Fatalf("create one-off status = %d body = %s", status, body)
	}

	// 1. Appears on the selected date.
	selectedDay := getRouteDayTasks(t, router, authCookie, selectedStr)
	selectedMatches := countTasksByTitle(selectedDay.Data.Tasks, title)
	if len(selectedMatches) != 1 {
		t.Fatalf("expected exactly 1 one-off on %s, got %d (tasks=%+v)", selectedStr, len(selectedMatches), selectedDay.Data.Tasks)
	}

	// 4. Start time preserved as the user-chosen 23:30.
	st := selectedMatches[0].ScheduleStartTime
	stValue := "<nil>"
	if st != nil {
		stValue = *st
	}
	if st == nil || *st != "23:30" {
		t.Fatalf("expected schedule_start_time 23:30, got %q", stValue)
	}

	// 2. Does NOT appear on today (selected != today).
	todayDay := getRouteDayTasks(t, router, authCookie, todayStr)
	if got := len(countTasksByTitle(todayDay.Data.Tasks, title)); got != 0 {
		t.Fatalf("one-off must not appear on today %s, found %d", todayStr, got)
	}

	// 3. No duplication on repeated reads of the selected date (lazy generation
	//    must not create a second instance).
	selectedDayAgain := getRouteDayTasks(t, router, authCookie, selectedStr)
	if got := len(countTasksByTitle(selectedDayAgain.Data.Tasks, title)); got != 1 {
		t.Fatalf("one-off duplicated on re-read of %s: expected 1, got %d", selectedStr, got)
	}
}
