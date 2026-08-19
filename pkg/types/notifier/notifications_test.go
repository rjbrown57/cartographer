package notifier

import (
	"context"
	"testing"
	"time"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// TestNewNotifier verifies a notifier starts with no subscribers.
func TestNewNotifier(t *testing.T) {
	notifier := NewNotifier()
	if notifier == nil {
		t.Fatal("Expected notifier to be non-nil")
	}
	if len(notifier.Subscribers) != 0 {
		t.Fatalf("Expected no subscribers, got %d", len(notifier.Subscribers))
	}
}

// TestSubscribe verifies a subscriber is registered and returned.
func TestSubscribe(t *testing.T) {
	notifier := NewNotifier()
	subscriber := notifier.Subscribe()
	if subscriber == nil {
		t.Fatal("Expected subscriber to be non-nil")
	}
	if len(notifier.Subscribers) != 1 {
		t.Fatalf("Expected 1 subscriber, got %d", len(notifier.Subscribers))
	}
}

// TestPublish verifies notifications reach registered subscribers.
func TestPublish(t *testing.T) {
	notifier := NewNotifier()
	subscriber := notifier.Subscribe()

	response := proto.CartographerResponse{
		Msg: []string{"test"},
	}
	go notifier.Publish(&response)

	select {
	case res := <-subscriber.Channel:
		if _, ok := res.(*proto.CartographerResponse); !ok {
			t.Fatalf("Expected response to be of type *proto.CartographerResponse, got %T", res)
		}
		if res.(*proto.CartographerResponse).Msg[0] != "test" {
			t.Fatalf("Expected response to contain 'test', got %s", res.(*proto.CartographerResponse).Msg[0])
		}
	case <-time.After(time.Second):
		t.Fatal("Expected to receive a response, but timed out")
	}
}

// TestUnsubscribe verifies cancellation removes a subscriber before returning.
func TestUnsubscribe(t *testing.T) {
	notifier := NewNotifier()
	subscriber := notifier.Subscribe()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		notifier.Unsubscribe(ctx, subscriber.Id)
		close(done)
	}()

	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Expected unsubscribe to complete, but timed out")
	}

	notifier.mu.RLock()
	if _, ok := notifier.Subscribers[subscriber.Id]; ok {
		notifier.mu.RUnlock()
		t.Fatalf("Expected subscriber to be removed, but still exists")
	}
	notifier.mu.RUnlock()
}
