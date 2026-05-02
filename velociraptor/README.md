# Velociraptor Setup

Before starting the containers on the VM, generate the Velociraptor server config by running:

```bash
docker run --rm -v $(pwd)/velociraptor/config:/etc/velociraptor \
  wlambert/velociraptor /opt/velociraptor/linux/velociraptor config generate \
  > ./velociraptor/config/server.config.yaml
```

Then start the stack normally with `docker-compose up -d`.
