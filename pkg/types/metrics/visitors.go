package metrics

// visitorKey builds the de-duplication key for a visitor identifier/source pair.
func visitorKey(visitorID string, source string) (string, bool) {
	if visitorID == "" || source == "" {
		return "", false
	}

	return source + "|" + visitorID, true
}
