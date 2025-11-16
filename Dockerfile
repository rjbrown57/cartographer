FROM ubuntu

RUN groupadd -r cartographer -g 99999 && \
    useradd -r -u 99999 -g cartographer -s /bin/bash cartographer

COPY cartographer /usr/local/bin/cartographer
RUN chown cartographer:cartographer /usr/local/bin/cartographer && \
    chmod 755 /usr/local/bin/cartographer

USER cartographer

ENTRYPOINT ["/usr/local/bin/cartographer"]
