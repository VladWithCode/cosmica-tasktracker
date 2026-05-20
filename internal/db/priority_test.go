package db

import (
	"errors"
	"testing"
)

func TestValidatePriority(t *testing.T) {
	tests := []struct {
		name    string
		input   ScheduleTaskPriority
		wantErr bool
	}{
		{"urgent accepted", ScheduleTaskPriorityUrgent, false},
		{"medium accepted", ScheduleTaskPriorityMedium, false},
		{"empty accepted", "", false},
		{"high rejected", ScheduleTaskPriorityHigh, true},
		{"low rejected", ScheduleTaskPriorityLow, true},
		{"random rejected", "critical", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePriority(tt.input)
			if tt.wantErr && err == nil {
				t.Errorf("expected error for %q, got nil", tt.input)
			}
			if !tt.wantErr && err != nil {
				t.Errorf("expected no error for %q, got %v", tt.input, err)
			}
			if tt.wantErr && !errors.Is(err, ErrInvalidPriority) {
				t.Errorf("expected ErrInvalidPriority, got %v", err)
			}
		})
	}
}
