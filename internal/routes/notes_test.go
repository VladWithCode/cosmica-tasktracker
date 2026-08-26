package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

type noteResponse struct {
	Data struct {
		Note struct {
			ID        string `json:"id"`
			UserID    string `json:"user_id"`
			Content   string `json:"content"`
			CreatedAt string `json:"created_at"`
			UpdatedAt string `json:"updated_at"`
		} `json:"note"`
	} `json:"data"`
	Message string `json:"message"`
}

type notesListResponse struct {
	Data struct {
		Notes []struct {
			ID      string `json:"id"`
			UserID  string `json:"user_id"`
			Content string `json:"content"`
		} `json:"notes"`
		Date string `json:"date"`
	} `json:"data"`
	Message string `json:"message"`
}

func cleanupNotesUser(t *testing.T, username string) {
	t.Helper()
	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	queries := []string{
		`WITH target AS (SELECT id FROM users WHERE username = $1)
		 DELETE FROM notes WHERE user_id IN (SELECT id FROM target)`,
		`DELETE FROM users WHERE username = $1`,
	}
	for _, q := range queries {
		if _, err := conn.Exec(context.Background(), q, username); err != nil {
			t.Fatalf("cleanup query failed: %v", err)
		}
	}
}

func registerNotesUser(t *testing.T, router *gin.Engine, username string) *http.Cookie {
	t.Helper()
	payload := map[string]string{
		"email":    username + "@example.com",
		"fullname": "Notes User",
		"password": "Test1234",
		"username": username,
	}
	status, body, cookies, _ := performJSONPayload(router, http.MethodPost, "/api/v1/auth/register", payload, nil)
	if status != http.StatusCreated {
		t.Fatalf("register status = %d body = %s", status, body)
	}
	cookie := findCookie(cookies, auth.DefaultCookieName)
	if cookie == nil {
		t.Fatalf("expected auth cookie")
	}
	return cookie
}

func TestNotesCreateAndList(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("notes_create_%d", time.Now().UnixNano()%1_000_000_000)
	cleanupNotesUser(t, username)
	t.Cleanup(func() { cleanupNotesUser(t, username) })

	cookie := registerNotesUser(t, router, username)

	// create note
	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/notes",
		map[string]interface{}{"content": "Hello world"},
		[]*http.Cookie{cookie})
	if status != http.StatusCreated {
		t.Fatalf("create status = %d body = %s", status, body)
	}
	var created noteResponse
	if err := json.Unmarshal([]byte(body), &created); err != nil {
		t.Fatalf("unmarshal: %v body=%s", err, body)
	}
	if created.Data.Note.Content != "Hello world" {
		t.Fatalf("expected content 'Hello world', got %q", created.Data.Note.Content)
	}
	if created.Data.Note.ID == "" {
		t.Fatalf("expected note id, got empty")
	}

	// list today's notes
	status, body, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/notes", nil, []*http.Cookie{cookie})
	if status != http.StatusOK {
		t.Fatalf("list status = %d body = %s", status, body)
	}
	var listed notesListResponse
	if err := json.Unmarshal([]byte(body), &listed); err != nil {
		t.Fatalf("unmarshal list: %v body=%s", err, body)
	}
	if len(listed.Data.Notes) != 1 {
		t.Fatalf("expected 1 note today, got %d", len(listed.Data.Notes))
	}
	if listed.Data.Notes[0].Content != "Hello world" {
		t.Fatalf("expected content match")
	}
}

func TestNotesEmptyContentRejected(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("notes_empty_%d", time.Now().UnixNano()%1_000_000_000)
	cleanupNotesUser(t, username)
	t.Cleanup(func() { cleanupNotesUser(t, username) })

	cookie := registerNotesUser(t, router, username)

	for _, c := range []string{"", "   ", "\n\t  "} {
		status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/notes",
			map[string]interface{}{"content": c},
			[]*http.Cookie{cookie})
		if status != http.StatusBadRequest {
			t.Fatalf("empty content %q: expected 400 got %d body=%s", c, status, body)
		}
	}
}

func TestNotesInvalidDateRejected(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("notes_date_%d", time.Now().UnixNano()%1_000_000_000)
	cleanupNotesUser(t, username)
	t.Cleanup(func() { cleanupNotesUser(t, username) })

	cookie := registerNotesUser(t, router, username)

	status, _, _, _ := performJSONPayload(router, http.MethodGet, "/api/v1/notes?date=not-a-date", nil, []*http.Cookie{cookie})
	if status != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid date, got %d", status)
	}
}

func TestNotesGetByIDOwnership(t *testing.T) {
	router := setupAuthRouteTest(t)
	owner := fmt.Sprintf("notes_get_owner_%d", time.Now().UnixNano()%1_000_000_000)
	other := fmt.Sprintf("notes_get_other_%d", time.Now().UnixNano()%1_000_000_000+2)
	cleanupNotesUser(t, owner)
	cleanupNotesUser(t, other)
	t.Cleanup(func() {
		cleanupNotesUser(t, owner)
		cleanupNotesUser(t, other)
	})

	ownerCookie := registerNotesUser(t, router, owner)
	otherCookie := registerNotesUser(t, router, other)

	// owner creates note
	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/notes",
		map[string]interface{}{"content": "private"}, []*http.Cookie{ownerCookie})
	if status != http.StatusCreated {
		t.Fatalf("create status = %d body = %s", status, body)
	}
	var created noteResponse
	_ = json.Unmarshal([]byte(body), &created)
	noteID := created.Data.Note.ID
	if noteID == "" {
		t.Fatalf("missing note id")
	}

	// owner GET own note → 200
	status, body, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/notes/"+noteID, nil,
		[]*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("owner get status = %d body = %s", status, body)
	}
	var fetched noteResponse
	if err := json.Unmarshal([]byte(body), &fetched); err != nil {
		t.Fatalf("unmarshal: %v body=%s", err, body)
	}
	if fetched.Data.Note.Content != "private" {
		t.Fatalf("expected 'private', got %q", fetched.Data.Note.Content)
	}

	// other user GET → 404
	status, _, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/notes/"+noteID, nil,
		[]*http.Cookie{otherCookie})
	if status != http.StatusNotFound {
		t.Fatalf("expected 404 for cross-user GET, got %d", status)
	}

	// invalid uuid → 400
	status, _, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/notes/not-a-uuid", nil,
		[]*http.Cookie{ownerCookie})
	if status != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid id, got %d", status)
	}

	// non-existent uuid → 404
	status, _, _, _ = performJSONPayload(router, http.MethodGet,
		"/api/v1/notes/00000000-0000-0000-0000-000000000000", nil,
		[]*http.Cookie{ownerCookie})
	if status != http.StatusNotFound {
		t.Fatalf("expected 404 for missing id, got %d", status)
	}
}

func TestNotesOnlyOwnerCanListEditDelete(t *testing.T) {
	router := setupAuthRouteTest(t)
	owner := fmt.Sprintf("notes_owner_%d", time.Now().UnixNano()%1_000_000_000)
	other := fmt.Sprintf("notes_other_%d", time.Now().UnixNano()%1_000_000_000+1)
	cleanupNotesUser(t, owner)
	cleanupNotesUser(t, other)
	t.Cleanup(func() {
		cleanupNotesUser(t, owner)
		cleanupNotesUser(t, other)
	})

	ownerCookie := registerNotesUser(t, router, owner)
	otherCookie := registerNotesUser(t, router, other)

	// owner creates a note
	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/notes",
		map[string]interface{}{"content": "owner secret"},
		[]*http.Cookie{ownerCookie})
	if status != http.StatusCreated {
		t.Fatalf("owner create status = %d body = %s", status, body)
	}
	var created noteResponse
	_ = json.Unmarshal([]byte(body), &created)
	noteID := created.Data.Note.ID
	if noteID == "" {
		t.Fatalf("missing note id")
	}

	// other user lists today → should NOT see owner's note
	status, body, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/notes", nil, []*http.Cookie{otherCookie})
	if status != http.StatusOK {
		t.Fatalf("other list status = %d body = %s", status, body)
	}
	var listed notesListResponse
	_ = json.Unmarshal([]byte(body), &listed)
	if len(listed.Data.Notes) != 0 {
		t.Fatalf("expected other user to see 0 notes, got %d", len(listed.Data.Notes))
	}

	// other user tries to update owner's note → 404
	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/notes/"+noteID,
		map[string]interface{}{"content": "hijacked"},
		[]*http.Cookie{otherCookie})
	if status != http.StatusNotFound {
		t.Fatalf("expected 404 on cross-user update, got %d body=%s", status, body)
	}

	// other user tries to delete owner's note → 404
	status, body, _, _ = performJSONPayload(router, http.MethodDelete, "/api/v1/notes/"+noteID, nil,
		[]*http.Cookie{otherCookie})
	if status != http.StatusNotFound {
		t.Fatalf("expected 404 on cross-user delete, got %d body=%s", status, body)
	}

	// confirm owner's note still intact
	status, body, _, _ = performJSONPayload(router, http.MethodGet, "/api/v1/notes", nil, []*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("owner list status = %d body = %s", status, body)
	}
	_ = json.Unmarshal([]byte(body), &listed)
	if len(listed.Data.Notes) != 1 {
		t.Fatalf("expected owner to still have 1 note, got %d", len(listed.Data.Notes))
	}
	if listed.Data.Notes[0].Content != "owner secret" {
		t.Fatalf("expected unchanged content, got %q", listed.Data.Notes[0].Content)
	}

	// owner updates own note successfully
	status, body, _, _ = performJSONPayload(router, http.MethodPut, "/api/v1/notes/"+noteID,
		map[string]interface{}{"content": "owner updated"},
		[]*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("owner update status = %d body = %s", status, body)
	}

	// owner deletes own note successfully
	status, body, _, _ = performJSONPayload(router, http.MethodDelete, "/api/v1/notes/"+noteID, nil,
		[]*http.Cookie{ownerCookie})
	if status != http.StatusOK {
		t.Fatalf("owner delete status = %d body = %s", status, body)
	}
}

type notesHistoryResponse struct {
	Data struct {
		History struct {
			From string `json:"from"`
			To   string `json:"to"`
			Days []struct {
				Date  string `json:"date"`
				Total int    `json:"total"`
			} `json:"days"`
		} `json:"history"`
	} `json:"data"`
	Message string `json:"message"`
}

// dbDayOffset returns DATE(now()) shifted by days, as the database itself sees
// it. The history query buckets on DATE(created_at), so expectations have to be
// derived from the database timezone rather than the test process timezone.
func dbDayOffset(t *testing.T, days int) string {
	t.Helper()
	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	var day string
	if err := conn.QueryRow(context.Background(),
		`SELECT (DATE(now()) + $1::int)::text`, days).Scan(&day); err != nil {
		t.Fatalf("day offset query failed: %v", err)
	}
	return day
}

// insertBackdatedNotes writes notes directly, since the create endpoint always
// stamps the current day.
func insertBackdatedNotes(t *testing.T, username string, daysAgo int, count int) {
	t.Helper()
	conn, err := db.GetConn(context.Background())
	if err != nil {
		t.Fatalf("failed to acquire db conn: %v", err)
	}
	defer conn.Release()

	for i := 0; i < count; i++ {
		if _, err := conn.Exec(context.Background(),
			`INSERT INTO notes (user_id, content, created_at)
			 SELECT id, $2, now() - ($3::int * interval '1 day')
			 FROM users WHERE username = $1`,
			username, fmt.Sprintf("backdated %d", i), daysAgo); err != nil {
			t.Fatalf("insert backdated note failed: %v", err)
		}
	}
}

func TestNotesHistoryCountsByDay(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("notes_hist_%d", time.Now().UnixNano()%1_000_000_000)
	cleanupNotesUser(t, username)
	t.Cleanup(func() { cleanupNotesUser(t, username) })

	cookie := registerNotesUser(t, router, username)

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/notes",
		map[string]interface{}{"content": "today note"},
		[]*http.Cookie{cookie})
	if status != http.StatusCreated {
		t.Fatalf("create status = %d body = %s", status, body)
	}
	insertBackdatedNotes(t, username, 2, 2)

	today := dbDayOffset(t, 0)
	from := dbDayOffset(t, -6)

	status, body, _, _ = performJSONPayload(router, http.MethodGet,
		"/api/v1/notes/history?from="+from+"&to="+today, nil, []*http.Cookie{cookie})
	if status != http.StatusOK {
		t.Fatalf("history status = %d body = %s", status, body)
	}

	var history notesHistoryResponse
	if err := json.Unmarshal([]byte(body), &history); err != nil {
		t.Fatalf("unmarshal history: %v body=%s", err, body)
	}

	counts := map[string]int{}
	for _, day := range history.Data.History.Days {
		counts[day.Date] = day.Total
	}
	if got := counts[today]; got != 1 {
		t.Fatalf("expected 1 note on %s, got %d (days=%v)", today, got, history.Data.History.Days)
	}
	twoDaysAgo := dbDayOffset(t, -2)
	if got := counts[twoDaysAgo]; got != 2 {
		t.Fatalf("expected 2 notes on %s, got %d (days=%v)", twoDaysAgo, got, history.Data.History.Days)
	}
	if len(history.Data.History.Days) != 2 {
		t.Fatalf("expected only days with notes, got %v", history.Data.History.Days)
	}
}

func TestNotesHistoryScopedToOwner(t *testing.T) {
	router := setupAuthRouteTest(t)
	owner := fmt.Sprintf("notes_hist_own_%d", time.Now().UnixNano()%1_000_000_000)
	other := fmt.Sprintf("notes_hist_oth_%d", time.Now().UnixNano()%1_000_000_000+2)
	cleanupNotesUser(t, owner)
	cleanupNotesUser(t, other)
	t.Cleanup(func() {
		cleanupNotesUser(t, owner)
		cleanupNotesUser(t, other)
	})

	ownerCookie := registerNotesUser(t, router, owner)
	otherCookie := registerNotesUser(t, router, other)

	status, body, _, _ := performJSONPayload(router, http.MethodPost, "/api/v1/notes",
		map[string]interface{}{"content": "owner note"}, []*http.Cookie{ownerCookie})
	if status != http.StatusCreated {
		t.Fatalf("create status = %d body = %s", status, body)
	}

	status, body, _, _ = performJSONPayload(router, http.MethodGet,
		"/api/v1/notes/history", nil, []*http.Cookie{otherCookie})
	if status != http.StatusOK {
		t.Fatalf("history status = %d body = %s", status, body)
	}
	var history notesHistoryResponse
	if err := json.Unmarshal([]byte(body), &history); err != nil {
		t.Fatalf("unmarshal history: %v body=%s", err, body)
	}
	if len(history.Data.History.Days) != 0 {
		t.Fatalf("expected no days for other user, got %v", history.Data.History.Days)
	}
}

func TestNotesHistoryRejectsInvalidRange(t *testing.T) {
	router := setupAuthRouteTest(t)
	username := fmt.Sprintf("notes_hist_bad_%d", time.Now().UnixNano()%1_000_000_000)
	cleanupNotesUser(t, username)
	t.Cleanup(func() { cleanupNotesUser(t, username) })

	cookie := registerNotesUser(t, router, username)

	cases := []string{
		"?from=not-a-date",
		"?from=2026-08-26&to=2026-08-25",
		"?from=2026-01-01&to=2026-12-31",
	}
	for _, query := range cases {
		status, _, _, _ := performJSONPayload(router, http.MethodGet,
			"/api/v1/notes/history"+query, nil, []*http.Cookie{cookie})
		if status != http.StatusBadRequest {
			t.Fatalf("expected 400 for %q, got %d", query, status)
		}
	}
}
