package routes

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
	"github.com/vladwithcode/tasktracker/internal/notifications"
)

type pushSubscriptionRequest struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

type unsubscribeRequest struct {
	Endpoint string `json:"endpoint"`
}

func registerPublicNotificationRoutes(router *gin.RouterGroup) {
	router.GET("/notifications/vapid-public-key", GetVAPIDPublicKey)
	router.GET("/notifications/vapid-key", GetVAPIDPublicKey)
	router.GET("/vapid-key", GetVAPIDPublicKey)
}

func registerNotificationRoutes(router *gin.RouterGroup) {
	router.GET("/notifications/inbox", GetNotificationInbox)
	router.POST("/notifications/inbox/:id/read", MarkNotificationInboxItemRead)
	router.POST("/notifications/subscriptions", SubscribeToPush)
	router.DELETE("/notifications/subscriptions", UnsubscribeFromPush)
	router.POST("/notifications/test", SendTestNotification)

	// Legacy aliases kept for the existing frontend code while the canonical
	// `/notifications/subscriptions` path rolls out.
	router.POST("/notifications/subscribe", SubscribeToPush)
	router.POST("/notifications/unsubscribe", UnsubscribeFromPush)
}

func GetVAPIDPublicKey(c *gin.Context) {
	config := notifications.LoadConfigFromEnv()
	if !config.HasPublicKey() {
		httpx.ErrorCode(c, http.StatusServiceUnavailable, "web_push_not_configured", "Web Push no está configurado")
		return
	}

	httpx.OK(c, gin.H{
		"publicKey":  config.PublicKey,
		"public_key": config.PublicKey,
	}, "VAPID public key retrieved")
}

func SubscribeToPush(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		log.Printf("unauthorized push subscribe: %v", err)
		return
	}

	var request pushSubscriptionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		httpx.BadRequest(c, "Payload de suscripción inválido")
		log.Printf("invalid push subscribe request: %v", err)
		return
	}

	subscription, err := request.toDBSubscription()
	if err != nil {
		httpx.BadRequest(c, err.Error())
		return
	}

	if err := db.SaveSubscription(c.Request.Context(), authData.ID, subscription); err != nil {
		httpx.ServerError(c, "No se pudo guardar la suscripción")
		log.Printf("failed to save push subscription: %v", err)
		return
	}

	httpx.OK(c, gin.H{"subscription": subscription}, "Suscripción guardada")
}

func UnsubscribeFromPush(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	var request unsubscribeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		httpx.BadRequest(c, "Payload de desuscripción inválido")
		return
	}
	endpoint := strings.TrimSpace(request.Endpoint)
	if endpoint == "" {
		httpx.BadRequest(c, "Endpoint requerido")
		return
	}

	if err := db.DeleteSubscription(c.Request.Context(), authData.ID, endpoint); err != nil {
		httpx.ServerError(c, "No se pudo eliminar la suscripción")
		log.Printf("failed to remove push subscription: %v", err)
		return
	}

	httpx.OK(c, gin.H{}, "Suscripción eliminada")
}

func SendTestNotification(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	config := notifications.LoadConfigFromEnv()
	if !config.CanSend() {
		httpx.ErrorCode(c, http.StatusServiceUnavailable, "web_push_not_configured", "Web Push no está configurado")
		return
	}

	payload := &notifications.NotificationPayload{
		Title:              "Routine Ritual",
		Body:               "Notificación de prueba activada correctamente.",
		Icon:               "/icon-192x192.png",
		Badge:              "/badge-72x72.png",
		Tag:                "test-notification",
		RequireInteraction: false,
		URL:                "/tasks",
		Actions: []notifications.NotificationAction{
			{Action: "view", Title: "Ver tareas"},
		},
	}

	sentCount, err := notifications.SendNotificationToUserWithConfig(
		c.Request.Context(),
		authData.ID,
		payload,
		config,
	)
	if err != nil {
		if errors.Is(err, notifications.ErrWebPushNotConfigured) {
			httpx.ErrorCode(c, http.StatusServiceUnavailable, "web_push_not_configured", "Web Push no está configurado")
			return
		}
		httpx.ServerError(c, "No se pudo enviar la notificación de prueba")
		log.Printf("failed to send test notification: %v", err)
		return
	}

	httpx.OK(c, gin.H{"sent_count": sentCount}, "Notificación de prueba enviada")
}

func GetNotificationInbox(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	items, err := db.ListNotificationInbox(c.Request.Context(), authData.ID)
	if err != nil {
		httpx.ServerError(c, "No se pudo cargar la bandeja")
		log.Printf("failed to list notification inbox: %v", err)
		return
	}
	if items == nil {
		items = []*db.NotificationInboxItem{}
	}

	httpx.OK(c, gin.H{"items": items}, "Bandeja recuperada")
}

func MarkNotificationInboxItemRead(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "No autorizado")
		return
	}

	ok, err := db.MarkNotificationInboxItemRead(c.Request.Context(), authData.ID, c.Param("id"))
	if err != nil {
		httpx.ServerError(c, "No se pudo marcar como leído")
		log.Printf("failed to mark inbox item read: %v", err)
		return
	}
	if !ok {
		httpx.NotFound(c, "Notificación no encontrada")
		return
	}

	httpx.OK(c, gin.H{}, "Notificación marcada como leída")
}

func (r pushSubscriptionRequest) toDBSubscription() (*db.PushSubscription, error) {
	endpoint := strings.TrimSpace(r.Endpoint)
	p256dh := strings.TrimSpace(r.Keys.P256dh)
	authKey := strings.TrimSpace(r.Keys.Auth)

	if endpoint == "" {
		return nil, errors.New("Endpoint requerido")
	}
	if p256dh == "" {
		return nil, errors.New("Key p256dh requerida")
	}
	if authKey == "" {
		return nil, errors.New("Key auth requerida")
	}

	return &db.PushSubscription{
		Endpoint: endpoint,
		Keys: db.Keys{
			Auth:   authKey,
			P256dh: p256dh,
		},
	}, nil
}
