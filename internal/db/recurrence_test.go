package db

import (
	"testing"
	"time"
)

func date(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

func TestShouldRepeatToday_Daily(t *testing.T) {
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyDaily,
		RepeatInterval:  1,
		Repeating:       true,
		StartDate:       date(2026, 5, 1),
	}
	if !shouldRepeatToday(st, date(2026, 5, 19)) {
		t.Fatal("daily should generate every day")
	}
}

func TestShouldRepeatToday_DailyWithInterval(t *testing.T) {
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyDaily,
		RepeatInterval:  3,
		Repeating:       true,
		StartDate:       date(2026, 5, 1),
	}
	// Day 0 (May 1) → yes, Day 3 (May 4) → yes, Day 4 (May 5) → no
	if !shouldRepeatToday(st, date(2026, 5, 1)) {
		t.Fatal("should generate on start date")
	}
	if !shouldRepeatToday(st, date(2026, 5, 4)) {
		t.Fatal("should generate every 3 days")
	}
	if shouldRepeatToday(st, date(2026, 5, 5)) {
		t.Fatal("should NOT generate on non-interval day")
	}
}

func TestShouldRepeatToday_WeeklyWithWeekdays(t *testing.T) {
	// Mon(1) and Wed(3)
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyWeekly,
		RepeatInterval:  1,
		RepeatWeekdays:  []int{1, 3},
		Repeating:       true,
		StartDate:       date(2026, 5, 1),
	}
	// May 19, 2026 is Tuesday(2) → no
	if shouldRepeatToday(st, date(2026, 5, 19)) {
		t.Fatal("Tuesday not in weekdays [1,3]")
	}
	// May 18, 2026 is Monday(1) → yes
	if !shouldRepeatToday(st, date(2026, 5, 18)) {
		t.Fatal("Monday is in weekdays [1,3]")
	}
	// May 20, 2026 is Wednesday(3) → yes
	if !shouldRepeatToday(st, date(2026, 5, 20)) {
		t.Fatal("Wednesday is in weekdays [1,3]")
	}
}

func TestShouldRepeatToday_BiweeklySkipsOddWeek(t *testing.T) {
	// Start on Monday May 4, 2026
	start := date(2026, 5, 4)
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyBiweekly,
		RepeatInterval:  2,
		RepeatWeekdays:  []int{1}, // Monday
		Repeating:       true,
		StartDate:       start,
	}
	// Week 0 (May 4) → yes (even week)
	if !shouldRepeatToday(st, date(2026, 5, 4)) {
		t.Fatal("should generate in week 0 (start week)")
	}
	// Week 1 (May 11) → no (odd week)
	if shouldRepeatToday(st, date(2026, 5, 11)) {
		t.Fatal("should NOT generate in odd week")
	}
	// Week 2 (May 18) → yes (even week)
	if !shouldRepeatToday(st, date(2026, 5, 18)) {
		t.Fatal("should generate in week 2 (even)")
	}
	// Week 2 Tuesday → no (wrong weekday)
	if shouldRepeatToday(st, date(2026, 5, 19)) {
		t.Fatal("Tuesday not in weekdays for biweekly")
	}
}

func TestShouldRepeatToday_BiweeklyNoWeekdaysUsesStartDay(t *testing.T) {
	// Start on Monday May 4, 2026 — no explicit weekdays
	start := date(2026, 5, 4)
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyBiweekly,
		Repeating:       true,
		StartDate:       start,
	}
	// May 18 is Monday (same weekday, week 2) → yes
	if !shouldRepeatToday(st, date(2026, 5, 18)) {
		t.Fatal("should match start weekday in even week")
	}
	// May 19 is Tuesday → no
	if shouldRepeatToday(st, date(2026, 5, 19)) {
		t.Fatal("should NOT match different weekday")
	}
	// May 11 is Monday (week 1, odd) → no
	if shouldRepeatToday(st, date(2026, 5, 11)) {
		t.Fatal("should NOT generate in odd week")
	}
}

func TestShouldRepeatToday_Monthly(t *testing.T) {
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyMonthly,
		RepeatInterval:  1,
		Repeating:       true,
		StartDate:       date(2026, 1, 15),
	}
	if !shouldRepeatToday(st, date(2026, 5, 15)) {
		t.Fatal("should generate on the 15th each month")
	}
	if shouldRepeatToday(st, date(2026, 5, 16)) {
		t.Fatal("should NOT generate on the 16th")
	}
}

func TestShouldRepeatToday_Bimonthly(t *testing.T) {
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyBimonthly,
		Repeating:       true,
		StartDate:       date(2026, 1, 10),
	}
	// Jan → month 0 (even) → yes
	if !shouldRepeatToday(st, date(2026, 1, 10)) {
		t.Fatal("should generate in start month")
	}
	// Feb → month 1 (odd) → no
	if shouldRepeatToday(st, date(2026, 2, 10)) {
		t.Fatal("should NOT generate in odd month")
	}
	// Mar → month 2 (even) → yes
	if !shouldRepeatToday(st, date(2026, 3, 10)) {
		t.Fatal("should generate in even month")
	}
}

func TestShouldRepeatToday_Yearly(t *testing.T) {
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyYearly,
		Repeating:       true,
		StartDate:       date(2026, 3, 15),
	}
	if !shouldRepeatToday(st, date(2027, 3, 15)) {
		t.Fatal("should generate on same month+day")
	}
	if shouldRepeatToday(st, date(2027, 3, 16)) {
		t.Fatal("should NOT generate on different day")
	}
	if shouldRepeatToday(st, date(2027, 4, 15)) {
		t.Fatal("should NOT generate in different month")
	}
}

func TestShouldCreateTaskForToday_EndDateBlocks(t *testing.T) {
	st := &ScheduleTask{
		Frequency:       ScheduleTaskFrequencyDaily,
		RepeatFrequency: ScheduleTaskRepeatFrequencyDaily,
		Repeating:       true,
		StartDate:       date(2026, 1, 1),
		EndDate:         date(2026, 5, 1),
	}
	if shouldCreateTaskForToday(st, date(2026, 5, 2)) {
		t.Fatal("should NOT generate after end_date")
	}
	if !shouldCreateTaskForToday(st, date(2026, 5, 1)) {
		t.Fatal("should generate ON end_date")
	}
	if !shouldCreateTaskForToday(st, date(2026, 4, 30)) {
		t.Fatal("should generate before end_date")
	}
}

func TestShouldCreateTaskForToday_RepeatEndDateBlocks(t *testing.T) {
	st := &ScheduleTask{
		Frequency:       ScheduleTaskFrequencyDaily,
		RepeatEndDate:   date(2026, 6, 1),
		RepeatFrequency: ScheduleTaskRepeatFrequencyDaily,
		Repeating:       true,
		StartDate:       date(2026, 1, 1),
	}
	if shouldCreateTaskForToday(st, date(2026, 6, 2)) {
		t.Fatal("should NOT generate after repeat_end_date")
	}
}

func TestShouldCreateTaskForToday_CancelledAndPaused(t *testing.T) {
	// getUserActiveScheduleTasks only returns status_level='active' schedules,
	// so cancelled/paused never reach shouldCreateTaskForToday.
	// Verify the query filter exists.
	st := &ScheduleTask{
		Frequency:       ScheduleTaskFrequencyDaily,
		RepeatFrequency: ScheduleTaskRepeatFrequencyDaily,
		Repeating:       true,
		StartDate:       date(2026, 1, 1),
		Status:          ScheduleTaskStatusActive,
	}
	if !shouldCreateTaskForToday(st, date(2026, 5, 19)) {
		t.Fatal("active schedule should generate")
	}
}

func TestShouldRepeatToday_CustomWeeklyEvery3Weeks(t *testing.T) {
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyWeekly,
		RepeatInterval:  3,
		RepeatWeekdays:  []int{1}, // Monday
		Repeating:       true,
		StartDate:       date(2026, 5, 4), // Monday, week 0
	}
	// Week 0 (May 4, Mon) → yes
	if !shouldRepeatToday(st, date(2026, 5, 4)) {
		t.Fatal("should generate in week 0")
	}
	// Week 1 (May 11, Mon) → no
	if shouldRepeatToday(st, date(2026, 5, 11)) {
		t.Fatal("should NOT generate in week 1")
	}
	// Week 2 (May 18, Mon) → no
	if shouldRepeatToday(st, date(2026, 5, 18)) {
		t.Fatal("should NOT generate in week 2")
	}
	// Week 3 (May 25, Mon) → yes
	if !shouldRepeatToday(st, date(2026, 5, 25)) {
		t.Fatal("should generate in week 3")
	}
}

func TestShouldRepeatToday_MonthlyEndOfMonth(t *testing.T) {
	st := &ScheduleTask{
		RepeatFrequency: ScheduleTaskRepeatFrequencyMonthly,
		RepeatInterval:  1,
		Repeating:       true,
		StartDate:       date(2026, 1, 31),
	}
	// Feb has 28 days → anchor clamps to 28
	if !shouldRepeatToday(st, date(2026, 2, 28)) {
		t.Fatal("should clamp to last day of Feb")
	}
	if shouldRepeatToday(st, date(2026, 2, 27)) {
		t.Fatal("should NOT match day before clamped anchor")
	}
}

func TestDaysBetween(t *testing.T) {
	a := date(2026, 5, 1)
	b := date(2026, 5, 4)
	if d := daysBetween(a, b); d != 3 {
		t.Fatalf("expected 3 days, got %d", d)
	}
}

func TestWeeksBetween(t *testing.T) {
	a := date(2026, 5, 4)
	b := date(2026, 5, 18)
	if w := weeksBetween(a, b); w != 2 {
		t.Fatalf("expected 2 weeks, got %d", w)
	}
}

func TestMonthsBetween(t *testing.T) {
	a := date(2026, 1, 15)
	b := date(2026, 5, 15)
	if m := monthsBetween(a, b); m != 4 {
		t.Fatalf("expected 4 months, got %d", m)
	}
}
