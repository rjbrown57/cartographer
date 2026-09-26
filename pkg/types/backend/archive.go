package backend

import (
	"archive/tar"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

const MaxArchiveBytes int64 = 256 << 20
const ArchiveVersion = 1

var ErrInvalidArchive = errors.New("invalid archive")

// ArchiveValue preserves arbitrary database keys and values using JSON base64 encoding.
type ArchiveValue struct {
	Key   []byte `json:"key"`
	Value []byte `json:"value"`
}

// ArchiveBucket preserves nested buckets, including empty buckets and sequence counters.
type ArchiveBucket struct {
	Name     []byte          `json:"name"`
	Sequence uint64          `json:"sequence"`
	Values   []ArchiveValue  `json:"values,omitempty"`
	Buckets  []ArchiveBucket `json:"buckets,omitempty"`
}

type Snapshot struct {
	Buckets []ArchiveBucket `json:"buckets"`
}

type ImportResult struct {
	Mode    string `json:"mode"`
	Added   int    `json:"added"`
	Skipped int    `json:"skipped"`
}

// ArchiveBackend stages a restore and prepares derived state before committing it.
// Prepare must not access the backend or publish state; an error rolls back the transaction.
type ArchiveBackend interface {
	Snapshot() (*Snapshot, error)
	Restore(*Snapshot, string, func(*Snapshot) error) (*ImportResult, error)
}

// ArchiveService connects HTTP handlers to the server's coordinated backup operations.
type ArchiveService interface {
	Export(io.Writer) error
	Import(io.Reader, string) (*ImportResult, error)
}

// WriteArchive writes a versioned logical database snapshot to an uncompressed tar.
func WriteArchive(w io.Writer, snapshot *Snapshot) error {
	data, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}
	manifest := []byte(fmt.Sprintf(`{"format":"cartographer","version":%d,"sha256":"%x"}`, ArchiveVersion, sha256.Sum256(data)))
	// Keep every produced archive within the corresponding import limit.
	if int64(len(data))+int64(len(manifest))+4096 > MaxArchiveBytes {
		return fmt.Errorf("archive exceeds %d byte limit", MaxArchiveBytes)
	}
	tw := tar.NewWriter(w)
	for _, entry := range []struct {
		name string
		data []byte
	}{{"manifest.json", manifest}, {"database.json", data}} {
		if err := tw.WriteHeader(&tar.Header{Name: entry.name, Mode: 0600, Size: int64(len(entry.data)), Typeflag: tar.TypeReg}); err != nil {
			return err
		}
		if _, err := tw.Write(entry.data); err != nil {
			return err
		}
	}
	return tw.Close()
}

// ReadArchive validates the envelope without extracting user-controlled filesystem paths.
func ReadArchive(r io.Reader) (*Snapshot, error) {
	limited := &io.LimitedReader{R: r, N: MaxArchiveBytes + 1}
	tr := tar.NewReader(limited)
	entries := map[string][]byte{}
	for {
		before := limited.N
		h, err := tr.Next()
		if err == io.EOF {
			if before-limited.N < 1024 {
				return nil, fmt.Errorf("%w: missing tar end markers", ErrInvalidArchive)
			}
			break
		}
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidArchive, err)
		}
		if (h.Name != "manifest.json" && h.Name != "database.json") || h.Typeflag != tar.TypeReg || h.Size < 0 || h.Size > MaxArchiveBytes {
			return nil, fmt.Errorf("%w: unexpected tar entry", ErrInvalidArchive)
		}
		if _, exists := entries[h.Name]; exists {
			return nil, fmt.Errorf("%w: duplicate tar entry", ErrInvalidArchive)
		}
		if h.Name == "manifest.json" && h.Size > 4096 {
			return nil, fmt.Errorf("%w: oversized manifest", ErrInvalidArchive)
		}
		data, err := io.ReadAll(tr)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidArchive, err)
		}
		entries[h.Name] = data
	}
	// Consume padding and reject hidden trailing content, including concatenated archives.
	tail := make([]byte, 4096)
	for {
		n, err := limited.Read(tail)
		for _, b := range tail[:n] {
			if b != 0 {
				return nil, fmt.Errorf("%w: trailing content", ErrInvalidArchive)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidArchive, err)
		}
	}
	if limited.N <= 0 {
		return nil, fmt.Errorf("%w: archive too large", ErrInvalidArchive)
	}
	var manifest struct {
		Format  string `json:"format"`
		Version int    `json:"version"`
		SHA256  string `json:"sha256"`
	}
	if err := json.Unmarshal(entries["manifest.json"], &manifest); err != nil || manifest.Format != "cartographer" || manifest.Version != ArchiveVersion {
		return nil, fmt.Errorf("%w: unsupported or missing manifest", ErrInvalidArchive)
	}
	if manifest.SHA256 != fmt.Sprintf("%x", sha256.Sum256(entries["database.json"])) {
		return nil, fmt.Errorf("%w: database checksum mismatch", ErrInvalidArchive)
	}
	var snapshot Snapshot
	if err := json.Unmarshal(entries["database.json"], &snapshot); err != nil {
		return nil, fmt.Errorf("%w: invalid database snapshot", ErrInvalidArchive)
	}
	return &snapshot, nil
}
