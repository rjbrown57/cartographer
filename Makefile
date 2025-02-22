all: buf build
run: buf build serve

tools:
	@echo "Installing tools..."
	@go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	@go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	@go install github.com/bufbuild/buf/cmd/buf@latest
	@go install github.com/goreleaser/goreleaser@latest

buf:
	@echo "Generating buf..."
	@cd ./proto && buf generate && cd ../

build:
	@echo "npx tsc"
	@cd web && npx tsc && cd ../
	@echo "Running go build"
	@go build

bs: build serve

snapshot:
	@echo "Building..."
	@goreleaser release --snapshot --clean

serve:
	@cartographer serve -c example

pprof:
	@cartographer serve -c example -p
