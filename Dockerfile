FROM ubuntu
COPY cartographer /usr/local/bin/cartographer
ENTRYPOINT ["/usr/local/bin/cartographer"]
