package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/vladwithcode/tasktracker/internal/db"
)

var (
	ErrWebPushNotConfigured = errors.New("web push is not configured")

	// ErrSubscriptionExpired indicates that the push service rejected the
	// subscription permanently (HTTP 404 or 410). The caller should remove
	// the subscription so that future sends do not retry a dead endpoint.
	ErrSubscriptionExpired = errors.New("push subscription expired or not found")
)

type Config struct {
	PublicKey  string
	PrivateKey string
	Subject    string
}

func LoadConfigFromEnv() Config {
	subject := strings.TrimSpace(os.Getenv("VAPID_SUBJECT"))
	if subject == "" {
		subject = strings.TrimSpace(os.Getenv("VAPID_SUBSCRIBER_EMAIL"))
	}
	if subject == "" {
		subject = "mailto:admin@example.com"
	}

	return Config{
		PublicKey:  strings.TrimSpace(os.Getenv("VAPID_PUBLIC_KEY")),
		PrivateKey: strings.TrimSpace(os.Getenv("VAPID_PRIVATE_KEY")),
		Subject:    subject,
	}
}

func (c Config) HasPublicKey() bool {
	return c.PublicKey != ""
}

func (c Config) CanSend() bool {
	return c.PublicKey != "" && c.PrivateKey != "" && c.Subject != ""
}

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
	return SendNotificationWithConfig(subscription, payload, Config{
		PrivateKey: vapidPrivateKey,
		PublicKey:  vapidPublicKey,
		Subject:    subscriberEmail,
	})
}

func SendNotificationWithConfig(subscription *db.PushSubscription, payload *NotificationPayload, config Config) error {
	if !config.CanSend() {
		return ErrWebPushNotConfigured
	}

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
		Subscriber:      config.Subject,
		VAPIDPublicKey:  config.PublicKey,
		VAPIDPrivateKey: config.PrivateKey,
		TTL:             30,
		Urgency:         webpush.UrgencyHigh,
	})

	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 404 and 410 are permanent rejections from the push service — the
	// subscription no longer exists on the provider side. Return a typed
	// error so the caller can clean up the local record.
	if resp.StatusCode == 404 || resp.StatusCode == 410 {
		log.Printf("push subscription expired (HTTP %d): %s", resp.StatusCode, subscription.Endpoint)
		return fmt.Errorf("%w: HTTP %d for endpoint %s", ErrSubscriptionExpired, resp.StatusCode, subscription.Endpoint)
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("web push provider returned status %d", resp.StatusCode)
	}

	return nil
}

// Send notification to all user's devices
func SendNotificationToUser(ctx context.Context, userID string, payload *NotificationPayload, vapidPrivateKey, vapidPublicKey, subscriberEmail string) error {
	_, err := SendNotificationToUserWithConfig(ctx, userID, payload, Config{
		PrivateKey: vapidPrivateKey,
		PublicKey:  vapidPublicKey,
		Subject:    subscriberEmail,
	})
	return err
}

func SendNotificationToUserWithConfig(ctx context.Context, userID string, payload *NotificationPayload, config Config) (int, error) {
	if !config.CanSend() {
		return 0, ErrWebPushNotConfigured
	}

	subscriptions, err := db.GetSubscriptionsByUserID(ctx, userID)
	if err != nil {
		return 0, err
	}

	sentCount := 0
	for _, sub := range subscriptions {
		// Send to each subscription (each device)
		err := SendNotificationWithConfig(sub, payload, config)
		if err != nil {
			if errors.Is(err, ErrSubscriptionExpired) {
				// The push service permanently rejected this subscription.
				// Remove it so we stop retrying on every future send.
				if delErr := db.DeleteSubscriptionByID(ctx, sub.ID); delErr != nil {
					log.Printf("failed to remove expired subscription %s: %v", sub.ID, delErr)
				} else {
					log.Printf("removed expired push subscription %s (endpoint %s) for user %s",
						sub.ID, sub.Endpoint, userID)
				}
			} else {
				// Transient error — log but keep the subscription for next time.
				log.Printf("Error sending notification to %s\n", err)
			}
			continue
		}
		sentCount++
	}

	return sentCount, nil
}
