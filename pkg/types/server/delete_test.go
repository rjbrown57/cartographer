package server

import (
	"context"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

// TestDelete validates delete behavior for successful deletes, invalid namespaces, and partial backend failures.
func TestDelete(t *testing.T) {
	tests := []struct {
		name             string
		setup            func(t *testing.T) (namespace string, existingID string)
		request          *proto.CartographerDeleteRequest
		expectError      bool
		expectNilResp    bool
		expectedDeleted  []string
		expectedErrCount int
		verifyDeletedID  string
	}{
		{
			name: "deletes id from cache and backend",
			setup: func(t *testing.T) (string, string) {
				t.Helper()

				namespace := "delete-test-success"
				id := "delete-test-success-id"

				_, err := testServer.Add(context.Background(), &proto.CartographerAddRequest{
					Request: &proto.CartographerRequest{
						Namespace: namespace,
						Links: []*proto.Link{
							{
								Id:          id,
								Url:         "https://example.com/delete-success",
								Description: "delete success test",
								Tags:        []string{"delete", "server"},
							},
						},
					},
				})
				if err != nil {
					t.Fatalf("setup add failed: %v", err)
				}

				t.Cleanup(func() {
					_, _ = testServer.Delete(context.Background(), &proto.CartographerDeleteRequest{
						Namespace: namespace,
						Ids:       []string{id},
					})
				})

				return namespace, id
			},
			request: &proto.CartographerDeleteRequest{
				Namespace: "delete-test-success",
				Ids:       []string{"delete-test-success-id"},
			},
			expectError:      false,
			expectNilResp:    false,
			expectedDeleted:  []string{"delete-test-success-id"},
			expectedErrCount: 0,
			verifyDeletedID:  "delete-test-success-id",
		},
		{
			name: "returns error for invalid namespace",
			setup: func(t *testing.T) (string, string) {
				t.Helper()
				return "", ""
			},
			request: &proto.CartographerDeleteRequest{
				Namespace: "INVALID_NAMESPACE",
				Ids:       []string{"delete-invalid-id"},
			},
			expectError:      true,
			expectNilResp:    true,
			expectedDeleted:  nil,
			expectedErrCount: 0,
		},
		{
			name: "returns response with errors when some ids are missing",
			setup: func(t *testing.T) (string, string) {
				t.Helper()

				namespace := "delete-test-partial"
				id := "delete-test-partial-id"

				_, err := testServer.Add(context.Background(), &proto.CartographerAddRequest{
					Request: &proto.CartographerRequest{
						Namespace: namespace,
						Links: []*proto.Link{
							{
								Id:          id,
								Url:         "https://example.com/delete-partial",
								Description: "delete partial test",
								Tags:        []string{"delete", "partial"},
							},
						},
					},
				})
				if err != nil {
					t.Fatalf("setup add failed: %v", err)
				}

				t.Cleanup(func() {
					_, _ = testServer.Delete(context.Background(), &proto.CartographerDeleteRequest{
						Namespace: namespace,
						Ids:       []string{id},
					})
				})

				return namespace, id
			},
			request: &proto.CartographerDeleteRequest{
				Namespace: "delete-test-partial",
				Ids:       []string{"delete-test-partial-id", "delete-test-partial-missing-id"},
			},
			expectError:      true,
			expectNilResp:    false,
			expectedDeleted:  []string{"delete-test-partial-id"},
			expectedErrCount: 1,
			verifyDeletedID:  "delete-test-partial-id",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, _ = tc.setup(t)

			resp, err := testServer.Delete(context.Background(), tc.request)
			if tc.expectError {
				if err == nil {
					t.Fatal("expected delete error, got nil")
				}
			} else if err != nil {
				t.Fatalf("expected no delete error, got %v", err)
			}

			if tc.expectNilResp {
				if resp != nil {
					t.Fatalf("expected nil response, got %+v", resp)
				}
				return
			}

			if resp == nil {
				t.Fatal("expected non-nil delete response")
			}

			if len(resp.GetErrors()) != tc.expectedErrCount {
				t.Fatalf("expected %d response errors, got %d: %v", tc.expectedErrCount, len(resp.GetErrors()), resp.GetErrors())
			}

			if len(resp.GetIds()) != len(tc.expectedDeleted) {
				t.Fatalf("expected %d deleted ids, got %d: %v", len(tc.expectedDeleted), len(resp.GetIds()), resp.GetIds())
			}
			for _, wantID := range tc.expectedDeleted {
				if !containsString(resp.GetIds(), wantID) {
					t.Fatalf("expected deleted ids to include %q, got %v", wantID, resp.GetIds())
				}
			}

			if tc.verifyDeletedID == "" {
				return
			}

			testServer.mu.RLock()
			nsCache, ok := testServer.nsCache[tc.request.GetNamespace()]
			if ok {
				_, exists := nsCache.LinkCache[tc.verifyDeletedID]
				testServer.mu.RUnlock()
				if exists {
					t.Fatalf("expected id %q to be removed from cache namespace %q", tc.verifyDeletedID, tc.request.GetNamespace())
				}
			} else {
				testServer.mu.RUnlock()
			}

			backendResp := testServer.Backend.Get(backend.NewBackendRequest(tc.request.GetNamespace(), tc.verifyDeletedID))
			if backendResp == nil {
				t.Fatal("expected non-nil backend response")
			}
			if got := backendResp.Data[tc.verifyDeletedID]; got != nil {
				t.Fatalf("expected backend key %q to be deleted, got %v", tc.verifyDeletedID, got)
			}
		})
	}
}

// containsString reports whether the target value exists in the provided list.
func containsString(list []string, target string) bool {
	for _, item := range list {
		if item == target {
			return true
		}
	}
	return false
}
