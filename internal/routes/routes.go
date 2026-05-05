package routes

import (
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/httpx"
)

func NewRouter() *gin.Engine {
	router := gin.Default()
	router.SetTrustedProxies([]string{"127.0.0.1", "::1", "192.168.1.0/24"})

	// CORS config
	corsAllowOrigins := os.Getenv("CORS_ALLOW_ORIGINS")
	router.Use(cors.New(
		cors.Config{
			AllowOrigins:     strings.Split(corsAllowOrigins, ","),
			AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
			ExposeHeaders:    []string{"Content-Length"},
			AllowCredentials: true,
			MaxAge:           300, // Maximum value not ignored by any of major browsers
		},
	))

	registerAuthRoutes(router)

	// Public routes (no auth required)
	apiRoutes := router.Group("/api/v1")
	registerPublicNotificationRoutes(apiRoutes)
	apiRoutes.Use(auth.AuthRequired())
	apiRoutes.GET("/check-auth", CheckAuth)
	registerScheduleRoutes(apiRoutes)
	registerTaskRoutes(apiRoutes)
	registerNotificationRoutes(apiRoutes)
	registerUserRoutes(apiRoutes)

	return router
}

func CheckAuth(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	httpx.OK(c, gin.H{
		"user": gin.H{
			"id":       authData.ID,
			"email":    authData.Email,
			"username": authData.Username,
			"fullname": authData.Fullname,
			"role":     authData.Role,
		},
	}, "Sesión activa")
}
