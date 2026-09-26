package backend

import (
	"archive/tar"
	"bytes"
	"errors"
	"testing"
)

// testTar builds envelopes that exercise validation independently of database semantics.
func testTar(t *testing.T, names []string, values []string, kind byte) []byte {
	t.Helper()
	var out bytes.Buffer
	tw := tar.NewWriter(&out)
	for i, name := range names {
		data := []byte(values[i])
		if kind != tar.TypeReg {
			data = nil
		}
		if err := tw.WriteHeader(&tar.Header{Name: name, Size: int64(len(data)), Typeflag: kind, Linkname: "/tmp/target"}); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

// TestReadArchiveRejectsMalformedFiles covers unsupported versions and unsafe archive entries.
func TestReadArchiveRejectsMalformedFiles(t *testing.T) {
	goodManifest := `{"format":"cartographer","version":1}`
	cases := map[string][]byte{
		"empty":            nil,
		"garbage":          []byte("not a tar"),
		"missing manifest": testTar(t, []string{"database.json"}, []string{`{"buckets":[]}`}, tar.TypeReg),
		"bad version":      testTar(t, []string{"manifest.json", "database.json"}, []string{`{"format":"cartographer","version":2}`, `{"buckets":[]}`}, tar.TypeReg),
		"duplicate":        testTar(t, []string{"manifest.json", "manifest.json"}, []string{goodManifest, goodManifest}, tar.TypeReg),
		"traversal":        testTar(t, []string{"../database.json"}, []string{"{}"}, tar.TypeReg),
		"symlink":          testTar(t, []string{"database.json"}, []string{""}, tar.TypeSymlink),
		"invalid json":     testTar(t, []string{"manifest.json", "database.json"}, []string{goodManifest, "{"}, tar.TypeReg),
	}
	var valid bytes.Buffer
	if err := WriteArchive(&valid, &Snapshot{}); err != nil {
		t.Fatal(err)
	}
	cases["truncated"] = valid.Bytes()[:600]
	cases["missing end markers"] = valid.Bytes()[:len(valid.Bytes())-1024]
	corrupted := bytes.Clone(valid.Bytes())
	at := bytes.Index(corrupted, []byte(`"buckets"`))
	if at < 0 {
		t.Fatal("missing database payload")
	}
	corrupted[at+1] = 'B'
	cases["checksum mismatch"] = corrupted
	cases["trailing content"] = append(bytes.Clone(valid.Bytes()), []byte("hidden")...)
	for name, data := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := ReadArchive(bytes.NewReader(data)); !errors.Is(err, ErrInvalidArchive) {
				t.Fatalf("expected invalid archive, got %v", err)
			}
		})
	}
}
