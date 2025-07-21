package proto

func NewProtoGroup(groupName string, tags []string, description string) *Group {
	g := Group{Name: groupName, Tags: tags, Description: description}
	return &g
}

func NewProtoTag(tagName, description string) *Tag {
	t := Tag{Name: tagName}
	return &t
}

func NewCartographerRequest(links, tags, groups []string) *CartographerRequest {
	newlinks := make([]*Link, 0)

	deDupMap := make(map[string]struct{})

	for _, link := range links {
		if _, ok := deDupMap[link]; !ok {
			newlinks = append(newlinks, NewLinkBuilder().
				WithURL(link).
				WithTags(tags).
				Build())
		}
		deDupMap[link] = struct{}{}
	}

	deDupMap = make(map[string]struct{})
	newGroups := make([]*Group, 0)
	for _, group := range groups {
		if _, ok := deDupMap[group]; !ok {
			newGroups = append(newGroups, NewProtoGroup(group, tags, ""))
		}
		deDupMap[group] = struct{}{}
	}

	r := CartographerRequest{
		Links:  newlinks,
		Groups: newGroups,
	}

	return &r
}

func GetRequestFromStream(c *CartographerStreamGetRequest) *CartographerGetRequest {
	return &CartographerGetRequest{
		Request: &CartographerRequest{
			Tags:   c.Request.GetTags(),
			Links:  c.Request.GetLinks(),
			Groups: c.Request.GetGroups(),
		},
		Type: c.Type,
	}
}

func NewCartographerGetRequest(links, tags, groups []string) *CartographerGetRequest {
	return &CartographerGetRequest{
		Request: NewCartographerRequest(links, tags, groups),
	}
}

func NewCartographerAddRequest(links, tags, groups []string) *CartographerAddRequest {
	return &CartographerAddRequest{
		Request: NewCartographerRequest(links, tags, groups),
	}
}

func NewCartographerDeleteRequest(links, tags, groups []string) *CartographerDeleteRequest {
	return &CartographerDeleteRequest{
		Request: NewCartographerRequest(links, tags, groups),
	}
}

func NewCartographerResponse() *CartographerResponse {
	return &CartographerResponse{}
}
