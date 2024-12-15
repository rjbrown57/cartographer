package data

type Tag struct {
	Name  string
	Links []*Link
}

func NewTag(name string) *Tag {
	return &Tag{
		Name: name,
	}
}
