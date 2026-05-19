package routes

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"context"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
	"github.com/vladwithcode/tasktracker/internal/notifications"
)

type createSharingGrantRequest struct {
	AccessLevel   string `json:"access_level"`
	Grantee       string `json:"grantee"`
	GranteeUserID string `json:"grantee_user_id"`
}

func registerSharingRoutes(router *gin.RouterGroup) {
	router.GET("/sharing/grants", ListSharingGrants)
	router.POST("/sharing/grants", CreateSharingGrant)
	router.DELETE("/sharing/grants/:id", RevokeSharingGrant)
	router.GET("/sharing/shared-with-me", ListSharedWithMe)
	router.GET("/sharing/users/search", SearchSharingUsers)
	router.GET("/sharing/invitations", ListSharingInvitations)
	router.POST("/sharing/invitations/:id/read", MarkSharingInvitationRead)
}

func ListSharingGrants(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	grants, err := db.ListTaskAccessGrantsByOwner(c.Request.Context(), authData.ID)
	if err != nil {
		httpx.ServerError(c, "No se pudieron recuperar los permisos")
		log.Printf("failed to list sharing grants: %v", err)
		return
	}

	httpx.OK(c, gin.H{"grants": grants}, "Permisos recuperados")
}

func ListSharedWithMe(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	grants, err := db.ListTaskAccessGrantsForGrantee(c.Request.Context(), authData.ID)
	if err != nil {
		httpx.ServerError(c, "No se pudieron recuperar los accesos compartidos")
		log.Printf("failed to list shared-with-me grants: %v", err)
		return
	}

	httpx.OK(c, gin.H{"grants": grants}, "Accesos compartidos recuperados")
}

func SearchSharingUsers(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	query := strings.TrimSpace(c.Query("q"))
	if len(query) < 2 {
		httpx.OK(c, gin.H{"users": []db.SharingUser{}}, "Usuarios recuperados")
		return
	}

	users, err := db.SearchSharingUsers(c.Request.Context(), authData.ID, query, 10)
	if err != nil {
		httpx.ServerError(c, "No se pudieron buscar usuarios")
		log.Printf("failed to search sharing users: %v", err)
		return
	}

	httpx.OK(c, gin.H{"users": users}, "Usuarios recuperados")
}

func CreateSharingGrant(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	var request createSharingGrantRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		httpx.BadRequest(c, "Información inválida")
		return
	}

	accessLevel, err := db.NormalizeSharingAccessLevel(request.AccessLevel)
	if err != nil {
		httpx.BadRequest(c, "Nivel de acceso inválido")
		return
	}

	grantee, err := resolveSharingGrantee(c, request)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.NotFound(c, "Usuario no encontrado")
			return
		}
		httpx.ServerError(c, "No se pudo validar el usuario")
		log.Printf("failed to resolve sharing grantee: %v", err)
		return
	}
	if grantee.ID == authData.ID {
		httpx.BadRequest(c, "No puedes compartir tareas contigo mismo")
		return
	}

	_, err = db.GetActiveTaskAccessGrantByPair(c.Request.Context(), authData.ID, grantee.ID)
	if err == nil {
		httpx.Conflict(c, "active_grant_exists", "Ya existe un permiso activo para este usuario")
		return
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.ServerError(c, "No se pudo validar permisos existentes")
		log.Printf("failed to validate duplicate sharing grant: %v", err)
		return
	}

	grant := &db.TaskAccessGrant{
		OwnerUserID:   authData.ID,
		GranteeUserID: grantee.ID,
		AccessLevel:   accessLevel,
	}
	if err := db.CreateTaskAccessGrant(c.Request.Context(), grant); err != nil {
		httpx.ServerError(c, "No se pudo crear el permiso")
		log.Printf("failed to create sharing grant: %v", err)
		return
	}

	createdGrant, err := db.GetActiveTaskAccessGrantByPair(c.Request.Context(), authData.ID, grantee.ID)
	if err != nil {
		httpx.Created(c, gin.H{"grant": grant}, "Permiso creado")
		return
	}

	// Create invitation so grantee is notified.
	if invErr := db.CreateSharingInvitation(c.Request.Context(), createdGrant.ID, authData.ID, grantee.ID); invErr != nil {
		log.Printf("failed to create sharing invitation for grant %s: %v", createdGrant.ID, invErr)
	} else {
		go sendSharingInvitationPush(c.Request.Context(), createdGrant)
	}

	httpx.Created(c, gin.H{"grant": createdGrant}, "Permiso creado")
}

func sendSharingInvitationPush(ctx context.Context, grant *db.TaskAccessGrant) {
	config := notifications.LoadConfigFromEnv()
	if !config.CanSend() {
		return
	}
	ownerName := grant.OwnerFullname
	if ownerName == "" {
		ownerName = "@" + grant.OwnerUsername
	}
	payload := &notifications.NotificationPayload{
		Title: "Nuevo acceso compartido",
		Body:  ownerName + " te compartió acceso a sus tareas.",
		Icon:  "/icon-192x192.png",
		Badge: "/badge-72x72.png",
		Tag:   "sharing-" + grant.ID,
		URL:   "/shared/" + grant.OwnerUserID,
	}
	if _, err := notifications.SendNotificationToUserWithConfig(ctx, grant.GranteeUserID, payload, config); err != nil {
		log.Printf("sharing push failed for grantee %s: %v", grant.GranteeUserID, err)
	}
}

func ListSharingInvitations(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	items, err := db.ListSharingInvitations(c.Request.Context(), authData.ID)
	if err != nil {
		httpx.ServerError(c, "No se pudieron cargar las invitaciones")
		log.Printf("failed to list sharing invitations: %v", err)
		return
	}
	if items == nil {
		items = []*db.SharingInvitation{}
	}

	httpx.OK(c, gin.H{"invitations": items}, "Invitaciones recuperadas")
}

func MarkSharingInvitationRead(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	ok, err := db.MarkSharingInvitationRead(c.Request.Context(), authData.ID, c.Param("id"))
	if err != nil {
		httpx.ServerError(c, "No se pudo marcar como leída")
		log.Printf("failed to mark sharing invitation read: %v", err)
		return
	}
	if !ok {
		httpx.NotFound(c, "Invitación no encontrada")
		return
	}

	httpx.OK(c, gin.H{}, "Invitación marcada como leída")
}

func RevokeSharingGrant(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	revoked, err := db.RevokeTaskAccessGrant(c.Request.Context(), authData.ID, c.Param("id"))
	if err != nil {
		httpx.ServerError(c, "No se pudo revocar el permiso")
		log.Printf("failed to revoke sharing grant: %v", err)
		return
	}
	if !revoked {
		httpx.NotFound(c, "Permiso no encontrado")
		return
	}

	httpx.OK(c, gin.H{}, "Permiso revocado")
}

func resolveSharingGrantee(c *gin.Context, request createSharingGrantRequest) (*db.User, error) {
	if strings.TrimSpace(request.GranteeUserID) != "" {
		return db.GetUserByID(c.Request.Context(), strings.TrimSpace(request.GranteeUserID))
	}

	identifier := strings.TrimSpace(request.Grantee)
	if identifier == "" {
		return nil, pgx.ErrNoRows
	}

	return db.GetUserByUsernameOrEmail(c.Request.Context(), identifier)
}

func sharingPermissionDenied(c *gin.Context) {
	httpx.ErrorCode(c, http.StatusForbidden, "sharing_permission_denied", "No tienes permiso para acceder a este recurso compartido")
}
