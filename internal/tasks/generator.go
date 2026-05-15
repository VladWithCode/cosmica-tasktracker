package tasks

import (
	"context"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/vladwithcode/tasktracker/internal/db"
)

const (
	defaultGeneratorInterval = 60 * time.Minute
)

type TaskGenerator struct {
	ctx      context.Context
	interval time.Duration
}

func NewTaskGenerator(ctx context.Context, interval time.Duration) *TaskGenerator {
	if interval <= 0 {
		interval = defaultGeneratorInterval
	}
	return &TaskGenerator{ctx: ctx, interval: interval}
}

func TaskGeneratorConfigFromEnv() (bool, time.Duration) {
	if value := strings.TrimSpace(os.Getenv("ENABLE_TASK_GENERATOR")); value != "" {
		enabled := strings.EqualFold(value, "true") || value == "1"
		if !enabled {
			return false, defaultGeneratorInterval
		}
	} else {
		return false, defaultGeneratorInterval
	}

	interval := defaultGeneratorInterval
	if value := strings.TrimSpace(os.Getenv("TASK_GENERATOR_INTERVAL_MINUTES")); value != "" {
		minutes, err := strconv.Atoi(value)
		if err == nil && minutes > 0 {
			interval = time.Duration(minutes) * time.Minute
		}
	}

	return true, interval
}

func (g *TaskGenerator) Start() {
	log.Printf("scheduled task generator started interval=%s", g.interval)
	g.runOnce()

	ticker := time.NewTicker(g.interval)
	defer ticker.Stop()

	for {
		select {
		case <-g.ctx.Done():
			log.Println("scheduled task generator stopped")
			return
		case <-ticker.C:
			g.runOnce()
		}
	}
}

func (g *TaskGenerator) runOnce() {
	processedUsers, err := db.GenerateTodayTasksForActiveUsers(g.ctx)
	if err != nil {
		log.Printf("scheduled task generation failed: %v", err)
		return
	}
	log.Printf("scheduled task generation completed users=%d", processedUsers)
}
