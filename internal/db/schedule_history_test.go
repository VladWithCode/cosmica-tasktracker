package db

import "testing"

func TestSummarizeScheduleHistoryStreaks(t *testing.T) {
	entries := func(statuses ...TaskStatus) []ScheduleHistoryEntry {
		dates := []string{"2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"}
		result := make([]ScheduleHistoryEntry, 0, len(statuses))
		for index, status := range statuses {
			result = append(result, ScheduleHistoryEntry{Date: dates[index], Status: status})
		}
		return result
	}
	const today = "2026-11-02"

	cases := []struct {
		name    string
		entries []ScheduleHistoryEntry
		current int
		best    int
	}{
		{"empty", entries(), 0, 0},
		{"open today does not break streak", entries(TaskStatusCompleted, TaskStatusCompleted, TaskStatusCompleted, TaskStatusCompleted, TaskStatusCompleted, TaskStatusPending), 5, 5},
		{"open future is ignored", entries(TaskStatusSkipped, TaskStatusCompleted, TaskStatusCompleted, TaskStatusCompleted, TaskStatusCompleted, TaskStatusCompleted, TaskStatusPending), 5, 5},
		{"past pending breaks streak", entries(TaskStatusCompleted, TaskStatusCompleted, TaskStatusPending, TaskStatusCompleted), 1, 2},
		{"dismissed today breaks streak", entries(TaskStatusCompleted, TaskStatusCompleted, TaskStatusCompleted, TaskStatusCompleted, TaskStatusCompleted, TaskStatusDismissed), 0, 5},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			history := &ScheduleHistory{Entries: tc.entries}
			summarizeScheduleHistory(history, today)
			if history.CurrentStreak != tc.current || history.BestStreak != tc.best {
				t.Fatalf("streaks = %d/%d, want %d/%d", history.CurrentStreak, history.BestStreak, tc.current, tc.best)
			}
			if history.Total != len(tc.entries) {
				t.Fatalf("total = %d, want %d", history.Total, len(tc.entries))
			}
		})
	}
}
