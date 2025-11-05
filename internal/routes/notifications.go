package routes

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/notifications"
)

// Add these routes to your router
func registerNotificationRoutes(router *gin.RouterGroup) {
	router.GET("/vapid-key", GetVAPIDPublicKey)
	router.POST("/notifications/subscribe", SubscribeToPush)
	router.POST("/notifications/unsubscribe", UnsubscribeFromPush)
	router.POST("/notifications/test", SendTestNotification)
}

func GetVAPIDPublicKey(c *gin.Context) {
	publicKey := os.Getenv("VAPID_PUBLIC_KEY")
	if publicKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "VAPID public key not configured",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"publicKey": publicKey,
	})
}

func SubscribeToPush(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		log.Printf("unauthorized: %v", err)
		return
	}

	var subscription db.PushSubscription
	if err := c.ShouldBindJSON(&subscription); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		log.Printf("invalid request: %v", err)
		return
	}

	conn, err := db.GetConn(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		log.Printf("database error: %v", err)
		return
	}
	defer conn.Release()

	err = db.SaveSubscription(c.Request.Context(), authData.ID, &subscription)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save subscription"})
		log.Printf("failed to save subscription: %v", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "subscription saved",
	})
}

func UnsubscribeFromPush(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var request struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	conn, err := db.GetConn(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer conn.Release()

	err = db.DeleteSubscription(c.Request.Context(), authData.ID, request.Endpoint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove subscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "subscription removed",
	})
}

func SendTestNotification(c *gin.Context) {
	authData, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	conn, err := db.GetConn(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer conn.Release()

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send notification"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "test notification sent",
	})
}
