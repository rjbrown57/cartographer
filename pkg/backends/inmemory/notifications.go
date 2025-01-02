package inmemory

import (
	"log"

	"github.com/rjbrown57/cartographer/pkg/proto"
)

type Notifier struct {
	Subscribers []*Subscriber
}

type Subscriber struct {
	Id          int
	Channel     chan proto.CartographerResponse
	RequestType proto.RequestType
}

func NewNotifier() *Notifier {
	return &Notifier{
		Subscribers: make([]*Subscriber, 0),
	}
}

func (n *Notifier) Subscribe(requestType proto.RequestType) *Subscriber {
	s := &Subscriber{Id: len(n.Subscribers), Channel: make(chan proto.CartographerResponse), RequestType: requestType}
	log.Printf("Add Subscriber for %s to notifications %d", requestType, s.Id)
	n.Subscribers = append(n.Subscribers, s)
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

func (n *Notifier) Unsubscribe(Id int) {
	for i, s := range n.Subscribers {
		if s.Id == Id {
			close(s.Channel)
			n.Subscribers = append(n.Subscribers[:i], n.Subscribers[i+1:]...)
			return
		}
	}
}
