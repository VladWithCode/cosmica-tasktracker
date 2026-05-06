package routes

import (
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
	schedulesvc "github.com/vladwithcode/tasktracker/internal/schedules"
)

type scheduleRequest struct {
	Category        string          `json:"category"`
	Description     string          `json:"description"`
	DurationMinutes *int            `json:"duration_minutes"`
	EndDate         string          `json:"end_date"`
	EndTime         *string         `json:"schedule_end_time"`
	Frequency       string          `json:"frequency"`
	FrequencyConfig json.RawMessage `json:"frequency_config"`
	IsRequired      bool            `json:"is_required"`
	OwnerUserID     string          `json:"owner_user_id"`
	Priority        string          `json:"priority_level"`
	RepeatFrequency string          `json:"repeatFrequency"`
	RepeatInterval  int             `json:"repeatInterval"`
	RepeatWeekdays  []int           `json:"repeatWeekdays"`
	Repeating       bool            `json:"repeating"`
	StartDate       string          `json:"start_date"`
	StartTime       *string         `json:"schedule_start_time"`
	TargetCount     *int            `json:"target_count"`
	Title           string          `json:"title"`

	LegacyEndTime         *string `json:"endTime"`
	LegacyIsRequired      bool    `json:"isRequired"`
	LegacyPriority        string  `json:"priority"`
	LegacyRequired        bool    `json:"required"`
	LegacyStartTime       *string `json:"startTime"`
	LegacyDurationMinutes *int    `json:"durationMinutes"`
}

func registerScheduleRoutes(router *gin.RouterGroup) {
	router.GET("/schedules", GetSchedules)
	router.POST("/schedules", CreateSchedule)
	router.GET("/schedules/:id", GetSchedule)
	router.POST("/schedules/:id/pause", PauseSchedule)
	router.POST("/schedules/:id/resume", ResumeSchedule)
	router.PUT("/schedules/:id", UpdateSchedule)
	router.DELETE("/schedules/:id", DeleteSchedule)
}

func GetSchedules(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error de autenticación")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	ownerUserID := strings.TrimSpace(c.Query("owner_user_id"))
	if ownerUserID == "" {
		ownerUserID = sessionAuth.ID
	}
	if ownerUserID != sessionAuth.ID && !sessionAuth.HasAccess(auth.AccessLevelAdmin) {
		allowed, err := db.UserHasTaskPermission(c.Request.Context(), ownerUserID, sessionAuth.ID, db.SharingPermissionView)
		if err != nil {
			httpx.ServerError(c, "Error al validar permisos compartidos")
			log.Printf("failed to validate shared schedules access: %v\n", err)
			return
		}
		if !allowed {
			sharingPermissionDenied(c)
			return
		}
	}

	service := schedulesvc.NewService(schedulesvc.NewRepository())
	schedules, err := service.List(c.Request.Context(), ownerUserID)
	if err != nil {
		httpx.ServerError(c, "Error al recuperar rutinas")
		log.Printf("failed to get schedules: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"schedules": schedules, "owner_user_id": ownerUserID}, "Rutinas recuperadas")
}

func CreateSchedule(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error de autenticación")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	var req scheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.BadRequest(c, "Información inválida")
		log.Printf("failed to bind schedule: %v\n", err)
		return
	}
	schedule, err := req.toSchedule()
	if err != nil {
		httpx.BadRequest(c, "Información inválida")
		log.Printf("failed to map schedule: %v\n", err)
		return
	}

	ownerUserID := strings.TrimSpace(req.OwnerUserID)
	if ownerUserID == "" {
		ownerUserID = sessionAuth.ID
	}
	if ownerUserID != sessionAuth.ID && !sessionAuth.HasAccess(auth.AccessLevelAdmin) {
		allowed, err := db.UserHasTaskPermission(c.Request.Context(), ownerUserID, sessionAuth.ID, db.SharingPermissionCreate)
		if err != nil {
			httpx.ServerError(c, "Error al validar permisos compartidos")
			log.Printf("failed to validate shared schedule creation: %v\n", err)
			return
		}
		if !allowed {
			sharingPermissionDenied(c)
			return
		}
	}

	service := schedulesvc.NewService(schedulesvc.NewRepository())
	createdSchedule, err := service.CreateForOwner(c.Request.Context(), ownerUserID, sessionAuth.ID, schedule)
	if err != nil {
		httpx.ServerError(c, "Error al crear rutina")
		log.Printf("failed to create schedule: %v\n", err)
		return
	}

	httpx.Created(c, gin.H{"schedule": createdSchedule}, "Rutina creada")
}

func GetSchedule(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error de autenticación")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	service := schedulesvc.NewService(schedulesvc.NewRepository())
	schedule, err := service.Get(c.Request.Context(), sessionAuth, c.Param("id"))
	if err != nil {
		if errors.Is(err, schedulesvc.ErrNotFound) {
			httpx.NotFound(c, "Rutina no encontrada")
			return
		}
		if errors.Is(err, schedulesvc.ErrForbidden) {
			httpx.Forbidden(c, "No tienes permisos para ver esta rutina")
			return
		}
		httpx.ServerError(c, "Error al recuperar rutina")
		log.Printf("failed to get schedule: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"schedule": schedule}, "Rutina recuperada")
}

func UpdateSchedule(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error de autenticación")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	var req scheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.BadRequest(c, "Información inválida")
		log.Printf("failed to bind schedule: %v\n", err)
		return
	}
	schedule, err := req.toSchedule()
	if err != nil {
		httpx.BadRequest(c, "Información inválida")
		log.Printf("failed to map schedule: %v\n", err)
		return
	}

	service := schedulesvc.NewService(schedulesvc.NewRepository())
	updatedSchedule, err := service.Update(c.Request.Context(), sessionAuth, c.Param("id"), schedule)
	if err != nil {
		if errors.Is(err, schedulesvc.ErrNotFound) {
			httpx.NotFound(c, "Rutina no encontrada")
			return
		}
		if errors.Is(err, schedulesvc.ErrForbidden) {
			httpx.Forbidden(c, "No tienes permisos para editar esta rutina")
			return
		}
		httpx.ServerError(c, "Error al actualizar rutina")
		log.Printf("failed to update schedule: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"schedule": updatedSchedule}, "Rutina actualizada")
}

func (r scheduleRequest) toSchedule() (*db.ScheduleTask, error) {
	startTime := firstStringPtr(r.StartTime, r.LegacyStartTime)
	endTime := firstStringPtr(r.EndTime, r.LegacyEndTime)
	durationMinutes := firstIntPtr(r.DurationMinutes, r.LegacyDurationMinutes)
	priority := firstNonEmpty(r.Priority, r.LegacyPriority)
	if priority == "" {
		priority = string(db.ScheduleTaskPriorityMedium)
	}
	frequency := strings.TrimSpace(r.Frequency)
	if frequency == "" {
		frequency = string(db.ScheduleTaskFrequencyDaily)
	}
	frequencyConfig := r.FrequencyConfig
	if len(frequencyConfig) == 0 {
		frequencyConfig = json.RawMessage(`{}`)
	}

	schedule := &db.ScheduleTask{
		Category:        strings.TrimSpace(r.Category),
		Description:     strings.TrimSpace(r.Description),
		Frequency:       db.ScheduleTaskFrequency(frequency),
		FrequencyConfig: frequencyConfig,
		IsRequired:      r.IsRequired || r.LegacyIsRequired || r.LegacyRequired,
		Priority:        db.ScheduleTaskPriority(priority),
		RepeatFrequency: db.ScheduleTaskRepeatFrequency(strings.TrimSpace(r.RepeatFrequency)),
		RepeatInterval:  r.RepeatInterval,
		RepeatWeekdays:  r.RepeatWeekdays,
		Repeating:       r.Repeating,
		TargetCount:     r.TargetCount,
		Title:           strings.TrimSpace(r.Title),
	}
	schedule.Required = schedule.IsRequired

	if startTime != nil && strings.TrimSpace(*startTime) != "" {
		parsed, err := parseClockTime(*startTime)
		if err != nil {
			return nil, err
		}
		schedule.StartTime = parsed
	}
	if endTime != nil && strings.TrimSpace(*endTime) != "" {
		parsed, err := parseClockTime(*endTime)
		if err != nil {
			return nil, err
		}
		schedule.EndTime = parsed
	}
	if durationMinutes != nil {
		schedule.DurationMinutes = *durationMinutes
		schedule.Duration = time.Duration(*durationMinutes) * time.Minute
	}
	if r.StartDate != "" {
		parsed, err := time.Parse("2006-01-02", r.StartDate)
		if err != nil {
			return nil, err
		}
		schedule.StartDate = parsed
	}
	if r.EndDate != "" {
		parsed, err := time.Parse("2006-01-02", r.EndDate)
		if err != nil {
			return nil, err
		}
		schedule.EndDate = parsed
	}

	return schedule, nil
}

func firstStringPtr(values ...*string) *string {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func PauseSchedule(c *gin.Context) {
	updateScheduleStatus(c, db.ScheduleTaskStatusPaused, "Rutina pausada")
}

func ResumeSchedule(c *gin.Context) {
	updateScheduleStatus(c, db.ScheduleTaskStatusActive, "Rutina reanudada")
}

func updateScheduleStatus(c *gin.Context, status db.ScheduleTaskStatus, message string) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error de autenticación")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	service := schedulesvc.NewService(schedulesvc.NewRepository())
	var schedule *db.ScheduleTask
	if status == db.ScheduleTaskStatusPaused {
		schedule, err = service.Pause(c.Request.Context(), sessionAuth, c.Param("id"))
	} else {
		schedule, err = service.Resume(c.Request.Context(), sessionAuth, c.Param("id"))
	}
	if err != nil {
		if errors.Is(err, schedulesvc.ErrNotFound) {
			httpx.NotFound(c, "Rutina no encontrada")
			return
		}
		if errors.Is(err, schedulesvc.ErrForbidden) {
			httpx.Forbidden(c, "No tienes permisos para editar esta rutina")
			return
		}
		httpx.ServerError(c, "Error al actualizar rutina")
		log.Printf("failed to update schedule status: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"schedule": schedule}, message)
}

func DeleteSchedule(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error de autenticación")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	service := schedulesvc.NewService(schedulesvc.NewRepository())
	err = service.Delete(c.Request.Context(), sessionAuth, c.Param("id"))
	if err != nil {
		if errors.Is(err, schedulesvc.ErrNotFound) {
			httpx.NotFound(c, "Rutina no encontrada")
			return
		}
		if errors.Is(err, schedulesvc.ErrForbidden) {
			httpx.Forbidden(c, "No tienes permisos para borrar esta rutina")
			return
		}
		httpx.ServerError(c, "Error al borrar rutina")
		log.Printf("failed to delete schedule: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{}, "Rutina cancelada")
}
