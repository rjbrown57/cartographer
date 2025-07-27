package backend

type BackendResponse struct {
	Data   map[string]any
	Errors []error
}

func NewBackendResponse() *BackendResponse {
	return &BackendResponse{
		Data:   make(map[string]any),
		Errors: make([]error, 0),
	}
}
