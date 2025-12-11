package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"socket-benchmark-go/realtime"

	"github.com/golang-jwt/jwt/v5"
	"github.com/vmihailenco/msgpack/v5"
	"github.com/zishang520/socket.io/socket"
)

// User struct with msgpack tags for asArray optimization
type User struct {
	_        struct{} `msgpack:",as_array"` // Magic tag: Encode struct as array
	ID       int      `json:"id"`
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Bio      string   `json:"bio"`
	Active   bool     `json:"active"`
	Roles    []string `json:"roles"`
	Metadata Metadata `json:"metadata"`
}

type Metadata struct {
	_           struct{}    `msgpack:",as_array"`
	LastLogin   string      `json:"lastLogin"`
	Preferences Preferences `json:"preferences"`
}

type Preferences struct {
	_             struct{} `msgpack:",as_array"`
	Theme         string   `json:"theme"`
	Notifications bool     `json:"notifications"`
}

// generateCentrifugoToken generates a Centrifugo client token.
func generateCentrifugoToken(userID string) (string, error) {
	// Secret from config.json
	hmacSecret := []byte("secret")
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(time.Hour * 24).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(hmacSecret)
}

func generateData() []User {
	var data []User
	for i := 0; i < 5000; i++ {
		data = append(data, User{
			ID:     i,
			Name:   fmt.Sprintf("User %d", i),
			Email:  fmt.Sprintf("user%d@example.com", i),
			Bio:    fmt.Sprintf("This is a bio for user %d. It contains some random text to increase the payload size. Lorem ipsum dolor sit amet.", i),
			Active: i%2 == 0,
			Roles:  []string{"user", "editor", "viewer"},
			Metadata: Metadata{
				LastLogin: time.Now().Format(time.RFC3339),
				Preferences: Preferences{
					Theme:         "dark",
					Notifications: true,
				},
			},
		})
	}
	return data
}

func main() {
	largeDataset := generateData()
	fmt.Printf("Generated dataset with %d items.\n", len(largeDataset))

	// Initialize Centrifugo Client (Optimized)
	centClient := realtime.NewCentrifugoClient(
		"http://localhost:8000/api",
		"api_key", // API Key
	)
	fmt.Println("Centrifugo Client initialized")

	socketServer := socket.NewServer(nil, nil)

	socketServer.On("connection", func(clients ...any) {
		client := clients[0].(*socket.Socket)
		fmt.Printf("A user connected: %s\n", client.Id())

		client.On("disconnect", func(...any) {
			fmt.Printf("User disconnected: %s\n", client.Id())
		})

		client.On("request-json", func(...any) {
			fmt.Printf("[%s] requested JSON\n", client.Id())
			client.Emit("response-json", largeDataset)
		})

		client.On("request-buffer", func(...any) {
			fmt.Printf("[%s] requested Buffer (Go Optimized)\n", client.Id())

			// Use msgpack marshal directly
			b, err := msgpack.Marshal(largeDataset)
			if err != nil {
				log.Printf("Error encoding msgpack: %v", err)
				return
			}
			client.Emit("response-buffer", b)
		})

		// Trigger Publish to Centrifugo
		client.On("trigger-centrifugo", func(...any) {
			fmt.Printf("[%s] requested Centrifugo Publish\n", client.Id())

			// Use the optimized client to publish data
			// It automatically handles JSON/Binary based on input type
			if err := centClient.PublishData("benchmark:public:v3", largeDataset); err != nil {
				log.Printf("Error publishing to Centrifugo: %v", err)
				return
			}
			fmt.Println("Published ~1.37MB to 'benchmark:public:v3' channel")
		})
	})

	http.Handle("/socket.io/", socketServer.ServeHandler(nil))

	// Endpoint to get Centrifugo Token
	http.HandleFunc("/api/centrifugo-token", func(w http.ResponseWriter, r *http.Request) {
		// CORS
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == "OPTIONS" {
			return
		}

		// Simple random user ID for demo
		token, err := generateCentrifugoToken("user-" + fmt.Sprint(time.Now().UnixNano()))
		if err != nil {
			http.Error(w, "Error generating token", 500)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{
			"token": token,
		})
	})

	port := ":3002"
	fmt.Printf("Go Backend server running on http://localhost%s\n", port)
	log.Fatal(http.ListenAndServe(port, nil))
}
