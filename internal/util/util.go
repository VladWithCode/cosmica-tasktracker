package util

import "time"

// BeforeTime checks if the input time is before the check time
// checking only for the time (h, m, s), ignoring the date
func BeforeTime(inpTime, chkTime time.Time) bool {
	return TimeToSeconds(inpTime) < TimeToSeconds(chkTime)
}

// AfterTime checks if the input time is after the check time
// checking only for the time (h, m, s), ignoring the date
func AfterTime(inpTime, chkTime time.Time) bool {
	return TimeToSeconds(inpTime) > TimeToSeconds(chkTime)
}

// EqualTime checks if the input time is equal to the check time
// checking only for the time (h, m, s), ignoring the date
func EqualTime(inpTime, chkTime time.Time) bool {
	return TimeToSeconds(inpTime) == TimeToSeconds(chkTime)
}

// TimeToSeconds converts a time to seconds since midnight
func TimeToSeconds(t time.Time) int {
	return t.Hour()*60*60 + t.Minute()*60 + t.Second()
}

// BeforeDate checks if the input date is before the check date,
// ignoring the time, only checking for the date
func BeforeDate(inpDate, chkDate time.Time) bool {
	baseInpTime := time.Date(inpDate.Year(), inpDate.Month(), inpDate.Day(), 0, 0, 0, 0, inpDate.Location())
	baseChkTime := time.Date(chkDate.Year(), chkDate.Month(), chkDate.Day(), 0, 0, 0, 0, chkDate.Location())

	return baseInpTime.Before(baseChkTime)
}

// AfterDate checks if the input date is after the check date,
// ignoring the time, only checking for the date
func AfterDate(inpDate, chkDate time.Time) bool {
	baseInpTime := time.Date(inpDate.Year(), inpDate.Month(), inpDate.Day(), 0, 0, 0, 0, inpDate.Location())
	baseChkTime := time.Date(chkDate.Year(), chkDate.Month(), chkDate.Day(), 0, 0, 0, 0, chkDate.Location())

	return baseInpTime.After(baseChkTime)
}

// EqualDate checks if the input date is equal to the check date,
// ignoring the time, only checking for the date
func EqualDate(inpDate, chkDate time.Time) bool {
	baseInpTime := time.Date(inpDate.Year(), inpDate.Month(), inpDate.Day(), 0, 0, 0, 0, inpDate.Location())
	baseChkTime := time.Date(chkDate.Year(), chkDate.Month(), chkDate.Day(), 0, 0, 0, 0, chkDate.Location())

	return baseInpTime.Equal(baseChkTime)
}
