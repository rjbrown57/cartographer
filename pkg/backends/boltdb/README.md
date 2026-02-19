# BoltDB Backend

This backend stores Cartographer records in a single bbolt database file (path supplied via `BoltDBBackendOptions.Path`). All payloads are JSON-serialized before being written.

## Layout

- `meta` bucket: holds backend bookkeeping keys `schema`, `createdDate`, and `updatedDate`.
- `data_store` bucket: holds namespace buckets (`default`, `prod`, etc.).
- `data_store/<namespace>` bucket: holds application data, keyed by resource ID (link ID, tag ID, etc.) with JSON bytes as the value.

```mermaid
flowchart TB
    db[(cartographer.bbolt)]
    db --> meta["Bucket: meta"]
    db --> data["Bucket: data_store"]
    meta --> schema["Key: schema Value: 0.0.0"]
    meta --> created["Key: createdDate Value: RFC3339 timestamp"]
    meta --> updated["Key: updatedDate Value: RFC3339 timestamp"]
    data --> ns1["Bucket: default"]
    data --> ns2["Bucket: prod"]
    ns1 --> key1["Value: JSON blob"]
    ns2 --> keyN["Value: JSON blob"]
```

## Notes

- `Add` marshals incoming data to JSON and writes each `key -> []byte` entry into `data_store/<namespace>`.
- `Get` reads keys from `data_store/<namespace>` and returns `nil` for missing keys or missing namespaces.
- `GetNamespaces` returns namespace bucket names from `data_store`.
- `GetAllValues` reads raw bytes recursively across all namespaces; callers are responsible for deserializing to concrete types.
- `Delete` removes specific keys from `data_store/<namespace>`; errors are returned per ID if missing.
- `Clear` drops the `data_store` bucket; metadata is left intact.
