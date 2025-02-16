package backend

type BackendResponse struct {
	Data   map[string]interface{}
	Errors []error
}

func NewBackendResponse() *BackendResponse {
	return &BackendResponse{
		Data: make(map[string]interface{}),
	}
}
