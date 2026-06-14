FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl jq openssl rsync && \
    curl -L -o /opt/velociraptor \
      https://github.com/Velocidex/velociraptor/releases/download/v0.73/velociraptor-v0.73.3-linux-amd64 && \
    chmod +x /opt/velociraptor && \
    apt-get purge -y curl && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /velociraptor /etc/velociraptor/data

# Copy the entrypoint script into the image
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000 8001 8889

# Set the script as the entrypoint
ENTRYPOINT ["/entrypoint.sh"]
