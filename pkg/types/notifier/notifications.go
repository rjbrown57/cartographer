package notifier

import (
	"context"
	"sync"

	"github.com/rjbrown57/cartographer/pkg/log"
)

/* this implemenation should move to it's own package outisde of the backend implementation */

type Notifier struct {
	Subscribers map[int]*Subscriber
	mu          sync.RWMutex
}

type Subscriber struct {
	Id      int
	Channel chan any
}

// NewNotifier constructs an empty, concurrency-safe subscriber registry.
func NewNotifier() *Notifier {
	return &Notifier{
		Subscribers: make(map[int]*Subscriber),
	}
}

// Subscribe registers and returns a new notification subscriber.
func (n *Notifier) Subscribe() *Subscriber {
	n.mu.Lock()
	defer n.mu.Unlock()

	s := &Subscriber{Id: len(n.Subscribers), Channel: make(chan any)}
	log.Infof("Add Subscriber %d to notifications", s.Id)
	n.Subscribers[s.Id] = s
	return s
}

// Publish sends a notification to all currently registered subscribers.
func (n *Notifier) Publish(pr any) {
	n.mu.RLock()
	defer n.mu.RUnlock()

	// Update to only publish to type matched channels
	for _, s := range n.Subscribers {
		s.Channel <- pr
	}
}

// Unsubscribe waits for cancellation before safely removing and closing a subscriber.
func (n *Notifier) Unsubscribe(ctx context.Context, Id int) {
	// Block until done
	<-ctx.Done()

	n.mu.Lock()
	defer n.mu.Unlock()

	log.Infof("Unsubscribe %d", Id)
	if subscriber, ok := n.Subscribers[Id]; ok {
		close(subscriber.Channel)
	}
	delete(n.Subscribers, Id)
}
