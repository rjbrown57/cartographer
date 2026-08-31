# Explorer runtime contract

Explorers are external-source adapters. They discover an authoritative set of data and rely on the shared runner to reconcile that snapshot into one Cartographer namespace.

```text
External source
    -> Explorer.Discover
    -> Runner validation and reconciliation
    -> Cartographer gRPC Get/Add/Delete
    -> Backend, namespace cache, search index, and UI cards
```

Repository access, provider authentication, parsing, and source-specific filtering belong in the concrete explorer. Cartographer remains responsible for generic note storage, search, and rendering.

## Explorer contract

A runner-compatible explorer implements the interface in `pkg/types/explorer`:

```go
type Explorer interface {
	SourceID() string
	Namespace() string
	Discover(context.Context) ([]*proto.Note, error)
}
```
```

The methods have the following requirements:

- `SourceID` returns a stable, non-empty ownership identity without surrounding whitespace. Changing it creates a new ownership scope and leaves notes owned by the old source untouched.
- `Namespace` returns the target Cartographer namespace. An empty value resolves to `default`; any explicit value must satisfy the normal namespace validation rules.
- `Discover` returns the complete desired snapshot for that source, not an incremental change set.
- `Discover` must honor context cancellation and must not call Cartographer Add or Delete itself.
- Every returned note must be non-nil and have a stable, non-empty ID.
- Note IDs must be unique within the snapshot.
- An empty successful snapshot is authoritative and removes every note currently owned by that source.
- Source failures must be returned as errors rather than represented as an empty snapshot.

Explorer implementations should derive IDs from durable source-native identities. They should avoid timestamps, changing collection order, or other volatile values in note content because those values create unnecessary updates.

## Ownership contract

Before remote mutation, the runner clones each discovered note and applies:

```yaml
cartographer.io/managed-by: explorer
cartographer.io/source-id: <SourceID>
```

If an explorer supplies either annotation with a conflicting value, validation fails. Concrete explorers may add source-specific annotations, for example:

```yaml
cartographer.io/explorer: git
cartographer.io/source-path: guides/install.md
cartographer.io/blob-sha: abc123
```

If a discovered note has no `source` field, the runner sets it to `explorer:<SourceID>`.

The runner deletes only notes containing both the explorer `managed-by` value and the exact source ID. Manual notes, differently owned notes, and notes from other explorer instances are preserved even when they share a namespace.

A discovered ID that already belongs to an unowned or differently owned note is treated as a collision. The run fails before additions or deletions instead of overwriting that note.

## Reconciliation behavior

`Runner.RunOnce` performs one serialized reconciliation:

1. Validate the explorer identity.
2. Run discovery, optionally with a discovery timeout.
3. Clone and validate the complete snapshot.
4. Read all current notes in the target namespace.
5. Separate notes owned by the current source from all other notes.
6. Compare desired notes with stored notes.
7. Submit new and changed notes in one Add request.
8. Confirm the Add response acknowledges every submitted ID.
9. After a successful Add, delete stale owned IDs in one Delete request and confirm every deletion.

Notes are considered unchanged when ID, title, body, URL, unordered tags, annotations, and structured data match. Lifecycle metadata such as creation time, update time, author, source, and version does not by itself cause an update.

All snapshot validation occurs before remote mutation. Discovery, validation, Get, or Add failures prevent stale deletion and preserve the previous complete snapshot. Add and Delete are separate RPCs, so a Delete failure can leave new notes applied alongside stale notes until the next successful run.

The result reports discovered, created, updated, unchanged, and deleted counts.

## Running modes

Construct a Cartographer client, concrete explorer, and runner:

```go
runner, err := explorer.NewRunner(explorer.RunnerOptions{
	Explorer: concreteExplorer,
	Client: cartographerClient.Client,
	Interval: 5 * time.Minute,
	DiscoveryTimeout: 30 * time.Second,
})
if err != nil {
	return err
}

return runner.Run(ctx)
```

When `Interval` is zero, `Run` performs one reconciliation and returns its error. This mode is suitable for commands and Kubernetes CronJobs.

When `Interval` is positive, `Run` reconciles immediately and then on each tick. Individual reconciliation failures are logged and do not terminate polling. Cancelling the run context stops polling cleanly. A negative interval or discovery timeout is rejected when the runner is constructed.

Only one reconciliation may run through a runner instance at a time.

## Existing explorers

### Basic HTTP explorer

The basic explorer fetches one JSON endpoint and reconciles the parsed response as one note:

```bash
go run ./explorer/basic \
  --url https://restcountries.com/v3.1/name/deutschland \
  --namespace basicexplorer \
  --source-id countries-api
```

Add `--interval 5m` for polling. The default discovery timeout is 30 seconds. Cartographer connection defaults are `localhost:8080` and can be changed with `--address` and `--port`.

### Kubernetes explorer

The Kubernetes explorer reads nodes using in-cluster configuration or the current kubeconfig and stores their names in one note:

```bash
go run ./explorer/k8s \
  --namespace k8sexplorer \
  --source-id production-cluster \
  --interval 5m
```

The Kubernetes command handles `SIGINT` and `SIGTERM`, passes cancellation to discovery and gRPC calls, and closes its Cartographer client connection on exit.

## Implementing another explorer

A new explorer should:

1. Define options for its target, namespace, and source ID rather than hard-coding deployment identity.
2. Implement `SourceID`, `Namespace`, and `Discover`.
3. Use the discovery context for every external operation.
4. Build a complete deterministic note snapshot in memory.
5. Return an error if the source cannot be fully read or parsed.
6. Assign stable IDs and stable content metadata.
7. Add source-specific provenance annotations without setting conflicting runner ownership.
8. Keep Cartographer client calls out of `Discover`.
9. Expose one-shot and interval execution through the shared runner.
10. Test initial discovery, unchanged output, source updates, source deletion, cancellation, and source failure.

## Remaining implementation work

The shared runner and the basic and Kubernetes explorer migrations are implemented. The following work remains:

- Implement the Git documentation explorer described in [explorer-update.md](../explorer-update.md), including repository materialization, authentication, include/exclude rules, Markdown/frontmatter parsing, stable file IDs, blob-based change detection, and relative-link handling.
- Pass annotations into the TypeScript card and standalone note models, show explorer provenance, and hide edit/delete actions for managed notes.
- Decide whether managed-note mutation should also be enforced by the HTTP admin endpoints.
- Add explorer-specific Prometheus metrics and a last-run/status surface. The runner currently emits summary and failure logs only.
- Consider a server-side `ReconcileSnapshot` RPC if additions and stale deletions must be atomic.
- Add authenticated and authorized gRPC writes before treating explorers as mutually untrusted workloads.
- Consider an explicit empty-snapshot safeguard for sources where accidental empty discovery is more likely than intentional removal.

Until an atomic reconciliation RPC exists, explorer authors must preserve the contract that a partial or failed source read returns an error and never an empty successful snapshot.
