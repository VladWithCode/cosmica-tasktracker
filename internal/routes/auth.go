package routes

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
)

type authCredentialsRequest struct {
	Password string `json:"password" binding:"required"`
	Username string `json:"username" binding:"required"`
}

type registerRequest struct {
	Email    string `json:"email"`
	Fullname string `json:"fullname"`
	Password string `json:"password"`
	Username string `json:"username"`
}

func registerAuthRoutes(router *gin.Engine) {
	// Canonical auth endpoints. The legacy `/api/login` / `/api/logout`
	// pre-versioned routes were removed in the post-MVP hardening pass once
	// the frontend was confirmed to be using only `/api/v1/auth/*` and a
	// Deprecation header window had elapsed. External callers hitting the old
	// paths now receive 404; document the breaking change before announcing
	// the new release.
	router.POST("/api/v1/auth/login", HandleLogin)
	router.POST("/api/v1/auth/register", HandleRegister)
	router.POST("/api/v1/auth/logout", HandleLogout)
	router.GET("/api/v1/auth/me", auth.AuthRequired(), CheckAuth)
	router.PUT("/api/v1/auth/password", auth.AuthRequired(), HandleChangePassword)
}

func HandleLogin(c *gin.Context) {
	var loginReq authCredentialsRequest

	if err := c.ShouldBindJSON(&loginReq); err != nil {
		httpx.BadRequest(c, "Información inválida")
		return
	}

	authService := auth.NewService(auth.NewUserRepository())
	result, err := authService.Login(c.Request.Context(), auth.LoginInput{
		Username: loginReq.Username,
		Password: loginReq.Password,
	})
	if err != nil {
		if errors.Is(err, auth.ErrInvalidCredentials) {
			httpx.Unauthorized(c, "Usuario o contraseña incorrectos")
			return
		}
		httpx.ServerError(c, "Error inesperado")
		log.Printf("failed to login: %v", err)
		return
	}

	setAuthCookie(c, result.Token)
	httpx.OK(c, gin.H{"user": userPayload(result.User)}, "Sesión iniciada")
}

func HandleRegister(c *gin.Context) {
	var req registerRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.BadRequest(c, "Información inválida")
		return
	}

	authService := auth.NewService(auth.NewUserRepository())
	result, err := authService.Register(c.Request.Context(), auth.RegisterInput{
		Email:    req.Email,
		Fullname: req.Fullname,
		Password: req.Password,
		Username: req.Username,
	})
	if err != nil {
		var validationError *auth.ValidationError
		if errors.As(err, &validationError) {
			httpx.Unprocessable(c, gin.H{"fields": validationError.Fields}, "validation_error", validationError.Message)
			return
		}
		if errors.Is(err, auth.ErrUsernameTaken) {
			httpx.Conflict(c, "username_taken", "El usuario ya existe")
			return
		}
		if errors.Is(err, auth.ErrEmailTaken) {
			httpx.Conflict(c, "email_taken", "El correo ya está registrado")
			return
		}
		httpx.ServerError(c, "Error inesperado")
		log.Printf("failed to register: %v", err)
		return
	}

	setAuthCookie(c, result.Token)
	httpx.Created(c, gin.H{"user": userPayload(result.User)}, "Cuenta creada")
}

func HandleLogout(c *gin.Context) {
	clearAuthCookie(c)
	httpx.OK(c, nil, "Sesión cerrada")
}

func setAuthCookie(c *gin.Context, token string) {
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
}

func clearAuthCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie(
		auth.DefaultCookieName,
		"",
		-1,
		"/",
		"",
		auth.UseSecureCookies,
		auth.UseHTTPOnlyCookies,
	)
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required"`
}

func HandleChangePassword(c *gin.Context) {
	sessionAuth, err := auth.GetAuth(c)
	if err != nil {
		httpx.ServerError(c, "Error de autenticación")
		return
	}

	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.BadRequest(c, "Faltan campos requeridos")
		return
	}

	authService := auth.NewService(auth.NewUserRepository())
	err = authService.ChangePassword(c.Request.Context(), auth.ChangePasswordInput{
		CurrentPassword: req.CurrentPassword,
		NewPassword:     req.NewPassword,
		UserID:          sessionAuth.ID,
	})
	if err != nil {
		if errors.Is(err, auth.ErrWrongCurrentPassword) {
			httpx.BadRequest(c, "La contraseña actual es incorrecta")
			return
		}
		var validationError *auth.ValidationError
		if errors.As(err, &validationError) {
			httpx.Unprocessable(c, gin.H{"fields": validationError.Fields}, "validation_error", validationError.Message)
			return
		}
		httpx.ServerError(c, "No se pudo actualizar la contraseña")
		log.Printf("failed to change password: %v", err)
		return
	}

	httpx.OK(c, nil, "Contraseña actualizada")
}

func userPayload(user *db.User) gin.H {
	payload := gin.H{
		"id":       user.ID,
		"username": user.Username,
		"fullname": user.Fullname,
		"role":     user.Role,
	}

	if user.Email != "" {
		payload["email"] = user.Email
	}

	return payload
}
