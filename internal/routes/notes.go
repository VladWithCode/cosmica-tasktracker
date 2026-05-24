package routes

import (
	"errors"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
)

type noteContentRequest struct {
	Content string `json:"content"`
}

func registerNotesRoutes(router *gin.RouterGroup) {
	router.GET("/notes", GetNotes)
	router.GET("/notes/:id", GetNote)
	router.POST("/notes", CreateNote)
	router.PUT("/notes/:id", UpdateNote)
	router.DELETE("/notes/:id", DeleteNote)
}

// GetNotes lists notes for the authenticated user on a given date.
// Query: ?date=YYYY-MM-DD (defaults to today in server timezone).
func GetNotes(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	dateStr := strings.TrimSpace(c.Query("date"))
	date, err := parseNoteDate(dateStr)
	if err != nil {
		httpx.BadRequest(c, "Fecha inválida (formato esperado YYYY-MM-DD)")
		return
	}

	notes, err := db.GetNotesByDate(c.Request.Context(), authData.ID, date)
	if err != nil {
		log.Printf("notes: list error: %v", err)
		httpx.ServerError(c, "Error al obtener notas")
		return
	}

	httpx.OK(c, gin.H{"notes": notes, "date": date.Format("2006-01-02")}, "Notas obtenidas")
}

// GetNote returns a single note owned by the authenticated user.
func GetNote(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	noteID := strings.TrimSpace(c.Param("id"))
	if _, err := uuid.Parse(noteID); err != nil {
		httpx.BadRequest(c, "ID de nota inválido")
		return
	}

	note, err := db.GetNoteByID(c.Request.Context(), noteID, authData.ID)
	if err != nil {
		if errors.Is(err, db.ErrNoteNotFound) {
			httpx.NotFound(c, "Nota no encontrada")
			return
		}
		log.Printf("notes: get error: %v", err)
		httpx.ServerError(c, "Error al obtener nota")
		return
	}

	httpx.OK(c, gin.H{"note": note}, "Nota obtenida")
}

// CreateNote inserts a new note for the authenticated user.
func CreateNote(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	var req noteContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.BadRequest(c, "Payload inválido")
		return
	}

	note, err := db.CreateNote(c.Request.Context(), authData.ID, req.Content)
	if err != nil {
		if errors.Is(err, db.ErrNoteContentEmpty) {
			httpx.BadRequest(c, "El contenido no puede estar vacío")
			return
		}
		log.Printf("notes: create error: %v", err)
		httpx.ServerError(c, "Error al crear nota")
		return
	}

	httpx.Created(c, gin.H{"note": note}, "Nota creada")
}

// UpdateNote updates the content of a note. Only the owner can update.
func UpdateNote(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	noteID := strings.TrimSpace(c.Param("id"))
	if _, err := uuid.Parse(noteID); err != nil {
		httpx.BadRequest(c, "ID de nota inválido")
		return
	}

	var req noteContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.BadRequest(c, "Payload inválido")
		return
	}

	note, err := db.UpdateNote(c.Request.Context(), noteID, authData.ID, req.Content)
	if err != nil {
		switch {
		case errors.Is(err, db.ErrNoteContentEmpty):
			httpx.BadRequest(c, "El contenido no puede estar vacío")
		case errors.Is(err, db.ErrNoteNotFound):
			httpx.NotFound(c, "Nota no encontrada")
		default:
			log.Printf("notes: update error: %v", err)
			httpx.ServerError(c, "Error al actualizar nota")
		}
		return
	}

	httpx.OK(c, gin.H{"note": note}, "Nota actualizada")
}

// DeleteNote deletes a note. Only the owner can delete.
func DeleteNote(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	noteID := strings.TrimSpace(c.Param("id"))
	if _, err := uuid.Parse(noteID); err != nil {
		httpx.BadRequest(c, "ID de nota inválido")
		return
	}

	err = db.DeleteNote(c.Request.Context(), noteID, authData.ID)
	if err != nil {
		if errors.Is(err, db.ErrNoteNotFound) {
			httpx.NotFound(c, "Nota no encontrada")
			return
		}
		log.Printf("notes: delete error: %v", err)
		httpx.ServerError(c, "Error al eliminar nota")
		return
	}

	httpx.OK(c, gin.H{"id": noteID}, "Nota eliminada")
}

// parseNoteDate parses an optional YYYY-MM-DD date string in local time.
// Empty string returns today.
func parseNoteDate(s string) (time.Time, error) {
	if s == "" {
		return time.Now(), nil
	}
	t, err := time.ParseInLocation("2006-01-02", s, time.Local)
	if err != nil {
		return time.Time{}, err
	}
	return t, nil
}
