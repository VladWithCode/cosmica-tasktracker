package routes

import "github.com/gin-gonic/gin"

func registerScheduleRoutes(router *gin.RouterGroup) {
	router.GET("/schedules", GetSchedules)
	router.POST("/schedules", CreateSchedule)
	router.PUT("/schedules/:id", UpdateSchedule)
	router.DELETE("/schedules/:id", DeleteSchedule)
}

func GetSchedules(c *gin.Context) {
}

func CreateSchedule(c *gin.Context) {
}

func UpdateSchedule(c *gin.Context) {
}

func DeleteSchedule(c *gin.Context) {
}
