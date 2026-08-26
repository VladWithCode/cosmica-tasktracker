// Package auth contains functions pertaining to user authentication
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/httpx"
)

var (
	// UseSecureCookies is a flag to enable secure cookies, by default they are not secure
	// This should be set to true in production, through the USE_SECURE_COOKIES environment variable
	UseSecureCookies = false
	// UseHTTPOnlyCookies is a flag to enable HTTP only cookies, by default they are HTTP only
	// This may be changed through the USE_HTTP_ONLY_COOKIES environment variable if needed
	UseHTTPOnlyCookies = true
	// DefaultCookieName is the name of the cookie used to store the access token
	DefaultCookieName = "auth_token"
	// DefaultCookieMaxAge is the max age of the access cookie in seconds.
	// The cookie outlives the short-lived access JWT so the browser keeps
	// presenting it; the server rejects it once the JWT itself expires and the
	// client refreshes through the refresh cookie.
	DefaultCookieMaxAge = 60 * 60 * 24 * 7 // 1 week
	// RefreshCookieName is the name of the cookie holding the opaque refresh token.
	RefreshCookieName = "refresh_token"
	// RefreshCookiePath restricts the refresh cookie to the auth endpoints.
	// It must cover both /api/v1/auth/refresh (rotation) and
	// /api/v1/auth/logout (server-side revoke), so it is scoped to the auth
	// group rather than the refresh endpoint alone.
	RefreshCookiePath = "/api/v1/auth"
	// RefreshCookieMaxAge is the max age of the refresh cookie in seconds.
	RefreshCookieMaxAge = 60 * 60 * 24 * 30 // 30 days
)

func SetAuthParameters() {
	UseSecureCookies = os.Getenv("USE_SECURE_COOKIES") == "true"
	UseHTTPOnlyCookies = os.Getenv("USE_HTTP_ONLY_COOKIES") != "false"

	envCookieName := os.Getenv("DEFAULT_COOKIE_NAME")
	if envCookieName != "" {
		DefaultCookieName = envCookieName
	}
	envMaxAge, _ := strconv.Atoi(os.Getenv("DEFAULT_COOKIE_MAX_AGE"))
	if envMaxAge > 0 {
		DefaultCookieMaxAge = envMaxAge
	}

	if envAccessTTL, _ := strconv.Atoi(os.Getenv("ACCESS_TOKEN_TTL_SECONDS")); envAccessTTL > 0 {
		AccessTokenTTL = time.Duration(envAccessTTL) * time.Second
	}
	if envRefreshTTL, _ := strconv.Atoi(os.Getenv("REFRESH_TOKEN_TTL_SECONDS")); envRefreshTTL > 0 {
		RefreshTokenTTL = time.Duration(envRefreshTTL) * time.Second
		RefreshCookieMaxAge = envRefreshTTL
	}
}

var (
	ErrInvalidAuth = errors.New("invalid auth")
)

type AccessLevel uint8

const (
	AccessLevelUser AccessLevel = iota
	AccessLevelAdmin
	AccessLevelSuperAdmin
)

type Auth struct {
	ID       string
	Email    string
	Username string
	Fullname string
	Role     string
}

func (a *Auth) HasAccess(reqLv AccessLevel) bool {
	var roleLv AccessLevel = 0
	switch a.Role {
	case db.RoleUser:
		roleLv = 0
	case db.RoleAdmin:
		roleLv = 1
	case db.RoleSuperAdmin:
		roleLv = 2
	}

	return roleLv >= reqLv
}

type AuthedHandler func(w http.ResponseWriter, r *http.Request, auth *Auth)

type AuthClaims struct {
	ID       string
	Username string
	Fullname string
	Role     string

	jwt.RegisteredClaims
}

// AccessTokenTTL is the lifetime of the short-lived access JWT. Kept short so a
// leaked access token has a small window; sessions stay alive through refresh
// token rotation. Overridable via ACCESS_TOKEN_TTL_SECONDS.
var AccessTokenTTL = 15 * time.Minute

// RefreshTokenTTL is the lifetime of an opaque refresh token. Overridable via
// REFRESH_TOKEN_TTL_SECONDS.
var RefreshTokenTTL = 30 * 24 * time.Hour

// DefaultExpirationTime is retained for backward compatibility with callers
// that referenced it. New code should use AccessTokenTTL.
const DefaultExpirationTime = time.Hour * 24
const InvalidTokenID = "invalid"
const ExpiredTokenID = "expired"

// refreshTokenBytes is the number of random bytes in an opaque refresh token.
const refreshTokenBytes = 32

// GenerateRefreshToken returns a new cryptographically random opaque refresh
// token, URL-safe base64 encoded. This is the raw value handed to the client;
// only its hash is ever persisted.
func GenerateRefreshToken() (string, error) {
	buf := make([]byte, refreshTokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// HashRefreshToken returns the hex-encoded SHA-256 hash of a raw refresh token.
// Stored and compared instead of the raw token so a database leak does not
// expose usable tokens.
func HashRefreshToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

type AuthCtxKey string

const DefaultAuthCtxKey AuthCtxKey = "auth"

func CreateToken(user *db.User) (string, error) {
	var (
		t *jwt.Token
		k = os.Getenv("JWT_SECRET")
	)
	expTime := time.Now().Add(AccessTokenTTL)

	t = jwt.NewWithClaims(jwt.SigningMethodHS256, AuthClaims{
		user.ID,
		user.Username,
		user.Fullname,
		user.Role,

		jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expTime),
		},
	})

	return t.SignedString([]byte(k))
}

func ParseToken(tokenStr string) (*jwt.Token, error) {
	var (
		t *jwt.Token
		k = os.Getenv("JWT_SECRET")
	)

	t, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}

		return []byte(k), nil
	})

	if err != nil {
		return nil, err
	}

	return t, nil
}

// AuthRequired is the Gin middleware for protecting routes that require authentication
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		cookieToken, err := c.Request.Cookie(DefaultCookieName)
		if err != nil {
			RejectUnauthenticated(c, "No se encontró token")
			c.Abort()
			return
		}

		tokenStr := strings.Split(cookieToken.String(), "=")
		if len(tokenStr) < 2 {
			RejectUnauthenticated(c, "Token inválido")
			c.Abort()
			return
		}

		t, err := ParseToken(tokenStr[1])
		if err != nil {
			if errors.Is(err, jwt.ErrTokenExpired) {
				RejectUnauthenticated(c, "Sesión expirada")
			} else {
				RejectUnauthenticated(c, "Sesión Token inválido")
			}
			c.Abort()
			return
		}

		if claims, ok := t.Claims.(jwt.MapClaims); ok && t.Valid {
			var (
				id, ok1       = claims["ID"].(string)
				username, ok2 = claims["Username"].(string)
				role, ok3     = claims["Role"].(string)
				fullname, ok4 = claims["Fullname"].(string)
			)

			if !ok1 || !ok2 || !ok3 || !ok4 {
				RejectUnauthenticated(c, "Token claims inválidos")
				c.Abort()
				return
			}

			user, err := db.GetUserByID(c.Request.Context(), id)
			if err != nil {
				RejectUnauthenticated(c, "Usuario inexistente")
				c.Abort()
				log.Printf("failed to get user: %v", err)
				return
			}

			a := &Auth{
				ID:       id,
				Email:    user.Email,
				Username: username,
				Role:     role,
				Fullname: fullname,
			}

			// Store auth in Gin context
			c.Set(string(DefaultAuthCtxKey), a)

			// Also add to request context for compatibility with existing code
			ctx := context.WithValue(c.Request.Context(), DefaultAuthCtxKey, a)
			c.Request = c.Request.WithContext(ctx)

			c.Next()
		} else {
			RejectUnauthenticated(c, "Sesión Token inválido")
			c.Abort()
			return
		}
	}
}

// RequireRole is a middleware that checks if the authenticated user has one of the required roles
func RequireAccessLevel(lv AccessLevel) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth, exists := c.Get(string(DefaultAuthCtxKey))
		if !exists {
			RejectUnauthenticated(c, "No autorizado")
			c.Abort()
			return
		}

		authData, ok := auth.(*Auth)
		if !ok {
			RejectUnauthenticated(c, "Auth data inválida")
			c.Abort()
			return
		}

		if !authData.HasAccess(lv) {
			httpx.Forbidden(c, "Permiso insuficiente")
			c.Abort()
			return
		}

		c.Next()
	}
}

// OptionalAuth is a middleware that attempts to authenticate but doesn't reject if no auth is present
func OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		cookieToken, err := c.Request.Cookie(DefaultCookieName)
		if err != nil {
			// No auth token, continue without auth
			c.Next()
			return
		}

		tokenStr := strings.Split(cookieToken.String(), "=")
		if len(tokenStr) < 2 {
			c.Next()
			return
		}

		t, err := ParseToken(tokenStr[1])
		if err != nil {
			c.Next()
			return
		}

		if claims, ok := t.Claims.(jwt.MapClaims); ok && t.Valid {
			var (
				id, ok1       = claims["ID"].(string)
				username, ok2 = claims["Username"].(string)
				role, ok3     = claims["Role"].(string)
				fullname, ok4 = claims["Fullname"].(string)
			)

			if ok1 && ok2 && ok3 && ok4 {
				a := &Auth{
					ID:       id,
					Email:    "",
					Username: username,
					Role:     role,
					Fullname: fullname,
				}

				// Store auth in Gin context
				c.Set(string(DefaultAuthCtxKey), a)

				// Also add to request context for compatibility
				ctx := context.WithValue(c.Request.Context(), DefaultAuthCtxKey, a)
				c.Request = c.Request.WithContext(ctx)
			}
		}

		c.Next()
	}
}

// PopulateAuth is kept for backward compatibility with non-Gin handlers
func PopulateAuth(next AuthedHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookieToken, err := r.Cookie(DefaultCookieName)
		var auth = &Auth{}
		authedReq := r.WithContext(context.WithValue(r.Context(), DefaultAuthCtxKey, auth))
		defer next(w, authedReq, auth)
		if err != nil {
			auth.ID = InvalidTokenID
			return
		}

		tokenStr := strings.Split(cookieToken.String(), "=")
		if len(tokenStr) < 2 {
			auth.ID = InvalidTokenID
			return
		}

		t, err := ParseToken(tokenStr[1])
		if err != nil {
			if errors.Is(err, jwt.ErrTokenExpired) {
				auth.ID = ExpiredTokenID
				return
			}
			auth.ID = InvalidTokenID
			return
		}

		if claims, ok := t.Claims.(jwt.MapClaims); ok && t.Valid {
			var (
				id, ok1       = claims["ID"].(string)
				username, ok2 = claims["Username"].(string)
				role, ok3     = claims["Role"].(string)
				fullname, ok4 = claims["Fullname"].(string)
			)

			if !ok1 || !ok2 || !ok3 || !ok4 {
				auth.ID = InvalidTokenID
				return
			}

			auth.ID = id
			auth.Role = role
			auth.Username = username
			auth.Fullname = fullname
		}
	}
}

func RejectUnauthenticated(c *gin.Context, reason string) {
	c.JSON(http.StatusUnauthorized, httpx.Response{
		Data:    gin.H{"reason": reason},
		Error:   "No autorizado",
		Message: "No autorizado",
	})
}

// GetAuth retrieves the Auth from Gin context
func GetAuth(c *gin.Context) (*Auth, error) {
	auth, exists := c.Get(string(DefaultAuthCtxKey))
	if !exists {
		return nil, ErrInvalidAuth
	}

	authData, ok := auth.(*Auth)
	if !ok {
		return nil, ErrInvalidAuth
	}

	return authData, nil
}

// ExtractAuthFromReq is kept for backward compatibility
func ExtractAuthFromReq(r *http.Request) (*Auth, error) {
	auth, ok := r.Context().Value(DefaultAuthCtxKey).(*Auth)
	if !ok || auth == nil {
		return nil, ErrInvalidAuth
	}

	return auth, nil
}

// ExtractAuthFromCtx is kept for backward compatibility
func ExtractAuthFromCtx(ctx context.Context) (*Auth, error) {
	auth, ok := ctx.Value(DefaultAuthCtxKey).(*Auth)
	if !ok || auth == nil {
		return nil, ErrInvalidAuth
	}

	return auth, nil
}
