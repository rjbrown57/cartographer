package proto

func NewProtoGroup(groupName string, tags []string, description string) *Group {
	g := Group{Name: groupName, Tags: tags, Description: description}
	return &g
}
