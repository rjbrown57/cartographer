package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"reflect"
	"sync"
	"testing"

	"github.com/blevesearch/bleve"
	"github.com/rjbrown57/cartographer/pkg/backends/boltdb"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/pkg/types/notifier"
)

// newArchiveServer builds an isolated server without opening network listeners.
func newArchiveServer(t *testing.T) *CartographerServer {
	t.Helper()
	index, err := bleve.NewMemOnly(bleve.NewIndexMapping())
	if err != nil {
		t.Fatal(err)
	}
	c := &CartographerServer{Backend: boltdb.NewBoltDbBackend(&boltdb.BoltDBBackendOptions{Path: filepath.Join(t.TempDir(), "data.db")}), bleve: index, nsCache: make(NSCache), config: &config.CartographerConfig{}, Notifier: notifier.NewNotifier()}
	t.Cleanup(func() { _ = c.Backend.Close(); _ = c.bleve.Close() })
	return c
}

// archiveAdd stores a note using the normal metadata and cache path.
func archiveAdd(t *testing.T, c *CartographerServer, ns, id, body string) *proto.Note {
	t.Helper()
	resp, err := c.Add(context.Background(), &proto.CartographerAddRequest{Request: &proto.CartographerRequest{Namespace: ns, Notes: []*proto.Note{{Id: id, Title: id, Body: body, Tags: []string{body}}}}})
	if err != nil {
		t.Fatal(err)
	}
	return resp.Response.Notes[0]
}

// TestImportLiveState checks persistence, metadata, namespace/tag caches and search after both modes.
func TestImportLiveState(t *testing.T) {
	for _, mode := range []string{"replace", "merge"} {
		t.Run(mode, func(t *testing.T) {
			source, target := newArchiveServer(t), newArchiveServer(t)
			archived := archiveAdd(t, source, "default", "b", "archivedword")
			archiveAdd(t, source, "default", "c", "newword")
			archiveAdd(t, source, "cartographer-admin", "template/test", "templateword")
			current := archiveAdd(t, target, "default", "b", "currentword")
			archiveAdd(t, target, "oldnamespace", "a", "oldword")
			var archive bytes.Buffer
			if err := source.Export(&archive); err != nil {
				t.Fatal(err)
			}
			if _, err := target.Import(bytes.NewReader(archive.Bytes()), mode); err != nil {
				t.Fatal(err)
			}
			want := archived
			if mode == "merge" {
				want = current
			}
			got := target.nsCache.GetNotesByKey("default", []string{"b"})
			wantJSON, _ := json.Marshal(want)
			gotJSON, _ := json.Marshal(got[0])
			if !bytes.Equal(wantJSON, gotJSON) {
				t.Fatalf("metadata/content changed: got %s want %s", gotJSON, wantJSON)
			}
			if _, exists := target.nsCache["oldnamespace"]; exists != (mode == "merge") {
				t.Fatal("old namespace retention incorrect")
			}
			if len(target.nsCache.GetNotes("cartographer-admin")) != 1 {
				t.Fatal("template missing")
			}
			results, err := target.Search(&proto.CartographerGetRequest{Request: &proto.CartographerRequest{Namespace: "default", Terms: []string{want.Body}}}, &SearchOptions{Limit: SearchLimitBody})
			if err != nil || len(results) != 1 || results[0].Id != "b" {
				t.Fatalf("search does not reflect restore: %v %v", results, err)
			}
			absent := "currentword"
			if mode == "merge" {
				absent = "archivedword"
			}
			results, err = target.Search(&proto.CartographerGetRequest{Request: &proto.CartographerRequest{Namespace: "default", Terms: []string{absent}}}, &SearchOptions{Limit: SearchLimitBody})
			if err != nil || len(results) != 0 {
				t.Fatalf("stale search result: %v %v", results, err)
			}
			for _, tag := range target.nsCache.GetTags("default") {
				if tag == absent {
					t.Fatal("stale tag")
				}
			}
			persisted := target.Backend.Get(&backend.BackendRequest{Namespace: "default", Key: []string{"b"}})
			if !bytes.Equal(persisted.Data["b"], wantJSON) {
				t.Fatal("persisted metadata differs")
			}
			before, _ := target.Backend.(backend.ArchiveBackend).Snapshot()
			if _, err := target.Import(bytes.NewReader([]byte("broken")), mode); err == nil {
				t.Fatal("accepted invalid archive")
			}
			after, _ := target.Backend.(backend.ArchiveBackend).Snapshot()
			if !reflect.DeepEqual(before, after) {
				t.Fatal("invalid archive changed database")
			}
		})
	}
}

// TestImportConcurrentAccess checks merge serializes writes without racing cache/index readers.
func TestImportConcurrentAccess(t *testing.T) {
	source, target := newArchiveServer(t), newArchiveServer(t)
	archiveAdd(t, source, "default", "archived", "findme")
	var archive bytes.Buffer
	if err := source.Export(&archive); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 100)
	for worker := 0; worker < 3; worker++ {
		wg.Add(1)
		go func(worker int) {
			defer wg.Done()
			for i := 0; i < 10; i++ {
				var err error
				switch worker {
				case 0:
					_, err = target.Import(bytes.NewReader(archive.Bytes()), "merge")
				case 1:
					_, err = target.Add(context.Background(), &proto.CartographerAddRequest{Request: &proto.CartographerRequest{Namespace: "default", Notes: []*proto.Note{{Id: fmt.Sprintf("live-%d", i), Body: "findme"}}}})
				case 2:
					_, err = target.Get(context.Background(), &proto.CartographerGetRequest{Type: proto.RequestType_REQUEST_TYPE_DATA, Request: &proto.CartographerRequest{Namespace: "default", Terms: []string{"findme"}}})
				}
				if err != nil {
					errs <- err
				}
			}
		}(worker)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	if got := len(target.nsCache.GetNotes("default")); got != 11 {
		t.Fatalf("concurrent merge lost writes: got %d records", got)
	}
}

// TestImportEmptyDatabase confirms replace clears caches/indexes while merge leaves them intact.
func TestImportEmptyDatabase(t *testing.T) {
	for _, mode := range []string{"replace", "merge"} {
		t.Run(mode, func(t *testing.T) {
			source, target := newArchiveServer(t), newArchiveServer(t)
			archiveAdd(t, target, "default", "existing", "existingword")
			var archive bytes.Buffer
			if err := source.Export(&archive); err != nil {
				t.Fatal(err)
			}
			result, err := target.Import(&archive, mode)
			if err != nil {
				t.Fatal(err)
			}
			if result.Added != 0 || result.Skipped != 0 {
				t.Fatalf("unexpected counts: %+v", result)
			}
			count, err := target.bleve.DocCount()
			if err != nil {
				t.Fatal(err)
			}
			want := 0
			if mode == "merge" {
				want = 1
			}
			if len(target.nsCache) != want || count != uint64(want) {
				t.Fatal("empty import left incorrect live state")
			}
		})
	}
}

// TestImportRejectsInvalidDatabase verifies a valid tar cannot bypass schema and record validation.
func TestImportRejectsInvalidDatabase(t *testing.T) {
	source, target := newArchiveServer(t), newArchiveServer(t)
	archiveAdd(t, source, "default", "incoming", "incomingword")
	archiveAdd(t, target, "default", "existing", "existingword")
	before, _ := target.Backend.(backend.ArchiveBackend).Snapshot()
	cases := map[string]func(*backend.Snapshot){
		"unsupported schema": func(s *backend.Snapshot) {
			for i := range s.Buckets {
				if string(s.Buckets[i].Name) == "meta" {
					for j := range s.Buckets[i].Values {
						if string(s.Buckets[i].Values[j].Key) == "schema" {
							s.Buckets[i].Values[j].Value = []byte("future")
						}
					}
				}
			}
		},
		"invalid note": func(s *backend.Snapshot) {
			for i := range s.Buckets {
				if string(s.Buckets[i].Name) == "data_store" {
					s.Buckets[i].Buckets[0].Values[0].Value = []byte(`{"id":"mismatched-key"}`)
				}
			}
		},
		"duplicate bucket": func(s *backend.Snapshot) { s.Buckets = append(s.Buckets, s.Buckets[0]) },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			snapshot, err := source.Backend.(backend.ArchiveBackend).Snapshot()
			if err != nil {
				t.Fatal(err)
			}
			mutate(snapshot)
			var archive bytes.Buffer
			if err := backend.WriteArchive(&archive, snapshot); err != nil {
				t.Fatal(err)
			}
			for _, mode := range []string{"replace", "merge"} {
				if _, err := target.Import(bytes.NewReader(archive.Bytes()), mode); err == nil {
					t.Fatal("invalid database accepted")
				}
				after, _ := target.Backend.(backend.ArchiveBackend).Snapshot()
				if !reflect.DeepEqual(before, after) {
					t.Fatal("invalid database modified storage")
				}
				if len(target.nsCache.GetNotesByKey("default", []string{"existing"})) != 1 {
					t.Fatal("invalid database modified cache")
				}
				found, err := target.Search(&proto.CartographerGetRequest{Request: &proto.CartographerRequest{Namespace: "default", Terms: []string{"existingword"}}}, &SearchOptions{Limit: SearchLimitBody})
				if err != nil || len(found) != 1 {
					t.Fatal("invalid database modified index")
				}
			}
		})
	}
}
