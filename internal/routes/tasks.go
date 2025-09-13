package routes

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func registerTaskRoutes(router *gin.RouterGroup) {
	router.POST("/tasks", CreateTask)
	router.PUT("/tasks/:id", UpdateTask)
	router.DELETE("/tasks/:id", DeleteTask)

	router.GET("/tasks", GetUserTasks)
	router.GET("/tasks/today", GenerateTodaysTasks)
}

func CreateTask(c *gin.Context) {
	// Get auth from context
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error de autenticación"})
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	var scheduleTask *db.ScheduleTask
	if err := c.ShouldBind(&scheduleTask); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Información inválida"})
		log.Printf("failed to bind json: %v\n", err)
		return
	}

	scheduleTask.UserID = sessionAuth.ID
	scheduleTask.ID = uuid.Must(uuid.NewV7()).String()
	scheduleTask.Status = db.ScheduleTaskStatusActive

	err = db.CreateScheduleTask(c.Request.Context(), scheduleTask)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		log.Printf("failed to create schedule task: %v\n", err)
		return
	}

	task, err := db.CreateTaskForSchedule(c.Request.Context(), scheduleTask)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear tarea"})
		log.Printf("failed to create task: %v\n", err)
		return
	}

	detailedTask := db.NewDetailedTask(task, scheduleTask)
	c.JSON(http.StatusOK, gin.H{
		"task": detailedTask,
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

	if err := c.ShouldBind(&taskData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Error al actualizar tarea"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get auth"})
		return
	}
	task, err := db.GetTaskByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Tarea no encontrada"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Error inesperado"})
		return
	}

	if task.UserID != sessionAuth.ID && !sessionAuth.HasAccess(auth.AccessLevelAdmin) {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "No tienes permisos para borrar esta tarea"})
		return
	}

	err = db.DeleteTask(c.Request.Context(), task)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Error al borrar tarea"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Task deleted",
	})
}

func GetUserTasks(c *gin.Context) {
	// Get auth from context
	auth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Error inesperado"})
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	tasks, err := db.GetTasksByUserID(c.Request.Context(), auth.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Error inesperado"})
		log.Printf("failed to get tasks: %v\n", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks": tasks,
	})
}

func GenerateTodaysTasks(c *gin.Context) {
	// Get auth from context
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	// Generate today's tasks
	var tasks []*db.DetailedTask
	tasks, err = db.GetUserTodayDetailedTasks(c.Request.Context(), sessionAuth.ID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate today's tasks"})
		log.Printf("failed to generate today's tasks: %v\n", err)
		return
	}
	if len(tasks) == 0 {
		tasks, err = db.CreateUsersTodayTasks(c.Request.Context(), sessionAuth.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate today's tasks"})
			log.Printf("failed to generate today's tasks: %v\n", err)
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks": tasks,
		"date":  time.Now().Format("2006-01-02"),
	})
}
