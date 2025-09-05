package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func GetUsers(c *gin.Context) {
	// Get auth from context
	auth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get auth"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Hello " + auth.Fullname,
		"users":   []string{"user1", "user2"}, // Replace with actual implementation
	})
}

func GetProfile(c *gin.Context) {
	auth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get auth"})
		return
	}

	// Get full user details from database
	user, err := db.GetUserByID(c.Request.Context(), auth.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"fullname": user.Fullname,
		"email":    user.Email,
		"role":     user.Role,
	})
}

func UpdateProfile(c *gin.Context) {
	auth, err := auth.GetAuth(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get auth"})
		return
	}

	var updateReq struct {
		Fullname string `json:"fullname"`
		Email    string `json:"email"`
	}

	if err := c.ShouldBindJSON(&updateReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get user and update
	user, err := db.GetUserByID(c.Request.Context(), auth.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	user.Fullname = updateReq.Fullname
	user.Email = updateReq.Email

	if err := db.UpdateUser(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

// Admin routes
func GetAllUsers(c *gin.Context) {
	// This route is only accessible by admin or superadmin
	c.JSON(http.StatusOK, gin.H{
		"message": "Admin access granted",
		"users":   []string{"all", "users", "here"},
	})
}

func UpdateUser(c *gin.Context) {
	userID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"message": "User " + userID + " updated",
	})
}

func DeleteUser(c *gin.Context) {
	userID := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"message": "User " + userID + " deleted",
	})
}

// SuperAdmin routes
func CreateAdmin(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Admin created",
	})
}

func GetSystemInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "System info",
	})
}
