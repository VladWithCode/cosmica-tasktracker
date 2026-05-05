package routes

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
	usersvc "github.com/vladwithcode/tasktracker/internal/users"
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
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error inesperado")
		return
	}

	service := usersvc.NewService(usersvc.NewRepository())
	profile, err := service.GetProfile(c.Request.Context(), authData.ID)
	if err != nil {
		if errors.Is(err, usersvc.ErrNotFound) {
			httpx.NotFound(c, "Usuario no encontrado")
			return
		}
		httpx.ServerError(c, "Error inesperado")
		log.Printf("failed to get user: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"profile": profile}, "Perfil recuperado")
}

func UpdateProfile(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error inesperado")
		log.Printf("failed to get auth: %v\n", err)
		return
	}

	var updateReq usersvc.UpdateProfileInput

	if err := c.ShouldBindJSON(&updateReq); err != nil {
		httpx.BadRequest(c, "Información inválida")
		log.Printf("failed to bind json: %v\n", err)
		return
	}

	service := usersvc.NewService(usersvc.NewRepository())
	profile, err := service.UpdateProfile(c.Request.Context(), authData.ID, updateReq)
	if err != nil {
		httpx.ServerError(c, "Error inesperado")
		log.Printf("failed to update user: %v\n", err)
		return
	}

	httpx.OK(c, gin.H{"profile": profile}, "Perfil actualizado")
}

// Admin routes
func CreateUser(c *gin.Context) {
	user := db.User{}

	if err := c.ShouldBindJSON(&user); err != nil {
		httpx.BadRequest(c, "Información inválida")
		log.Printf("failed to bind json: %v\n", err)
		return
	}

	service := usersvc.NewService(usersvc.NewRepository())
	profile, err := service.CreateUser(c.Request.Context(), &user, db.RoleUser)
	if err != nil {
		httpx.ServerError(c, "Error inesperado")
		log.Printf("failed to create user: %v\n", err)
		return
	}

	httpx.Created(c, gin.H{"user": profile}, "Usuario creado")
}

// UpdateUser is intentionally left unimplemented. The endpoint is reserved
// for the future admin user-management feature, but the previous stub returned
// 200 OK with no actual update which was misleading. Clients (today only the
// admin role can hit this route) should treat 501 as "not yet available".
func UpdateUser(c *gin.Context) {
	httpx.ErrorCode(
		c,
		http.StatusNotImplemented,
		"not_implemented",
		"Actualización administrativa de usuarios aún no implementada",
	)
}

func DeleteUser(c *gin.Context) {
	userID := c.Param("id")

	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error inesperado")
		return
	}

	service := usersvc.NewService(usersvc.NewRepository())
	isSameUser, err := service.DeleteUser(c.Request.Context(), sessionAuth, userID)
	if err != nil {
		if errors.Is(err, usersvc.ErrNotFound) {
			httpx.NotFound(c, "Usuario no encontrado")
			return
		}
		if errors.Is(err, usersvc.ErrForbidden) {
			httpx.Forbidden(c, "No tienes permisos para borrar este usuario")
			return
		}
		httpx.ServerError(c, "Error inesperado")
		return
	}

	// Logout if deleting current user
	if isSameUser {
		c.SetCookie("auth_token", "", -1, "/", "", false, true)
	}

	httpx.OK(c, gin.H{}, "Usuario borrado")
}

// SuperAdmin routes
func CreateAdmin(c *gin.Context) {
	httpx.OK(c, gin.H{}, "Admin created")
}

func GetSystemInfo(c *gin.Context) {
	httpx.OK(c, gin.H{}, "System info")
}
