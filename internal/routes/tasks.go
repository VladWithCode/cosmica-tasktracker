package routes

import (
	"errors"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
	"github.com/vladwithcode/tasktracker/internal/notifications"
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

type pingTaskRequest struct {
	Message string `json:"message"`
}

func registerTaskRoutes(router *gin.RouterGroup) {
	router.POST("/tasks", CreateTask)
	router.POST("/tasks/:id/ping", PingTask)
	router.PUT("/tasks/:id", UpdateTask)
	router.DELETE("/tasks/:id", DeleteTask)

	router.GET("/tasks", GetUserTasks)
	router.GET("/tasks/day", GetDayTasks)
	router.GET("/tasks/today", GenerateTodaysTasks)
	router.GET("/tasks/progress", GetTaskProgress)
	router.GET("/tasks/history", GetTaskHistory)
	router.GET("/tasks/metrics", GetTaskMetrics)
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
		if err := db.ValidatePriority(priority); err != nil {
			return input, err
		}
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
		return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 12, 0, 0, 0, time.Local), nil
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

func GetTaskHistory(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	from, to, err := parseTaskRange(c)
	if err != nil {
		httpx.BadRequest(c, err.Error())
		return
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	history, err := service.GetHistory(c.Request.Context(), sessionAuth.ID, from, to)
	if err != nil {
		httpx.ServerError(c, "Error al recuperar historial")
		log.Printf("failed to get task history: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"history": history}, "Historial recuperado")
}

func GetTaskMetrics(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	from, to, err := parseTaskRange(c)
	if err != nil {
		httpx.BadRequest(c, err.Error())
		return
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	metrics, err := service.GetMetrics(c.Request.Context(), sessionAuth.ID, from, to)
	if err != nil {
		httpx.ServerError(c, "Error al recuperar métricas")
		log.Printf("failed to get task metrics: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"metrics": metrics}, "Métricas recuperadas")
}

func parseTaskRange(c *gin.Context) (time.Time, time.Time, error) {
	now := time.Now()
	to := time.Date(now.Year(), now.Month(), now.Day(), 12, 0, 0, 0, time.Local)
	from := to.AddDate(0, 0, -6)

	if fromValue := strings.TrimSpace(c.Query("from")); fromValue != "" {
		parsed, err := parseDateOnly(fromValue)
		if err != nil {
			return time.Time{}, time.Time{}, errors.New("Fecha inicial inválida")
		}
		from = parsed
	}
	if toValue := strings.TrimSpace(c.Query("to")); toValue != "" {
		parsed, err := parseDateOnly(toValue)
		if err != nil {
			return time.Time{}, time.Time{}, errors.New("Fecha final inválida")
		}
		to = parsed
	}
	if from.After(to) {
		return time.Time{}, time.Time{}, errors.New("La fecha inicial no puede ser posterior a la fecha final")
	}
	if to.Sub(from).Hours()/24 > 89 {
		return time.Time{}, time.Time{}, errors.New("El rango máximo permitido es de 90 días")
	}

	return from, to, nil
}

func parseDateOnly(value string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 12, 0, 0, 0, time.Local), nil
}

func GetDayTasks(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "Authentication required")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	dateStr := strings.TrimSpace(c.Query("date"))
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}
	date, err := parseDateOnly(dateStr)
	if err != nil {
		httpx.BadRequest(c, "Fecha inválida, usa formato YYYY-MM-DD")
		return
	}

	ownerUserID := strings.TrimSpace(c.Query("owner_user_id"))
	if ownerUserID == "" {
		ownerUserID = sessionAuth.ID
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	if err := service.CanViewOwner(c.Request.Context(), sessionAuth, ownerUserID); err != nil {
		if errors.Is(err, tasksvc.ErrForbidden) {
			sharingPermissionDenied(c)
			return
		}
		httpx.ServerError(c, "Error al validar permisos compartidos")
		log.Printf("failed to validate shared day tasks access: %v\n", err)
		return
	}

	tasks, err := service.ListByDate(c.Request.Context(), ownerUserID, date)
	if err != nil {
		httpx.ServerError(c, "Error al recuperar tareas del día")
		log.Printf("failed to get day tasks: %v\n", err)
		return
	}

	feedItems := make([]db.TaskFeedItem, 0, len(tasks))
	for _, task := range tasks {
		feedItems = append(feedItems, db.NewTaskFeedItem(task))
	}

	httpx.OK(c, gin.H{
		"tasks":         feedItems,
		"date":          dateStr,
		"owner_user_id": ownerUserID,
	}, "Tareas del día recuperadas")
}

func GenerateTodaysTasks(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "Authentication required")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	ownerUserID := strings.TrimSpace(c.Query("owner_user_id"))
	if ownerUserID == "" {
		ownerUserID = sessionAuth.ID
	}

	service := tasksvc.NewService(tasksvc.NewRepository())
	if err := service.CanViewOwner(c.Request.Context(), sessionAuth, ownerUserID); err != nil {
		if errors.Is(err, tasksvc.ErrForbidden) {
			sharingPermissionDenied(c)
			return
		}
		httpx.ServerError(c, "Error al validar permisos compartidos")
		log.Printf("failed to validate shared task feed access: %v\n", err)
		return
	}

	tasks, err := service.ListToday(c.Request.Context(), ownerUserID)
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
		"tasks":         feedItems,
		"date":          time.Now().Format("2006-01-02"),
		"owner_user_id": ownerUserID,
	}, "Tareas de hoy recuperadas")
}

func PingTask(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	var request pingTaskRequest
	if err := c.ShouldBindJSON(&request); err != nil && !errors.Is(err, io.EOF) {
		httpx.BadRequest(c, "Información inválida")
		return
	}

	task, err := db.GetTaskByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.NotFound(c, "Tarea no encontrada")
			return
		}
		httpx.ServerError(c, "No se pudo recuperar la tarea")
		log.Printf("failed to get task for ping: %v\n", err)
		return
	}

	if sessionAuth.ID != task.UserID && !sessionAuth.HasAccess(auth.AccessLevelAdmin) {
		allowed, err := db.UserHasTaskPermission(c.Request.Context(), task.UserID, sessionAuth.ID, db.SharingPermissionPing)
		if err != nil {
			httpx.ServerError(c, "Error al validar permisos compartidos")
			log.Printf("failed to validate ping permission: %v\n", err)
			return
		}
		if !allowed {
			sharingPermissionDenied(c)
			return
		}
	}

	recent, err := db.RecentTaskPingExists(
		c.Request.Context(),
		task.ID,
		sessionAuth.ID,
		task.UserID,
		time.Now().Add(-5*time.Minute),
	)
	if err != nil {
		httpx.ServerError(c, "No se pudo validar el ping")
		log.Printf("failed to validate recent ping: %v\n", err)
		return
	}
	if recent {
		httpx.Conflict(c, "ping_rate_limited", "Ya enviaste un ping para esta tarea recientemente")
		return
	}

	message := strings.TrimSpace(request.Message)
	sentCount := 0
	notificationSent := false
	config := notifications.LoadConfigFromEnv()
	if config.CanSend() {
		payload := &notifications.NotificationPayload{
			Title:              "Tienes un ping de tarea",
			Body:               fmt.Sprintf("%s te recordó una tarea", sessionAuth.Username),
			Icon:               "/icon-192x192.png",
			Badge:              "/badge-72x72.png",
			Tag:                "task-ping-" + task.ID,
			RequireInteraction: false,
			URL:                "/tasks/" + task.ID,
			TaskID:             task.ID,
			Data: map[string]string{
				"taskId": task.ID,
				"url":    "/tasks/" + task.ID,
			},
		}
		sentCount, err = notifications.SendNotificationToUserWithConfig(c.Request.Context(), task.UserID, payload, config)
		if err != nil {
			log.Printf("task ping push notification failed: %v\n", err)
		}
		notificationSent = err == nil && sentCount > 0
	}

	ping := &db.TaskPing{
		TaskID:           task.ID,
		SenderUserID:     sessionAuth.ID,
		RecipientUserID:  task.UserID,
		Message:          message,
		NotificationSent: notificationSent,
	}
	if err := db.CreateTaskPing(c.Request.Context(), ping); err != nil {
		httpx.ServerError(c, "No se pudo registrar el ping")
		log.Printf("failed to create task ping: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{
		"ping":              ping,
		"notification_sent": notificationSent,
		"sent_count":        sentCount,
	}, "Ping enviado")
}
