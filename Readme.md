# Cartographer

Cartographer is a tool for teams to share urls and information for their environments.

~~* Use embedding of templates so we only have to distribute a single binary~~
* Finish a backup interface to backup current config
  * add bulk ingestions vi add and file

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

when channels close, streams close we need to make sure to remove subscriber from notifier struct

* How do we handle mistakes? E.g https://gitlab.com v htts:/gitlab.com these would create two map entries

* Run in a container, and test in k8s
* Update test generation functions to create a few groups, and a few tags as well
* Responses to add command should be better
* Find an icon set to use at a minimum to show the home icon next to the site name


* Update all tests and define what a full evaluation would be

# Need to think about how this should be done?

* Look into templating objects for the config / add clients to allow bulk ingestion
  * supply config files to the add command that will be iterated on 
* Finish /tags and /group all tag/group landing  pages so that properly display
  * Tags should show a description and count
  * Groups should show a description and all tags, count of links
