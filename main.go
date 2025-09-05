package main

import (
	"context"
	"log"

	"github.com/joho/godotenv"
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

	conn, err := db.Connect(globalCtx)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	router := routes.NewRouter()
	err = router.Run()
	if err != nil {
		log.Fatalf("Could not start server: %v\n", err)
	}
}
