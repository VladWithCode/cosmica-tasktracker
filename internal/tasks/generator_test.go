package tasks

import (
	"testing"
	"time"
)

func TestTaskGeneratorConfigFromEnvDefaultsDisabled(t *testing.T) {
	t.Setenv("ENABLE_TASK_GENERATOR", "")
	t.Setenv("TASK_GENERATOR_INTERVAL_MINUTES", "")

	enabled, interval := TaskGeneratorConfigFromEnv()
	if enabled {
		t.Fatal("expected task generator to be disabled by default")
	}
	if interval != defaultGeneratorInterval {
		t.Fatalf("expected default interval %s, got %s", defaultGeneratorInterval, interval)
	}
}

func TestTaskGeneratorConfigFromEnvRequiresExplicitEnable(t *testing.T) {
	for _, value := range []string{"false", "0", "yes"} {
		t.Run(value, func(t *testing.T) {
			t.Setenv("ENABLE_TASK_GENERATOR", value)
			t.Setenv("TASK_GENERATOR_INTERVAL_MINUTES", "5")

			enabled, interval := TaskGeneratorConfigFromEnv()
			if enabled {
				t.Fatalf("expected generator disabled for %q", value)
			}
			if interval != defaultGeneratorInterval {
				t.Fatalf("expected disabled config to keep default interval, got %s", interval)
			}
		})
	}
}

func TestTaskGeneratorConfigFromEnvParsesEnabledInterval(t *testing.T) {
	t.Setenv("ENABLE_TASK_GENERATOR", "true")
	t.Setenv("TASK_GENERATOR_INTERVAL_MINUTES", "15")

	enabled, interval := TaskGeneratorConfigFromEnv()
	if !enabled {
		t.Fatal("expected task generator enabled")
	}
	if interval != 15*time.Minute {
		t.Fatalf("expected 15m interval, got %s", interval)
	}
}
