package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/centrifugal/gocent/v3"
)

// CentrifugoClient holds the gocent client with optimized connection settings
type CentrifugoClient struct {
	client *gocent.Client
}

// NewCentrifugoClient initializes the client with a custom HTTP transport
func NewCentrifugoClient(addr, apiKey string) *CentrifugoClient {
	return &CentrifugoClient{
		client: gocent.New(gocent.Config{
			Addr: addr,   // e.g., "http://localhost:8000/api"
			Key:  apiKey, // API Key
			// gocent uses http.Client with keep-alive by default, but we tune it further
			HTTPClient: &http.Client{
				Timeout: 5 * time.Second,
				Transport: &http.Transport{
					MaxIdleConns:        100,
					MaxIdleConnsPerHost: 100,
				},
			},
		}),
	}
}

// PublishData publishes data to a channel.
// It automatically handles binary (b64data) vs JSON (data) fields based on input type.
func (cc *CentrifugoClient) PublishData(channel string, data interface{}) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// gocent.Publish expects []byte. We marshal the interface{} to JSON.
	var payload []byte
	var err error

	if b, ok := data.([]byte); ok {
		payload = b
	} else {
		payload, err = json.Marshal(data)
		if err != nil {
			return fmt.Errorf("json marshal error: %v", err)
		}
	}

	_, err = cc.client.Publish(ctx, channel, payload)
	if err != nil {
		return fmt.Errorf("centrifugo publish error: %v", err)
	}

	return nil
}
