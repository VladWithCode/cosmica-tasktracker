package main

import (
	"context"
	"log"
	"time"

	"github.com/joho/godotenv"
	"github.com/vladwithcode/tasktracker/internal/auth"
	"github.com/vladwithcode/tasktracker/internal/db"
	"github.com/vladwithcode/tasktracker/internal/routes"
)

const (
	DefaultPort = "8080"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("error loading env file: %v\n", err)
	}
	globalCtx := context.Background()
	time.Local, err = time.LoadLocation("America/Mexico_City")
	if err != nil {
		log.Printf("failed to load time zone: %v\n", err)
		log.Println("defaulting to UTC")
		time.Local = time.UTC
	}

	conn, err := db.Connect(globalCtx)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	auth.SetAuthParameters()

	router := routes.NewRouter()
	err = router.Run()
	if err != nil {
		log.Fatalf("Could not start server: %v\n", err)
	}
}
