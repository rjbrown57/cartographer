# Cartographer

Cartographer is a tool for teams to share urls and information for their environments.

* Experiment with grpc streams that the webui can use to keep an updated list of links and tags / groups
* Stream design
  * Has a numeric tracking id?
  * Have to create a simple pub-sub setup to make sure all watchers are notified.
  * Notification channel is setup in the backend that can be sent to via add/delete
  * Streams are watching this channel and 

Stream design - 

What would someone want to know about?

Add/Remove Tags
Add/Remove Links
Add/Remove Groups

Add/Remove link from a specific tag
Add/Remove tag from a specific group

backend implements a notification channel, it will publish a message on add/delete operation that will cause streams to push new data. This needs to honor the backend abstraction. Which I think it will :).

The web-ui backend opens a stream that updates it's headers. The heads are supplied to templating functions. This will allow us to populate a nice bar of groups/tags across the top that is always up to date.

when channels close, streams close we need to make sure to remove subscriber from notifier struct.

This will require real usage of contexts :)
