package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type gapFeedItem struct {
	ID                string          `json:"id"`
	ScheduleID        string          `json:"schedule_id"`
	StatusLevel       string          `json:"status_level"`
	PriorityLevel     string          `json:"priority_level"`
	IsRequired        bool            `json:"is_required"`
	ScheduleStartTime *string         `json:"schedule_start_time"`
	ScheduleEndTime   *string         `json:"schedule_end_time"`
	Category          string          `json:"category"`
	FrequencyConfig   json.RawMessage `json:"frequency_config"`
}

func gapUsername(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano()%1_000_000_000)
}

func gapUsers(t *testing.T, router *gin.Engine, prefixes ...string) ([]string, []*http.Cookie) {
	t.Helper()

	usernames := make([]string, 0, len(prefixes))
	cookies := make([]*http.Cookie, 0, len(prefixes))
	for _, prefix := range prefixes {
		username := gapUsername(prefix)
		cleanupTaskRouteUser(t, username)
		usernames = append(usernames, username)
	}
	t.Cleanup(func() {
		for _, username := range usernames {
			cleanupTaskRouteUser(t, username)
		}
	})
	for _, username := range usernames {
		cookies = append(cookies, registerPhase5User(t, router, username, "Test1234"))
	}
	return usernames, cookies
}

func gapRequest(t *testing.T, router *gin.Engine, method string, path string, payload interface{}, cookie *http.Cookie, wantStatus int) string {
	t.Helper()

	status, body, _, _ := performJSONPayload(router, method, path, payload, []*http.Cookie{cookie})
	if status != wantStatus {
		t.Fatalf("%s %s status = %d, want %d, body = %s", method, path, status, wantStatus, body)
	}
	return body
}

func gapTodayItem(t *testing.T, router *gin.Engine, cookie *http.Cookie, scheduleID string) gapFeedItem {
	t.Helper()

	body := gapRequest(t, router, http.MethodGet, "/api/v1/tasks/today", nil, cookie, http.StatusOK)
	var response struct {
		Data struct {
			Tasks []gapFeedItem `json:"tasks"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &response); err != nil {
		t.Fatalf("decode today: %v body=%s", err, body)
	}
	matches := 0
	var found gapFeedItem
	for _, item := range response.Data.Tasks {
		if item.ScheduleID == scheduleID {
			matches++
			found = item
		}
	}
	if matches != 1 {
		t.Fatalf("expected 1 task for schedule %s today, got %d", scheduleID, matches)
	}
	return found
}

func TestInstanceOverridesChangeOnlyOneDay(t *testing.T) {
	router := setupAuthRouteTest(t)
	_, cookies := gapUsers(t, router, "gapoverride")
	owner := cookies[0]

	schedule := createRouteSchedule(t, router, owner, "Override run", "18:30", "19:30")
	task := gapTodayItem(t, router, owner, schedule.Data.Schedule.ID)

	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"schedule_start_time": "20:00",
		"schedule_end_time":   "21:00",
		"priority_level":      "medium",
		"is_required":         true,
		"category":            "Salud",
	}, owner, http.StatusOK)

	item := gapTodayItem(t, router, owner, schedule.Data.Schedule.ID)
	if item.ScheduleStartTime == nil || *item.ScheduleStartTime != "20:00" {
		t.Fatalf("expected instance start 20:00, got %v", item.ScheduleStartTime)
	}
	if item.ScheduleEndTime == nil || *item.ScheduleEndTime != "21:00" {
		t.Fatalf("expected instance end 21:00, got %v", item.ScheduleEndTime)
	}
	if item.PriorityLevel != "medium" || !item.IsRequired || item.Category != "Salud" {
		t.Fatalf("expected instance overrides, got %+v", item)
	}

	routine := getRouteSchedule(t, router, owner, schedule.Data.Schedule.ID)
	if routine.Data.Schedule.Priority != "urgent" || routine.Data.Schedule.IsRequired {
		t.Fatalf("instance edit must not change the routine, got %+v", routine.Data.Schedule)
	}

	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]interface{}{
		"apply_to_schedule":   true,
		"schedule_start_time": "07:00",
		"schedule_end_time":   "08:00",
	}, owner, http.StatusOK)

	item = gapTodayItem(t, router, owner, schedule.Data.Schedule.ID)
	if item.ScheduleStartTime == nil || *item.ScheduleStartTime != "07:00" {
		t.Fatalf("routine edit should clear instance override, got start %v", item.ScheduleStartTime)
	}
	if item.PriorityLevel != "urgent" || item.IsRequired {
		t.Fatalf("routine edit should restore routine values, got %+v", item)
	}
}

func TestDismissedRoutineTaskStaysDismissedAndCounts(t *testing.T) {
	router := setupAuthRouteTest(t)
	_, cookies := gapUsers(t, router, "gapdismiss")
	owner := cookies[0]

	scheduleA := createRouteSchedule(t, router, owner, "Dismiss via status", "", "")
	scheduleB := createRouteSchedule(t, router, owner, "Dismiss via delete", "10:00", "11:00")
	taskA := gapTodayItem(t, router, owner, scheduleA.Data.Schedule.ID)
	taskB := gapTodayItem(t, router, owner, scheduleB.Data.Schedule.ID)

	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+taskA.ID, map[string]string{"status": "bogus"}, owner, http.StatusBadRequest)
	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+taskA.ID, map[string]string{"status": "dismissed"}, owner, http.StatusOK)
	gapRequest(t, router, http.MethodDelete, "/api/v1/tasks/"+taskB.ID, nil, owner, http.StatusOK)

	for _, scheduleID := range []string{scheduleA.Data.Schedule.ID, scheduleB.Data.Schedule.ID} {
		item := gapTodayItem(t, router, owner, scheduleID)
		if item.StatusLevel != "dismissed" {
			t.Fatalf("expected dismissed after reload, got %s", item.StatusLevel)
		}
	}
	if item := gapTodayItem(t, router, owner, scheduleB.Data.Schedule.ID); item.ID != taskB.ID {
		t.Fatalf("delete of a routine instance must keep the row, got new id %s", item.ID)
	}

	body := gapRequest(t, router, http.MethodGet, "/api/v1/tasks/progress", nil, owner, http.StatusOK)
	var progress struct {
		Data struct {
			Progress struct {
				Total     int `json:"total"`
				Dismissed int `json:"dismissed"`
			} `json:"progress"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &progress); err != nil {
		t.Fatalf("decode progress: %v", err)
	}
	if progress.Data.Progress.Total != 2 || progress.Data.Progress.Dismissed != 2 {
		t.Fatalf("expected 2 dismissed of 2, got %+v", progress.Data.Progress)
	}

	today := time.Now().Format("2006-01-02")
	body = gapRequest(t, router, http.MethodGet, "/api/v1/tasks/metrics?from="+today+"&to="+today, nil, owner, http.StatusOK)
	var metrics struct {
		Data struct {
			Metrics struct {
				Dismissed     int     `json:"dismissed"`
				DismissalRate float64 `json:"dismissal_rate"`
			} `json:"metrics"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &metrics); err != nil {
		t.Fatalf("decode metrics: %v", err)
	}
	if metrics.Data.Metrics.Dismissed != 2 || metrics.Data.Metrics.DismissalRate != 100 {
		t.Fatalf("expected dismissal_rate 100, got %+v", metrics.Data.Metrics)
	}

	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+taskA.ID, map[string]string{"status": "pending"}, owner, http.StatusOK)
	if item := gapTodayItem(t, router, owner, scheduleA.Data.Schedule.ID); item.StatusLevel != "pending" {
		t.Fatalf("expected restored task to be pending, got %s", item.StatusLevel)
	}
}

func TestSharedManagerCanEditPauseAndCancelRoutine(t *testing.T) {
	router := setupAuthRouteTest(t)
	usernames, cookies := gapUsers(t, router, "gapschedowner", "gapschedmanager", "gapschedviewer")
	owner, manager, viewer := cookies[0], cookies[1], cookies[2]
	createPhase9Grant(t, router, owner, usernames[1], "manage")
	createPhase9Grant(t, router, owner, usernames[2], "view")

	schedule := createRouteSchedule(t, router, owner, "Shared routine", "09:00", "10:00")
	path := "/api/v1/schedules/" + schedule.Data.Schedule.ID
	edit := map[string]interface{}{
		"title":               "Shared routine fixed",
		"frequency":           "daily",
		"priority_level":      "medium",
		"schedule_start_time": "09:00",
		"schedule_end_time":   "10:00",
	}

	gapRequest(t, router, http.MethodPut, path, edit, viewer, http.StatusForbidden)
	gapRequest(t, router, http.MethodPost, path+"/pause", nil, viewer, http.StatusForbidden)
	gapRequest(t, router, http.MethodDelete, path, nil, viewer, http.StatusForbidden)

	gapRequest(t, router, http.MethodPut, path, edit, manager, http.StatusOK)
	if getRouteSchedule(t, router, owner, schedule.Data.Schedule.ID).Data.Schedule.Title != "Shared routine fixed" {
		t.Fatalf("manager edit did not persist")
	}
	gapRequest(t, router, http.MethodPost, path+"/pause", nil, manager, http.StatusOK)
	gapRequest(t, router, http.MethodPost, path+"/resume", nil, manager, http.StatusOK)
	gapRequest(t, router, http.MethodDelete, path, nil, manager, http.StatusOK)
}

func TestSharedViewerReadsOwnerProgress(t *testing.T) {
	router := setupAuthRouteTest(t)
	usernames, cookies := gapUsers(t, router, "gapprogowner", "gapprogviewer", "gapprogother")
	owner, viewer, other := cookies[0], cookies[1], cookies[2]
	createPhase9Grant(t, router, owner, usernames[1], "view")
	ownerID := getPhase9UserID(t, usernames[0])

	schedule := createRouteSchedule(t, router, owner, "Owner progress", "09:00", "10:00")
	task := gapTodayItem(t, router, owner, schedule.Data.Schedule.ID)
	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{"status": "completed"}, owner, http.StatusOK)

	today := time.Now().Format("2006-01-02")
	query := "?owner_user_id=" + ownerID + "&from=" + today + "&to=" + today
	for _, path := range []string{"/api/v1/tasks/history", "/api/v1/tasks/metrics", "/api/v1/tasks/progress"} {
		gapRequest(t, router, http.MethodGet, path+query, nil, other, http.StatusForbidden)
	}

	body := gapRequest(t, router, http.MethodGet, "/api/v1/tasks/metrics"+query, nil, viewer, http.StatusOK)
	var metrics struct {
		Data struct {
			Metrics struct {
				Total     int `json:"total"`
				Completed int `json:"completed"`
			} `json:"metrics"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &metrics); err != nil {
		t.Fatalf("decode metrics: %v", err)
	}
	if metrics.Data.Metrics.Total != 1 || metrics.Data.Metrics.Completed != 1 {
		t.Fatalf("expected owner metrics 1/1, got %+v", metrics.Data.Metrics)
	}
	gapRequest(t, router, http.MethodGet, "/api/v1/tasks/history"+query, nil, viewer, http.StatusOK)
	gapRequest(t, router, http.MethodGet, "/api/v1/tasks/progress"+query, nil, viewer, http.StatusOK)
}

func TestOneOffTaskForSharedOwner(t *testing.T) {
	router := setupAuthRouteTest(t)
	usernames, cookies := gapUsers(t, router, "gaponeowner", "gaponemanager", "gaponeviewer")
	owner, manager, viewer := cookies[0], cookies[1], cookies[2]
	createPhase9Grant(t, router, owner, usernames[1], "manage")
	createPhase9Grant(t, router, owner, usernames[2], "view")
	ownerID := getPhase9UserID(t, usernames[0])
	managerID := getPhase9UserID(t, usernames[1])
	today := time.Now().Format("2006-01-02")

	payload := map[string]interface{}{
		"title":           "Shared one-off",
		"startDate":       today + "T00:00:00Z",
		"repeating":       false,
		"frequency":       "custom",
		"frequencyConfig": map[string]interface{}{"singleInstance": true},
		"owner_user_id":   ownerID,
	}
	gapRequest(t, router, http.MethodPost, "/api/v1/tasks", payload, viewer, http.StatusForbidden)
	gapRequest(t, router, http.MethodPost, "/api/v1/tasks", payload, manager, http.StatusOK)

	scheduleOwner, createdBy := getPhase9ScheduleOwnership(t, "Shared one-off")
	if scheduleOwner != ownerID || createdBy != managerID {
		t.Fatalf("expected owner %s created by %s, got owner %s created by %s", ownerID, managerID, scheduleOwner, createdBy)
	}
	day := getRouteDayTasks(t, router, owner, today)
	if len(countTasksByTitle(day.Data.Tasks, "Shared one-off")) != 1 {
		t.Fatalf("expected one-off on owner's day")
	}
}

func TestTaskNotesCanBeCleared(t *testing.T) {
	router := setupAuthRouteTest(t)
	_, cookies := gapUsers(t, router, "gapnotes")
	owner := cookies[0]

	schedule := createRouteSchedule(t, router, owner, "Notes task", "09:00", "10:00")
	task := gapTodayItem(t, router, owner, schedule.Data.Schedule.ID)

	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{"notes": "Una nota"}, owner, http.StatusOK)
	if getPhase6TaskState(t, task.ID).Notes.String != "Una nota" {
		t.Fatalf("expected note saved")
	}
	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{"title": "Notes task"}, owner, http.StatusOK)
	if getPhase6TaskState(t, task.ID).Notes.String != "Una nota" {
		t.Fatalf("omitting notes must keep the note")
	}
	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{"notes": ""}, owner, http.StatusOK)
	if state := getPhase6TaskState(t, task.ID); state.Notes.Valid {
		t.Fatalf("expected note cleared, got %q", state.Notes.String)
	}
}

func TestSharingGrantLevelCanChange(t *testing.T) {
	router := setupAuthRouteTest(t)
	usernames, cookies := gapUsers(t, router, "gapgrantowner", "gapgrantee", "gapgrantother")
	owner, grantee, other := cookies[0], cookies[1], cookies[2]
	grantID := createPhase9Grant(t, router, owner, usernames[1], "view")
	path := "/api/v1/sharing/grants/" + grantID

	gapRequest(t, router, http.MethodPut, path, map[string]string{"access_level": "admin"}, owner, http.StatusBadRequest)
	gapRequest(t, router, http.MethodPut, path, map[string]string{"access_level": "manage"}, other, http.StatusNotFound)

	body := gapRequest(t, router, http.MethodPut, path, map[string]string{"access_level": "manage"}, owner, http.StatusOK)
	var response struct {
		Data struct {
			Grant struct {
				ID           string `json:"id"`
				AccessLevel  string `json:"access_level"`
				CanCreate    bool   `json:"can_create"`
				CanEditTasks bool   `json:"can_edit_tasks"`
			} `json:"grant"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &response); err != nil {
		t.Fatalf("decode grant: %v", err)
	}
	grant := response.Data.Grant
	if grant.ID != grantID || grant.AccessLevel != "manage" || !grant.CanCreate || !grant.CanEditTasks {
		t.Fatalf("expected same grant upgraded to manage, got %+v", grant)
	}

	ownerID := getPhase9UserID(t, usernames[0])
	gapRequest(t, router, http.MethodPost, "/api/v1/schedules", phase9SchedulePayload("Upgraded grantee routine", ownerID), grantee, http.StatusCreated)
}

func TestDayFeedIncludesCategoryAndFrequencyConfig(t *testing.T) {
	router := setupAuthRouteTest(t)
	_, cookies := gapUsers(t, router, "gapfeed")
	owner := cookies[0]

	body := gapRequest(t, router, http.MethodPost, "/api/v1/schedules", map[string]interface{}{
		"title":            "Agua",
		"frequency":        "daily",
		"category":         "Salud",
		"frequency_config": map[string]interface{}{"kind": "water"},
		"target_count":     8,
	}, owner, http.StatusCreated)
	var created routeScheduleResponse
	if err := json.Unmarshal([]byte(body), &created); err != nil {
		t.Fatalf("decode schedule: %v", err)
	}

	item := gapTodayItem(t, router, owner, created.Data.Schedule.ID)
	if item.Category != "Salud" {
		t.Fatalf("expected category in feed, got %q", item.Category)
	}
	var config map[string]string
	if err := json.Unmarshal(item.FrequencyConfig, &config); err != nil || config["kind"] != "water" {
		t.Fatalf("expected frequency_config kind=water, got %s", item.FrequencyConfig)
	}
}

func TestScheduleHistoryReportsStreak(t *testing.T) {
	router := setupAuthRouteTest(t)
	usernames, cookies := gapUsers(t, router, "gaphistowner", "gaphistviewer", "gaphistother")
	owner, viewer, other := cookies[0], cookies[1], cookies[2]
	createPhase9Grant(t, router, owner, usernames[1], "view")

	schedule := createRouteSchedule(t, router, owner, "Routine history", "09:00", "10:00")
	task := gapTodayItem(t, router, owner, schedule.Data.Schedule.ID)
	gapRequest(t, router, http.MethodPut, "/api/v1/tasks/"+task.ID, map[string]string{"status": "completed"}, owner, http.StatusOK)

	path := "/api/v1/schedules/" + schedule.Data.Schedule.ID + "/history"
	gapRequest(t, router, http.MethodGet, path, nil, other, http.StatusForbidden)
	gapRequest(t, router, http.MethodGet, path+"?from=bad", nil, owner, http.StatusBadRequest)

	body := gapRequest(t, router, http.MethodGet, path, nil, viewer, http.StatusOK)
	var response struct {
		Data struct {
			History struct {
				Entries []struct {
					TaskID      string `json:"task_id"`
					StatusLevel string `json:"status_level"`
				} `json:"entries"`
				Completed     int `json:"completed"`
				CurrentStreak int `json:"current_streak"`
				BestStreak    int `json:"best_streak"`
			} `json:"history"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &response); err != nil {
		t.Fatalf("decode history: %v", err)
	}
	history := response.Data.History
	if len(history.Entries) != 1 || history.Entries[0].TaskID != task.ID || history.Entries[0].StatusLevel != "completed" {
		t.Fatalf("expected one completed entry, got %+v", history.Entries)
	}
	if history.Completed != 1 || history.CurrentStreak != 1 || history.BestStreak != 1 {
		t.Fatalf("expected streak 1, got %+v", history)
	}
}

func TestProfileUpdateValidatesFields(t *testing.T) {
	router := setupAuthRouteTest(t)
	usernames, cookies := gapUsers(t, router, "gapprofile", "gapprofiletaken")
	user := cookies[0]

	body := gapRequest(t, router, http.MethodPut, "/api/v1/profile", map[string]string{"fullname": "A", "email": "no-es-correo"}, user, http.StatusUnprocessableEntity)
	var invalid struct {
		Data struct {
			Fields map[string]string `json:"fields"`
		} `json:"data"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal([]byte(body), &invalid); err != nil {
		t.Fatalf("decode 422: %v body=%s", err, body)
	}
	if invalid.Error != "validation_error" || invalid.Data.Fields["fullname"] == "" || invalid.Data.Fields["email"] == "" {
		t.Fatalf("expected fullname and email field errors, got %s", body)
	}

	gapRequest(t, router, http.MethodPut, "/api/v1/profile", map[string]string{
		"fullname": "Perfil Prueba",
		"email":    usernames[1] + "@EXAMPLE.com",
	}, user, http.StatusConflict)

	body = gapRequest(t, router, http.MethodPut, "/api/v1/profile", map[string]string{
		"fullname": "  Perfil Prueba ",
		"email":    usernames[0] + "@EXAMPLE.com",
	}, user, http.StatusOK)
	var updated struct {
		Data struct {
			Profile struct {
				Fullname string `json:"fullname"`
				Email    string `json:"email"`
			} `json:"profile"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &updated); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	if updated.Data.Profile.Fullname != "Perfil Prueba" || updated.Data.Profile.Email != usernames[0]+"@example.com" {
		t.Fatalf("expected normalized profile, got %+v", updated.Data.Profile)
	}
}
