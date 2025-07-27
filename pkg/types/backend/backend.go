package backend

type Backend interface {
	Add(r *BackendAddRequest) *BackendResponse
	Delete(r *BackendRequest) *BackendResponse
	Get(r *BackendRequest) *BackendResponse
	GetKeys() *BackendResponse
	GetAllValues() *BackendResponse
	Close() error
}
