package notifications

import (
	"context"
	"encoding/json"
	"log"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/vladwithcode/tasktracker/internal/db"
)

// Push notification functions
type NotificationPayload struct {
	Title              string               `json:"title"`
	Body               string               `json:"body"`
	Icon               string               `json:"icon,omitempty"`
	Badge              string               `json:"badge,omitempty"`
	Tag                string               `json:"tag,omitempty"`
	RequireInteraction bool                 `json:"requireInteraction"`
	URL                string               `json:"url,omitempty"`
	TaskID             string               `json:"taskId,omitempty"`
	Data               map[string]string    `json:"data,omitempty"`
	Actions            []NotificationAction `json:"actions,omitempty"`
}

type NotificationAction struct {
	Action string `json:"action"`
	Title  string `json:"title"`
	Icon   string `json:"icon,omitempty"`
}

func SendNotification(subscription *db.PushSubscription, payload *NotificationPayload, vapidPrivateKey, vapidPublicKey, subscriberEmail string) error {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	// Create webpush subscription
	s := &webpush.Subscription{
		Endpoint: subscription.Endpoint,
		Keys: webpush.Keys{
			Auth:   subscription.Keys.Auth,
			P256dh: subscription.Keys.P256dh,
		},
	}

	// Send notification
	resp, err := webpush.SendNotification(payloadJSON, s, &webpush.Options{
		Subscriber:      subscriberEmail,
		VAPIDPublicKey:  vapidPublicKey,
		VAPIDPrivateKey: vapidPrivateKey,
		TTL:             30,
		Urgency:         webpush.UrgencyHigh,
	})

	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Handle expired subscriptions (410 Gone)
	if resp.StatusCode == 410 {
		// TODO: handle expired subscriptions
		log.Println("expired subscriptions")
		return nil
	}

	return nil
}

// Send notification to all user's devices
func SendNotificationToUser(ctx context.Context, userID string, payload *NotificationPayload, vapidPrivateKey, vapidPublicKey, subscriberEmail string) error {
	subscriptions, err := db.GetSubscriptionsByUserID(ctx, userID)
	if err != nil {
		return err
	}

	for _, sub := range subscriptions {
		// Send to each subscription (each device)
		err := SendNotification(sub, payload, vapidPrivateKey, vapidPublicKey, subscriberEmail)
		if err != nil {
			// Log error but continue with other subscriptions
			log.Printf("Error sending notification to %s\n", err)
			continue
		}
	}

	return nil
}
