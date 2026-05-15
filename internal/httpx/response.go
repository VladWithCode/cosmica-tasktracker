package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Data    interface{} `json:"data"`
	Error   interface{} `json:"error"`
	Message string      `json:"message"`
}

func JSON(c *gin.Context, status int, data interface{}, message string) {
	c.JSON(status, Response{
		Data:    data,
		Error:   nil,
		Message: message,
	})
}

func OK(c *gin.Context, data interface{}, message string) {
	JSON(c, http.StatusOK, data, message)
}

func Created(c *gin.Context, data interface{}, message string) {
	JSON(c, http.StatusCreated, data, message)
}

func Error(c *gin.Context, status int, message string) {
	c.JSON(status, Response{
		Data:    nil,
		Error:   message,
		Message: message,
	})
}

func ErrorCode(c *gin.Context, status int, code string, message string) {
	c.JSON(status, Response{
		Data:    nil,
		Error:   code,
		Message: message,
	})
}

func ErrorCodeWithData(c *gin.Context, status int, data interface{}, code string, message string) {
	c.JSON(status, Response{
		Data:    data,
		Error:   code,
		Message: message,
	})
}

func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message)
}

func Conflict(c *gin.Context, code string, message string) {
	ErrorCode(c, http.StatusConflict, code, message)
}

func Unprocessable(c *gin.Context, data interface{}, code string, message string) {
	ErrorCodeWithData(c, http.StatusUnprocessableEntity, data, code, message)
}

func Unauthorized(c *gin.Context, message string) {
	Error(c, http.StatusUnauthorized, message)
}

func Forbidden(c *gin.Context, message string) {
	Error(c, http.StatusForbidden, message)
}

func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, message)
}

func ServerError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, message)
}
