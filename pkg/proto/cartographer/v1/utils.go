package proto

// New ProtoLink is a constructor for proto.Link
func NewProtoLink(link string, description string, displayName string, tags []string) *Link {

	l := Link{Url: link, Description: description, Displayname: displayName, Tags: tags}

	if displayName == "" {
		l.Displayname = link
	}

	return &l
}

func NewProtoGroup(groupName string, tags []*Tag, description string) *Group {
	g := Group{Name: groupName, Tags: make([]string, 0), Description: description}
	return &g
}

func NewProtoTag(tagName, description string) *Tag {
	t := Tag{Name: tagName}
	return &t
}

func NewProtoCartographerRequest(links, tags, groups []string, requestType RequestType) *CartographerRequest {
	newlinks := make([]*Link, 0)
	for _, link := range links {
		newlinks = append(newlinks, NewProtoLink(link, "", "", tags))
	}

	newTags := make([]*Tag, 0)
	for _, tag := range tags {
		newTags = append(newTags, NewProtoTag(tag, ""))
	}

	newGroups := make([]*Group, 0)
	for _, group := range groups {
		newGroups = append(newGroups, NewProtoGroup(group, newTags, ""))
	}

	r := CartographerRequest{
		Tags:   newTags,
		Links:  newlinks,
		Groups: newGroups,
		Type:   requestType,
	}

	return &r
}
