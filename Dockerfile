FROM gcr.io/distroless/static-debian13:nonroot@sha256:f7f8f729987ad0fdf6b05eeeae94b26e6a0f613bdf46feea7fc40f7bd72953e6

COPY --chown=99999:99999 cartographer /usr/local/bin/cartographer

USER 99999:99999

ENTRYPOINT ["/usr/local/bin/cartographer"]
