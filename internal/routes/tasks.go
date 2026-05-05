package routes

import (
	"errors"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
	tasksvc "github.com/vladwithcode/tasktracker/internal/tasks"
)

type updateTaskRequest struct {
	ActualEnd        string  `json:"actualEnd"`
	ActualStart      string  `json:"actualStart"`
	ApplyToSchedule  bool    `json:"apply_to_schedule"`
	Category         *string `json:"category"`
	CurrentCount     *int    `json:"currentCount"`
	CurrentCountSnk  *int    `json:"current_count"`
	Date             string  `json:"date"`
	Description      *string `json:"description"`
	DurationMinutes  *int    `json:"duration_minutes"`
	EndTime          *string `json:"schedule_end_time"`
	Frequency        *string `json:"frequency"`
	IsRequired       *bool   `json:"is_required"`
	Notes            string  `json:"notes"`
	Priority         *string `json:"priority_level"`
	StartTime        *string `json:"schedule_start_time"`
	Status           string  `json:"status"`
	StatusLevel      string  `json:"status_level"`
	TargetCount      *int    `json:"targetCount"`
	TargetCountSnake *int    `json:"target_count"`
	Title            *string `json:"title"`
}

func registerTaskRoutes(router *gin.RouterGroup) {
	router.POST("/tasks", CreateTask)
	router.PUT("/tasks/:id", UpdateTask)
	router.DELETE("/tasks/:id", DeleteTask)

	router.GET("/tasks", GetUserTasks)
	router.GET("/tasks/today", GenerateTodaysTasks)
	router.GET("/tasks/progress", GetTaskProgress)
	router.GET("/tasks/:id", GetTaskDetails)
}

func CreateTask(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error de autenticación")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	var scheduleTask *db.ScheduleTask
	if err := c.ShouldBindJSON(&scheduleTask); err != nil {
		httpx.BadRequest(c, "Información inválida")
		log.Printf("failed to bind json: %v\n", err)
		return
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	task, err := service.Create(c.Request.Context(), sessionAuth.ID, scheduleTask)
	if err != nil {
		httpx.ServerError(c, "Error al crear tarea")
		log.Printf("failed to create task: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"task": task}, "Tarea creada")
}

func GetTaskDetails(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error al recuperar autenticación")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	task, err := service.GetDetails(c.Request.Context(), sessionAuth, c.Param("id"))
	if err != nil {
		if errors.Is(err, tasksvc.ErrNotFound) {
			httpx.NotFound(c, "Tarea no encontrada")
			return
		}
		if errors.Is(err, tasksvc.ErrForbidden) {
			httpx.Forbidden(c, "No tienes permisos para ver esta tarea")
			return
		}
		httpx.ServerError(c, "Error inesperado")
		log.Printf("failed to get task details: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"task": task}, "Tarea encontrada")
}

func UpdateTask(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error al recuperar autenticación")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	var taskData updateTaskRequest
	if err := c.ShouldBindJSON(&taskData); err != nil {
		httpx.BadRequest(c, "Error al actualizar tarea")
		log.Printf("failed to bind json: %v\n", err)
		return
	}
	updateInput, err := taskData.toServiceInput()
	if err != nil {
		httpx.BadRequest(c, "Información inválida")
		return
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	detailedTask, err := service.Update(c.Request.Context(), sessionAuth, c.Param("id"), updateInput)
	if err != nil {
		if errors.Is(err, tasksvc.ErrNotFound) {
			httpx.NotFound(c, "Tarea no encontrada")
			return
		}
		if errors.Is(err, tasksvc.ErrForbidden) {
			httpx.Forbidden(c, "No tienes permisos para editar esta tarea")
			return
		}
		httpx.ServerError(c, "Error al actualizar tarea")
		log.Printf("failed to update task: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"task": detailedTask}, "Tarea actualizada")
}

func (r updateTaskRequest) toServiceInput() (tasksvc.UpdateTaskInput, error) {
	input := tasksvc.UpdateTaskInput{
		ApplyToSchedule: r.ApplyToSchedule,
		Category:        trimStringPtr(r.Category),
		CurrentCount:    firstIntPtr(r.CurrentCount, r.CurrentCountSnk),
		Description:     trimStringPtr(r.Description),
		DurationMinutes: r.DurationMinutes,
		IsRequired:      r.IsRequired,
		Notes:           strings.TrimSpace(r.Notes),
		TargetCount:     firstIntPtr(r.TargetCountSnake, r.TargetCount),
		Title:           trimStringPtr(r.Title),
	}

	if status := firstNonEmpty(r.StatusLevel, r.Status); status != "" {
		input.Status = db.TaskStatus(status)
	}
	if r.Date != "" {
		date, err := parseFlexibleTime(r.Date)
		if err != nil {
			return input, err
		}
		input.Date = date
	}
	if r.ActualStart != "" {
		actualStart, err := parseFlexibleTime(r.ActualStart)
		if err != nil {
			return input, err
		}
		input.ActualStart = actualStart
	}
	if r.ActualEnd != "" {
		actualEnd, err := parseFlexibleTime(r.ActualEnd)
		if err != nil {
			return input, err
		}
		input.ActualEnd = actualEnd
	}
	if r.StartTime != nil && strings.TrimSpace(*r.StartTime) != "" {
		startTime, err := parseClockTime(*r.StartTime)
		if err != nil {
			return input, err
		}
		input.StartTime = &startTime
	}
	if r.EndTime != nil && strings.TrimSpace(*r.EndTime) != "" {
		endTime, err := parseClockTime(*r.EndTime)
		if err != nil {
			return input, err
		}
		input.EndTime = &endTime
	}
	if r.Priority != nil && strings.TrimSpace(*r.Priority) != "" {
		priority := db.ScheduleTaskPriority(strings.TrimSpace(*r.Priority))
		input.Priority = &priority
	}
	if r.Frequency != nil && strings.TrimSpace(*r.Frequency) != "" {
		frequency := db.ScheduleTaskFrequency(strings.TrimSpace(*r.Frequency))
		input.Frequency = &frequency
	}

	return input, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func firstIntPtr(values ...*int) *int {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func trimStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

func parseFlexibleTime(value string) (time.Time, error) {
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed, nil
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 12, 0, 0, 0, time.UTC), nil
	}
	return time.Parse("2006-01-02T15:04:05Z", value)
}

func parseClockTime(value string) (time.Time, error) {
	parsed, err := time.Parse("15:04", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(2000, 1, 1, parsed.Hour(), parsed.Minute(), 0, 0, time.UTC), nil
}

func DeleteTask(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error al recuperar autenticación")
		return
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	err = service.Delete(c.Request.Context(), sessionAuth, c.Param("id"))
	if err != nil {
		if errors.Is(err, tasksvc.ErrNotFound) {
			httpx.NotFound(c, "Tarea no encontrada")
			return
		}
		if errors.Is(err, tasksvc.ErrForbidden) {
			httpx.Forbidden(c, "No tienes permisos para borrar esta tarea")
			return
		}
		httpx.ServerError(c, "Error al borrar tarea")
		return
	}

	httpx.OK(c, gin.H{}, "Tarea borrada")
}

func GetUserTasks(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error inesperado")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	tasks, err := service.ListByUser(c.Request.Context(), sessionAuth.ID)
	if err != nil {
		httpx.ServerError(c, "Error inesperado")
		log.Printf("failed to get tasks: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"tasks": tasks}, "Tareas recuperadas")
}

func GetTaskProgress(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	day := time.Now()
	if dateStr := strings.TrimSpace(c.Query("date")); dateStr != "" {
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			httpx.BadRequest(c, "Fecha inválida")
			return
		}
		day = time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 12, 0, 0, 0, time.Local)
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	progress, err := service.GetDayProgress(c.Request.Context(), sessionAuth.ID, day)
	if err != nil {
		httpx.ServerError(c, "Error al recuperar progreso")
		log.Printf("failed to get day progress: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"progress": progress}, "Progreso recuperado")
}

func GenerateTodaysTasks(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "Authentication required")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	tasks, err := service.ListToday(c.Request.Context(), sessionAuth.ID)
	if err != nil {
		httpx.ServerError(c, "Failed to generate today's tasks")
		log.Printf("failed to generate today's tasks: %v\n", err)
		return
	}

	feedItems := make([]db.TaskFeedItem, 0, len(tasks))
	for _, task := range tasks {
		feedItems = append(feedItems, db.NewTaskFeedItem(task))
	}

	httpx.OK(c, gin.H{
		"tasks": feedItems,
		"date":  time.Now().Format("2006-01-02"),
	}, "Tareas de hoy recuperadas")
}
