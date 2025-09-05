package routes

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func registerTaskRoutes(router *gin.Engine) {
	router.POST("/api/v1/tasks", CreateTask)
	router.PUT("/api/v1/tasks/:id", UpdateTask)
	router.DELETE("/api/v1/tasks/:id", DeleteTask)
	router.GET("/api/v1/tasks", GetTasksByUserID)
}

func CreateTask(c *gin.Context) {
	// Get auth from context
	auth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get auth"})
		return
	}

	task := db.Task{
		Title:  c.PostForm("title"),
		UserID: auth.ID,
	}

	err = db.CreateTask(c.Request.Context(), &task)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task": task,
	})
}

func UpdateTask(c *gin.Context) {
	// Get sessionAuth from context
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al recuperar autenticación"})
		return
	}

	taskData := db.Task{
		ID:     c.Param("id"),
		UserID: sessionAuth.ID,
	}

	task, err := db.GetTaskByID(c.Request.Context(), taskData.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tarea no encontrada"})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		return
	}

	if task.UserID != sessionAuth.ID && !sessionAuth.HasAccess(auth.AccessLevelAdmin) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No tienes permisos para editar esta tarea"})
		return
	}

	err = db.UpdateTask(c.Request.Context(), task)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task": task,
	})
}

func DeleteTask(c *gin.Context) {
	// Get auth from context
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get auth"})
		return
	}
	task, err := db.GetTaskByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tarea no encontrada"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		return
	}

	if task.UserID != sessionAuth.ID && !sessionAuth.HasAccess(auth.AccessLevelAdmin) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No tienes permisos para borrar esta tarea"})
		return
	}

	err = db.DeleteTask(c.Request.Context(), c.Param("id"), auth.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Task deleted",
	})
}

func GetTasksByUserID(c *gin.Context) {
	// Get auth from context
	auth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get auth"})
		return
	}

	tasks, err := db.GetTasksByUserID(c.Request.Context(), auth.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get tasks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks": tasks,
	})
}
