FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    curl -L -o /opt/velociraptor \
      https://github.com/Velocidex/velociraptor/releases/download/v0.73/velociraptor-v0.73.3-linux-amd64 && \
    chmod +x /opt/velociraptor && \
    apt-get purge -y curl && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /velociraptor /etc/velociraptor

EXPOSE 8000 8001 8889

ENTRYPOINT ["/opt/velociraptor"]
CMD ["frontend", "-v", "--config", "/etc/velociraptor/server.config.yaml"]
