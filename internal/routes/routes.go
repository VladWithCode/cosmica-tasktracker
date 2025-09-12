package routes

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func NewRouter() *gin.Engine {
	router := gin.Default()
	router.SetTrustedProxies([]string{"127.0.0.1", "::1"})

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

	router.POST("/login", HandleLogin)
	router.POST("/logout", HandleLogout)

	// Public routes (no auth required)
	apiRoutes := router.Group("/api/v1")
	apiRoutes.Use(auth.AuthRequired())
	apiRoutes.GET("/check-auth", CheckAuth)
	registerScheduleRoutes(apiRoutes)
	registerTaskRoutes(apiRoutes)
	registerUserRoutes(apiRoutes)

	return router
}

func CheckAuth(c *gin.Context) {
	auth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autorizado"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":       auth.ID,
			"username": auth.Username,
			"fullname": auth.Fullname,
			"role":     auth.Role,
		},
	})
}

func HandleLogin(c *gin.Context) {
	if _, err := auth.GetAuth(c); err == nil {
		c.JSON(http.StatusAccepted, gin.H{"action": "redirect", "url": "/api/v1/users/profile"})
	}

	var loginReq struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&loginReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Información inválida"})
		return
	}

	// Get user from database
	user, err := db.GetUserByUsername(c.Request.Context(), loginReq.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario o contraseña incorrectos"})
		log.Printf("failed to get user: %v", err)
		return
	}

	// Validate password
	if err := user.ValidatePass(loginReq.Password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario o contraseña incorrectos"})
		log.Printf("invalid password: %v", err)
		return
	}

	// Create token
	token, err := auth.CreateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		return
	}

	// Set cookie
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie(
		auth.DefaultCookieName,
		token,
		auth.DefaultCookieMaxAge,
		"/",
		"",
		auth.UseSecureCookies,
		auth.UseHTTPOnlyCookies,
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Sesión iniciada",
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"fullname": user.Fullname,
			"role":     user.Role,
		},
	})
}

func HandleLogout(c *gin.Context) {
	// Clear the auth cookie
	c.SetCookie("auth_token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Sesión cerrada"})
}
