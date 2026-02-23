package server

import (
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// TestCacheOperations validates add and delete cache behavior against in-memory and search indexes.
func TestCacheOperations(t *testing.T) {
	tests := []struct {
		name              string
		namespace         string
		key               string
		term              string
		deleteAfterAdd    bool
		expectedSearchLen int
		expectInCache     bool
	}{
		{
			name:              "add keeps link in cache and searchable",
			namespace:         "cache-test-add",
			key:               "cache-test-add-id",
			term:              "cacheadduniqueterm",
			deleteAfterAdd:    false,
			expectedSearchLen: 1,
			expectInCache:     true,
		},
		{
			name:              "delete removes link from cache and search",
			namespace:         "cache-test-delete",
			key:               "cache-test-delete-id",
			term:              "cachedeleteuniqueterm",
			deleteAfterAdd:    true,
			expectedSearchLen: 0,
			expectInCache:     false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			link := &proto.Link{
				Id:          tc.key,
				Url:         "https://example.com/" + tc.key,
				Description: tc.term,
				Tags:        []string{"cache", "test"},
			}

			testServer.AddToCache(link, tc.namespace)
			t.Cleanup(func() {
				if !tc.deleteAfterAdd {
					testServer.DeleteFromCache(tc.namespace, tc.key)
				}
				testServer.mu.Lock()
				delete(testServer.nsCache, tc.namespace)
				testServer.mu.Unlock()
			})

			if tc.deleteAfterAdd {
				testServer.DeleteFromCache(tc.namespace, tc.key)
			}

			testServer.mu.RLock()
			cachedNS, ok := testServer.nsCache[tc.namespace]
			if !ok {
				testServer.mu.RUnlock()
				t.Fatalf("expected namespace %q in cache", tc.namespace)
			}
			cachedLink, exists := cachedNS.LinkCache[tc.key]
			testServer.mu.RUnlock()

			if tc.expectInCache {
				if !exists {
					t.Fatalf("expected link %q in namespace cache", tc.key)
				}
				if got := cachedLink.GetDescription(); got != tc.term {
					t.Fatalf("expected cached link description %q, got %q", tc.term, got)
				}
			} else if exists {
				t.Fatalf("expected link %q to be deleted from cache", tc.key)
			}

			results, err := testServer.Search(&proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Namespace: tc.namespace,
					Terms:     []string{tc.term},
				},
			}, &SearchOptions{Limit: SearchLimitDescription})
			if err != nil {
				t.Fatalf("expected no error from search, got %v", err)
			}
			if len(results) != tc.expectedSearchLen {
				t.Fatalf("expected %d search results, got %d", tc.expectedSearchLen, len(results))
			}
			if tc.expectedSearchLen == 1 {
				if got := results[0].GetKey(); got != tc.key {
					t.Fatalf("expected search result key %q, got %q", tc.key, got)
				}
			}
		})
	}
}
