package server

import (
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func TestSearch(t *testing.T) {

	tests := []struct {
		name        string
		request     *proto.CartographerGetRequest
		expectError bool
		expectedURL map[string]struct{}
		expectedLen int
		options     *SearchOptions
	}{
		{
			name: "Search for OCI tag",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Terms: []string{"oci"},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{"https://github.com/goharbor/harbor": {}},
			expectedLen: 1,
			options:     &SearchOptions{Limit: SearchLimitTags},
		},
		{
			name: "Search for k8s term",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Terms: []string{"k8s"},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{
				"https://github.com/goharbor/harbor":        {},
				"https://github.com/kubernetes/kubernetes":  {},
				"https://github.com/rjbrown57/binman":       {},
				"https://github.com/rjbrown57/cartographer": {},
			},
			expectedLen: 4,
			options:     &SearchOptions{Limit: SearchLimitAll},
		},
		{
			name: "Search for k8s tag",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Tags: []*proto.Tag{
						{
							Name: "k8s",
						},
					},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{
				"https://github.com/goharbor/harbor":        {},
				"https://github.com/kubernetes/kubernetes":  {},
				"https://github.com/rjbrown57/binman":       {},
				"https://github.com/rjbrown57/cartographer": {},
			},
			expectedLen: 4,
			options:     &SearchOptions{Limit: SearchLimitTags},
		},
		{
			name: "Search for Cartographer by name in url",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Terms: []string{"cartographer"},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{"https://github.com/rjbrown57/cartographer": {}},
			expectedLen: 1,
			options:     &SearchOptions{Limit: SearchLimitURL},
		},
		{
			name: "Search for multiple terms",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Terms: []string{"oci", "k8s"},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{"https://github.com/goharbor/harbor": {}},
			expectedLen: 1,
			options:     &SearchOptions{Limit: SearchLimitTags},
		},
		{
			name: "Search for github.com",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Terms: []string{"github.com"},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{
				"https://github.com/goharbor/harbor":        {},
				"https://github.com/kubernetes/kubernetes":  {},
				"https://github.com/rjbrown57/binman":       {},
				"https://github.com/rjbrown57/cartographer": {},
			},
			expectedLen: 4,
			options:     &SearchOptions{Limit: SearchLimitURL},
		},
		{
			name: "Search for description match term",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Terms: []string{"descriptionmatchterm"},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{
				"https://github.com/kubernetes/kubernetes": {},
			},
			expectedLen: 1,
			options:     &SearchOptions{Limit: SearchLimitDescription},
		},
		{
			name: "Search for data match term",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Terms: []string{"datamatchterm"},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{
				"dataexample": {},
			},
			expectedLen: 1,
			options:     &SearchOptions{Limit: SearchLimitAll},
		},
		{
			name: "Search for non-existent term",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Terms: []string{"nonexistent"},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{},
			expectedLen: 0,
			options:     &SearchOptions{Limit: SearchLimitAll},
		},
		{
			name: "Search with tag but limited to description",
			request: &proto.CartographerGetRequest{
				Request: &proto.CartographerRequest{
					Tags: []*proto.Tag{
						{
							Name: "k8s",
						},
					},
				},
			},
			expectError: false,
			expectedURL: map[string]struct{}{},
			expectedLen: 0,
			options:     &SearchOptions{Limit: SearchLimitDescription},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			links, err := testServer.Search(tt.request, tt.options)

			if tt.expectError && err == nil {
				t.Errorf("%s Expected error but got none", tt.name)
				return
			}

			if !tt.expectError && err != nil {
				t.Errorf("%s Expected no error but got: %v", tt.name, err)
				return
			}

			if tt.expectError {
				return // Test passed if we expected an error and got one
			}

			if len(links) != tt.expectedLen {
				t.Errorf("%s Expected %d links, got %d", tt.name, tt.expectedLen, len(links))
				return
			}

			for _, link := range links {

				if _, ok := tt.expectedURL[link.GetKey()]; !ok {
					t.Errorf("%s Expected to find URL %s, but it was not in results. Got: %v", tt.name, link.GetKey(), links)
				}
			}
		})
	}
}

// TestSearchNamespacesWithSharedKey verifies identical link keys in different namespaces do not collide in bleve.
func TestSearchNamespacesWithSharedKey(t *testing.T) {
	const sharedKey = "https://example.com/shared"
	const namespaceA = "search-shared-a"
	const namespaceB = "search-shared-b"
	const termA = "namespace-a-only-term"
	const termB = "namespace-b-only-term"

	linkA := &proto.Link{
		Id:          sharedKey,
		Url:         "https://example.com/a",
		Description: termA,
	}

	linkB := &proto.Link{
		Id:          sharedKey,
		Url:         "https://example.com/b",
		Description: termB,
	}

	testServer.AddToCache(linkA, namespaceA)
	testServer.AddToCache(linkB, namespaceB)

	t.Cleanup(func() {
		testServer.DeleteFromCache(namespaceA, sharedKey)
		testServer.DeleteFromCache(namespaceB, sharedKey)

		testServer.mu.Lock()
		delete(testServer.nsCache, namespaceA)
		delete(testServer.nsCache, namespaceB)
		testServer.mu.Unlock()
	})

	searchA := &proto.CartographerGetRequest{
		Request: &proto.CartographerRequest{
			Namespace: namespaceA,
			Terms:     []string{termA},
		},
	}

	resultsA, err := testServer.Search(searchA, &SearchOptions{Limit: SearchLimitDescription})
	if err != nil {
		t.Fatalf("expected no error searching namespace A, got %v", err)
	}

	if len(resultsA) != 1 {
		t.Fatalf("expected 1 result for namespace A, got %d", len(resultsA))
	}

	if got := resultsA[0].GetDescription(); got != termA {
		t.Fatalf("expected namespace A description %q, got %q", termA, got)
	}

	searchB := &proto.CartographerGetRequest{
		Request: &proto.CartographerRequest{
			Namespace: namespaceB,
			Terms:     []string{termB},
		},
	}

	resultsB, err := testServer.Search(searchB, &SearchOptions{Limit: SearchLimitDescription})
	if err != nil {
		t.Fatalf("expected no error searching namespace B, got %v", err)
	}

	if len(resultsB) != 1 {
		t.Fatalf("expected 1 result for namespace B, got %d", len(resultsB))
	}

	if got := resultsB[0].GetDescription(); got != termB {
		t.Fatalf("expected namespace B description %q, got %q", termB, got)
	}

	testServer.DeleteFromCache(namespaceA, sharedKey)

	resultsBAfterDelete, err := testServer.Search(searchB, &SearchOptions{Limit: SearchLimitDescription})
	if err != nil {
		t.Fatalf("expected no error searching namespace B after namespace A delete, got %v", err)
	}

	if len(resultsBAfterDelete) != 1 {
		t.Fatalf("expected 1 namespace B result after namespace A delete, got %d", len(resultsBAfterDelete))
	}

	if got := resultsBAfterDelete[0].GetDescription(); got != termB {
		t.Fatalf("expected namespace B description %q after namespace A delete, got %q", termB, got)
	}
}
