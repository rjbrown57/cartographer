package inmemory

// Clear removes all data from the backend
func (b *InMemoryBackend) Clear() {
	b.Data.Clear()
}
