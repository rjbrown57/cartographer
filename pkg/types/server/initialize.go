package server

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

type legacyLinkRecord struct {
	URL         string `json:"url"`
	Displayname string `json:"displayname"`
	Description string `json:"description"`
}

// Initialize will load the data from the backend and merge it with the data from the config
func (c *CartographerServer) Initialize() error {

	log.Infof("Reading data from config %s", c.Options.ConfigFile)

	addRequests, err := c.GetBackendData()
	if err != nil {
		return err
	}

	// Add all backend collected notes.
	for _, r := range addRequests {
		log.Debugf("Populating Cache for Backend ns %s", r.Request.GetNamespace())
		for _, note := range r.Request.GetNotes() {
			c.AddToCache(note, r.Request.GetNamespace())
			metrics.Metrics().IncrementObjectCount("note", r.Request.GetNamespace(), 1)
		}
	}

	// Last we add the configured notes by namespace.
	log.Debugf("Populating %s configured data", c.Options.ConfigFile)
	namespaces := c.config.GetNamespaces()
	for _, ns := range namespaces {
		_, err = c.Add(context.Background(), &proto.CartographerAddRequest{
			Request: &proto.CartographerRequest{
				Notes:     c.config.NotesByNamespace[ns],
				Namespace: ns,
			},
		})
		if err != nil {
			return err
		}
	}

	//todo: fix this to be an accurate number
	log.Infof("Loaded %d notes", len(c.config.Notes))

	return err
}

// GetBackendData will query the backend and return a list of AddReqeusts for all namespaces
func (c *CartographerServer) GetBackendData() ([]*proto.CartographerAddRequest, error) {

	addRequests := make([]*proto.CartographerAddRequest, 0)

	// Data returned from GetNamespaces is map[nsname]nil
	for ns := range c.Backend.GetNamespaces().Data {
		// per ns we query for data to build Requests and append
		resp := c.Backend.Get(&backend.BackendRequest{
			Namespace: ns,
		})

		addRequest := &proto.CartographerAddRequest{
			Request: &proto.CartographerRequest{
				Namespace: ns,
			},
		}

		for _, value := range resp.Data {
			if len(value) == 0 {
				continue
			}

			note, err := decodeBackendNote(value)
			if err != nil {
				continue
			}

			if note.GetKey() != "" {
				addRequest.Request.Notes = append(addRequest.Request.Notes, note)
			}
		}

		addRequests = append(addRequests, addRequest)

	}

	return addRequests, nil
}

// decodeBackendNote decodes canonical notes and normalizes legacy link records.
func decodeBackendNote(value []byte) (*proto.Note, error) {
	note := &proto.Note{}
	if err := json.Unmarshal(value, note); err != nil {
		return nil, err
	}

	legacy := legacyLinkRecord{}
	if err := json.Unmarshal(value, &legacy); err == nil {
		if note.Title == "" {
			note.Title = legacy.Displayname
		}
		if note.Body == "" {
			switch {
			case legacy.URL != "" && legacy.Description != "":
				note.Body = fmt.Sprintf("%s\n\n%s", legacy.URL, legacy.Description)
			case legacy.Description != "":
				note.Body = legacy.Description
			case legacy.URL != "":
				note.Body = legacy.URL
			}
		}
	}

	if note.Title == "" && note.Url != "" {
		note.SetTitle()
	}
	if note.Body == "" && note.Url != "" {
		note.Body = note.Url
	}

	return note, nil
}
