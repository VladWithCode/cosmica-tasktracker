package routes

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func registerUserRoutes(router *gin.RouterGroup) {
	router.GET("/profile", GetProfile)
	router.PUT("/profile", UpdateProfile)

	// Admin routes
	router.Use(auth.RequireAccessLevel(auth.AccessLevelAdmin))
	{
		router.POST("/users", CreateUser)
		router.PUT("/users/:id", UpdateUser)
		router.DELETE("/users/:id", DeleteUser)
	}

	// SuperAdmin routes
	router.Use(auth.RequireAccessLevel(auth.AccessLevelSuperAdmin))
	{
		router.POST("/admin", CreateAdmin)
		router.GET("/system", GetSystemInfo)
	}
}

func GetProfile(c *gin.Context) {
	auth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		return
	}

	// Get full user details from database
	user, err := db.GetUserByID(c.Request.Context(), auth.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		log.Printf("failed to get user: %v\n", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"fullname": user.Fullname,
		"email":    user.Email,
		"role":     user.Role,
	})
}

func UpdateProfile(c *gin.Context) {
	auth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	var updateReq struct {
		Fullname string `json:"fullname"`
		Email    string `json:"email"`
	}

	if err := c.ShouldBindJSON(&updateReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Información inválida"})
		log.Printf("failed to bind json: %v\n", err)
		return
	}

	// Get user and update
	user, err := db.GetUserByID(c.Request.Context(), auth.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		log.Printf("failed to get user: %v\n", err)
		return
	}

	user.Fullname = updateReq.Fullname
	user.Email = updateReq.Email

	if err := db.UpdateUser(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		log.Printf("failed to update user: %v\n", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Perfil actualizado"})
}

// Admin routes
func CreateUser(c *gin.Context) {
	user := db.User{}

	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Información inválida"})
		log.Printf("failed to bind json: %v\n", err)
		return
	}

	user.Role = db.RoleUser
	user.ID = uuid.Must(uuid.NewV7()).String()
	if err := db.CreateUser(c.Request.Context(), &user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		log.Printf("failed to create user: %v\n", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Usuario creado", "user": user})
}

func UpdateUser(c *gin.Context) {
	userID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"message": "User " + userID + " updated",
	})
}

func DeleteUser(c *gin.Context) {
	userID := c.Param("id")

	user, err := db.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		return
	}

	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		return
	}

	isSameUser := user.ID == sessionAuth.ID
	userIsSuperAdmin := user.Role == db.RoleSuperAdmin
	loggedHasAdminPrivilege := sessionAuth.HasAccess(auth.AccessLevelAdmin)
	loggedHasSuperPrivilege := sessionAuth.HasAccess(auth.AccessLevelSuperAdmin)

	if !isSameUser && (!loggedHasAdminPrivilege || userIsSuperAdmin && !loggedHasSuperPrivilege) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No tienes permisos para borrar este usuario"})
		return
	}

	err = db.DeleteUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error inesperado"})
		return
	}

	// Logout if deleting current user
	if isSameUser {
		c.SetCookie("auth_token", "", -1, "/", "", false, true)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Usuario borrado",
	})
}

// SuperAdmin routes
func CreateAdmin(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Admin created",
	})
}

func GetSystemInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "System info",
	})
}
