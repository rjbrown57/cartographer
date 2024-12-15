package inmemory

import "errors"

var (
	ErrNoChanges = errors.New("request contains no changes")
	ErrGetFailed = errors.New("no matching links found")
)
