package main

import (
	"context"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/vladwithcode/tasktracker/internal/db"
)

func main() {
	err := godotenv.Overload()
	if err != nil {
		log.Fatalf("failed to load .env file: %v", err)
	}
	var (
		user = os.Getenv("ADMIN_USERNAME")
		pass = os.Getenv("ADMIN_PASSWORD")
	)
	if user == "" || pass == "" {
		log.Fatalf("missing ADMIN_USERNAME or ADMIN_PASSWORD")
	}
	globalCtx := context.Background()

	conn, err := db.Connect(globalCtx)
	if err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}
	defer conn.Close()

	id, err := uuid.NewV7()
	if err != nil {
		log.Fatalf("failed to generate uuid: %v", err)
	}
	defaultUser := db.User{
		ID:       id.String(),
		Fullname: "Administrador",
		Username: user,
		Password: pass,
		Role:     db.RoleSuperAdmin,
		Email:    "admin@tasktracker.com",
	}

	err = db.CreateUser(globalCtx, &defaultUser)
	if err != nil {
		log.Fatalf("failed to create user: %v", err)
	}

	log.Printf("User created with id: %v", id.String())
}
