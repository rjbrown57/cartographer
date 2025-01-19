package notifier

import (
	"context"
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

/* this implemenation should move to it's own package outisde of the backend implementation */

type Notifier struct {
	Subscribers map[int]*Subscriber
}

type Subscriber struct {
	Id          int
	Channel     chan proto.CartographerResponse
	RequestType proto.RequestType
}

func NewNotifier() *Notifier {
	return &Notifier{
		Subscribers: make(map[int]*Subscriber),
	}
}

func (n *Notifier) Subscribe(requestType proto.RequestType) *Subscriber {
	s := &Subscriber{Id: len(n.Subscribers), Channel: make(chan proto.CartographerResponse), RequestType: requestType}
	log.Printf("Add Subscriber for %s to notifications %d", requestType, s.Id)
	n.Subscribers[s.Id] = s
	return s
}

// Publish to all known channels
func (n *Notifier) Publish(pr proto.CartographerResponse) {
	// Update to only publish to type matched channels
	for _, s := range n.Subscribers {
		if s.RequestType == pr.Type {
			s.Channel <- pr
		}

	}
}

func (n *Notifier) Unsubscribe(ctx context.Context, Id int) {
	// Block until done
	_ = <-ctx.Done()
	log.Printf("Unsubscribe %d", Id)
	close(n.Subscribers[Id].Channel)
	delete(n.Subscribers, Id)
}
