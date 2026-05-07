package notifications

import (
	"errors"
	"fmt"
	"testing"
)

func TestErrSubscriptionExpiredWrapping(t *testing.T) {
	// Simulate the wrapped error that SendNotificationWithConfig produces
	// when the push service responds with 404 or 410.
	for _, code := range []int{404, 410} {
		t.Run(fmt.Sprintf("HTTP_%d", code), func(t *testing.T) {
			err := fmt.Errorf("%w: HTTP %d for endpoint https://example.com/push/test", ErrSubscriptionExpired, code)
			if !errors.Is(err, ErrSubscriptionExpired) {
				t.Fatalf("expected errors.Is(err, ErrSubscriptionExpired) for HTTP %d", code)
			}
		})
	}
}

func TestErrSubscriptionExpiredIsNotGenericError(t *testing.T) {
	// A generic web push error (e.g. 429, 500) should NOT match
	// ErrSubscriptionExpired.
	genericErr := fmt.Errorf("web push provider returned status %d", 500)
	if errors.Is(genericErr, ErrSubscriptionExpired) {
		t.Fatal("generic 500 error should not match ErrSubscriptionExpired")
	}
}

func TestConfigCanSend(t *testing.T) {
	tests := []struct {
		name   string
		config Config
		want   bool
	}{
		{"full config", Config{PublicKey: "pub", PrivateKey: "priv", Subject: "mailto:x"}, true},
		{"missing private", Config{PublicKey: "pub", Subject: "mailto:x"}, false},
		{"missing public", Config{PrivateKey: "priv", Subject: "mailto:x"}, false},
		{"missing subject", Config{PublicKey: "pub", PrivateKey: "priv"}, false},
		{"all empty", Config{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.config.CanSend(); got != tt.want {
				t.Fatalf("CanSend() = %v, want %v", got, tt.want)
			}
		})
	}
}
