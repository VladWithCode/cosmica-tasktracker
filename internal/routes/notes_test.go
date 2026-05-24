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
