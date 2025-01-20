package notifier

import (
	"context"
	"log"
)

/* this implemenation should move to it's own package outisde of the backend implementation */

type Notifier struct {
	Subscribers map[int]*Subscriber
}

type Subscriber struct {
	Id      int
	Channel chan interface{}
}

func NewNotifier() *Notifier {
	return &Notifier{
		Subscribers: make(map[int]*Subscriber),
	}
}

func (n *Notifier) Subscribe() *Subscriber {
	s := &Subscriber{Id: len(n.Subscribers), Channel: make(chan interface{})}
	log.Printf("Add Subscriber %d to notifications", s.Id)
	n.Subscribers[s.Id] = s
	return s
}

// Publish to all known channels
func (n *Notifier) Publish(pr interface{}) {
	// Update to only publish to type matched channels
	for _, s := range n.Subscribers {
		s.Channel <- pr
	}
}

func (n *Notifier) Unsubscribe(ctx context.Context, Id int) {
	// Block until done
	_ = <-ctx.Done()
	log.Printf("Unsubscribe %d", Id)
	close(n.Subscribers[Id].Channel)
	delete(n.Subscribers, Id)
}
