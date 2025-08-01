package backend

type BackendResponse struct {
	Data   map[string][]byte
	Errors []error
}

func NewBackendResponse() *BackendResponse {
	return &BackendResponse{
		Data:   make(map[string][]byte),
		Errors: make([]error, 0),
	}
}
