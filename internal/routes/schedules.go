package routes

import "github.com/gin-gonic/gin"

func registerScheduleRoutes(router *gin.RouterGroup) {
	router.GET("/api/v1/schedules", GetSchedules)
	router.POST("/api/v1/schedules", CreateSchedule)
	router.PUT("/api/v1/schedules/:id", UpdateSchedule)
	router.DELETE("/api/v1/schedules/:id", DeleteSchedule)
}

func GetSchedules(c *gin.Context) {
}

func CreateSchedule(c *gin.Context) {
}

func UpdateSchedule(c *gin.Context) {
}

func DeleteSchedule(c *gin.Context) {
}
