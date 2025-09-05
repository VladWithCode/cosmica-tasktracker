package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func NewRouter() *gin.Engine {
	router := gin.Default()
	router.SetTrustedProxies([]string{"127.0.0.1", "::1"})

	// Public routes (no auth required)
	router.GET("/api/v1/echo", HandleEcho)
	router.POST("/api/v1/login", HandleLogin)
	router.POST("/api/v1/register", HandleRegister)

	// Routes that require authentication
	authedRoutes := router.Group("/api/v1")
	authedRoutes.Use(auth.AuthRequired())
	{
		// All routes in this group require authentication
		authedRoutes.GET("/users", GetUsers)
		authedRoutes.GET("/profile", GetProfile)
		authedRoutes.PUT("/profile", UpdateProfile)
		authedRoutes.POST("/logout", HandleLogout)

		// Admin-only routes
		adminRoutes := authedRoutes.Group("/admin")
		adminRoutes.Use(auth.RequireRole(db.RoleAdmin, db.RoleSuperAdmin))
		{
			adminRoutes.GET("/users", GetAllUsers)
			adminRoutes.PUT("/users/:id", UpdateUser)
			adminRoutes.DELETE("/users/:id", DeleteUser)
		}

		// SuperAdmin-only routes
		superAdminRoutes := authedRoutes.Group("/superadmin")
		superAdminRoutes.Use(auth.RequireRole(db.RoleSuperAdmin))
		{
			superAdminRoutes.POST("/admin/create", CreateAdmin)
			superAdminRoutes.GET("/system/info", GetSystemInfo)
		}
	}

	// Routes with optional authentication (auth if present, but not required)
	publicRoutes := router.Group("/api/v1/public")
	publicRoutes.Use(auth.OptionalAuth())
	{
		publicRoutes.GET("/posts", GetPublicPosts) // Shows different content if authenticated
	}

	return router
}

func HandleEcho(c *gin.Context) {
	msg := c.Request.URL.Query().Get("msg")
	c.String(http.StatusOK, msg)
}

func HandleLogin(c *gin.Context) {
	var loginReq struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&loginReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get user from database
	user, err := db.GetUserByUsername(c.Request.Context(), loginReq.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Validate password
	if err := user.ValidatePass(loginReq.Password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Create token
	token, err := auth.CreateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	// Set cookie
	c.SetCookie("auth_token", token, 86400, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"fullname": user.Fullname,
			"role":     user.Role,
		},
	})
}

func HandleRegister(c *gin.Context) {
	// Implementation for user registration
	c.JSON(http.StatusNotImplemented, gin.H{"message": "Not implemented"})
}

func HandleLogout(c *gin.Context) {
	// Clear the auth cookie
	c.SetCookie("auth_token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logout successful"})
}

// Public routes with optional auth
func GetPublicPosts(c *gin.Context) {
	// Check if user is authenticated
	auth, err := auth.GetAuth(c)

	if err != nil {
		// User is not authenticated, show public posts only
		c.JSON(http.StatusOK, gin.H{
			"posts":         []string{"public post 1", "public post 2"},
			"authenticated": false,
		})
		return
	}

	// User is authenticated, show personalized content
	c.JSON(http.StatusOK, gin.H{
		"posts":         []string{"public post 1", "public post 2", "private post for " + auth.Username},
		"authenticated": true,
		"user":          auth.Username,
	})
}
