package explorer

import (
	"context"
	"time"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
)

const (
	// ManagedByAnnotation identifies the controller responsible for a note.
	ManagedByAnnotation = "cartographer.io/managed-by"
	// ManagedByExplorer is the managed-by value applied by the explorer runner.
	ManagedByExplorer = "explorer"
	// SourceIDAnnotation identifies the specific explorer snapshot that owns a note.
	SourceIDAnnotation = "cartographer.io/source-id"
)

// Explorer discovers the complete desired note snapshot for one external source.
type Explorer interface {
	SourceID() string
	Namespace() string
	Discover(context.Context) ([]*proto.Note, error)
}

// CartographerClient is the subset of the generated client used for reconciliation.
type CartographerClient interface {
	Get(context.Context, *proto.CartographerGetRequest, ...grpc.CallOption) (*proto.CartographerGetResponse, error)
	Add(context.Context, *proto.CartographerAddRequest, ...grpc.CallOption) (*proto.CartographerAddResponse, error)
	Delete(context.Context, *proto.CartographerDeleteRequest, ...grpc.CallOption) (*proto.CartographerDeleteResponse, error)
}

// RunnerOptions configures discovery, reconciliation, and optional polling.
type RunnerOptions struct {
	Explorer         Explorer
	Client           CartographerClient
	Interval         time.Duration
	DiscoveryTimeout time.Duration
}

// ReconcileResult summarizes one successfully applied explorer snapshot.
type ReconcileResult struct {
	SourceID   string
	Namespace  string
	Discovered int
	Created    int
	Updated    int
	Unchanged  int
	Deleted    int
}
