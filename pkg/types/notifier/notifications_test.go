package notifier

import (
	"context"
	"testing"
	"time"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func TestNewNotifier(t *testing.T) {
	notifier := NewNotifier()
	if notifier == nil {
		t.Fatal("Expected notifier to be non-nil")
	}
	if len(notifier.Subscribers) != 0 {
		t.Fatalf("Expected no subscribers, got %d", len(notifier.Subscribers))
	}
}

func TestSubscribe(t *testing.T) {
	notifier := NewNotifier()
	requestType := proto.RequestType_DATA
	subscriber := notifier.Subscribe(requestType)
	if subscriber == nil {
		t.Fatal("Expected subscriber to be non-nil")
	}
	if subscriber.RequestType != requestType {
		t.Fatalf("Expected request type %v, got %v", requestType, subscriber.RequestType)
	}
	if len(notifier.Subscribers) != 1 {
		t.Fatalf("Expected 1 subscriber, got %d", len(notifier.Subscribers))
	}
}

func TestPublish(t *testing.T) {
	notifier := NewNotifier()
	requestType := proto.RequestType_DATA
	subscriber := notifier.Subscribe(requestType)

	response := proto.CartographerResponse{Type: requestType}
	go notifier.Publish(response)

	select {
	case res := <-subscriber.Channel:
		if res.Type != requestType {
			t.Fatalf("Expected response type %v, got %v", requestType, res.Type)
		}
	case <-time.After(time.Second):
		t.Fatal("Expected to receive a response, but timed out")
	}
}

func TestUnsubscribe(t *testing.T) {
	notifier := NewNotifier()
	requestType := proto.RequestType_DATA
	subscriber := notifier.Subscribe(requestType)

	ctx, cancel := context.WithCancel(context.Background())
	go notifier.Unsubscribe(ctx, subscriber.Id)

	cancel()
	time.Sleep(time.Millisecond * 100) // Give some time for unsubscribe to process

	if _, ok := notifier.Subscribers[subscriber.Id]; ok {
		t.Fatalf("Expected subscriber to be removed, but still exists")
	}
}
