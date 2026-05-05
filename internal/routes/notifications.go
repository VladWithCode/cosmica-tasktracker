package routes

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
	"github.com/vladwithcode/tasktracker/internal/notifications"
)

// Add these routes to your router
func registerNotificationRoutes(router *gin.RouterGroup) {
	router.GET("/vapid-key", GetVAPIDPublicKey)
	router.GET("/notifications/vapid-key", GetVAPIDPublicKey)
	router.POST("/notifications/subscribe", SubscribeToPush)
	router.POST("/notifications/unsubscribe", UnsubscribeFromPush)
	router.POST("/notifications/test", SendTestNotification)
}

func GetVAPIDPublicKey(c *gin.Context) {
	publicKey := os.Getenv("VAPID_PUBLIC_KEY")
	if publicKey == "" {
		httpx.ServerError(c, "VAPID public key not configured")
		return
	}

	httpx.OK(c, gin.H{"publicKey": publicKey}, "VAPID public key retrieved")
}

func SubscribeToPush(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "unauthorized")
		log.Printf("unauthorized: %v", err)
		return
	}

	var subscription db.PushSubscription
	if err := c.ShouldBindJSON(&subscription); err != nil {
		httpx.BadRequest(c, "invalid request")
		log.Printf("invalid request: %v", err)
		return
	}

	err = db.SaveSubscription(c.Request.Context(), authData.ID, &subscription)
	if err != nil {
		httpx.ServerError(c, "failed to save subscription")
		log.Printf("failed to save subscription: %v", err)
		return
	}

	httpx.OK(c, gin.H{}, "subscription saved")
}

func UnsubscribeFromPush(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "unauthorized")
		return
	}

	var request struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		httpx.BadRequest(c, "invalid request")
		return
	}

	err = db.DeleteSubscription(c.Request.Context(), authData.ID, request.Endpoint)
	if err != nil {
		httpx.ServerError(c, "failed to remove subscription")
		return
	}

	httpx.OK(c, gin.H{}, "subscription removed")
}

func SendTestNotification(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		httpx.Unauthorized(c, "unauthorized")
		return
	}

	payload := &notifications.NotificationPayload{
		Title:              "Test Notification",
		Body:               "This is a test notification from Task Tracker",
		Icon:               "/icon-192x192.png",
		Badge:              "/badge-72x72.png",
		Tag:                "test-notification",
		RequireInteraction: true,
		URL:                "/tasks",
		Actions: []notifications.NotificationAction{
			{Action: "view", Title: "View Tasks"},
		},
	}

	vapidPrivateKey := os.Getenv("VAPID_PRIVATE_KEY")
	vapidPublicKey := os.Getenv("VAPID_PUBLIC_KEY")
	subscriberEmail := os.Getenv("VAPID_SUBSCRIBER_EMAIL")

	err = notifications.SendNotificationToUser(
		c.Request.Context(),
		authData.ID,
		payload,
		vapidPrivateKey,
		vapidPublicKey,
		subscriberEmail,
	)

	if err != nil {
		httpx.ServerError(c, "failed to send notification")
		return
	}

	httpx.OK(c, gin.H{}, "test notification sent")
}
