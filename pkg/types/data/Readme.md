# Types

Cartographer aggregates links. They can be access by Groups, or by Tags.

There is a default LinkGroup that is populated with all links regardless of tag

## Links

A link is the basic struct of cartographer. A link contains a url, and an optional list of tags the link is related to.

## Group

A group aggregates links by tags. It contains a name, a list of tags to aggregate, and then a reference to all related links

## Tag

A tag is an identifier that arranges links together. It can be viewed on it's own, or aggregated by a group