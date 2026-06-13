#!/bin/bash
set -e

CONFIG="/etc/velociraptor/server.config.yaml"
BINARY="/opt/velociraptor"

# 1. If config doesn't exist, generate a fresh one
if [ ! -f "$CONFIG" ]; then
    echo "Generating fresh Velociraptor config..."
    $BINARY config generate > "$CONFIG"
    
    # 2. Automatically patch the config for Docker environment
    echo "Patching config for Docker (0.0.0.0 and persistent paths)..."
    
    # Set bind addresses to 0.0.0.0 so we can access from host
    sed -i 's/bind_address: 127.0.0.1/bind_address: 0.0.0.0/g' "$CONFIG"
    
    # Set Datastore to the persistent volume path used by both Velociraptor and Filebeat
    sed -i 's|location: /var/tmp/velociraptor|location: /velociraptor|g' "$CONFIG"
    sed -i 's|filestore_directory: /var/tmp/velociraptor|filestore_directory: /velociraptor|g' "$CONFIG"
fi

# 3. Add the admin user from environment variables
if [ ! -z "$VR_ADMIN_USER" ] && [ ! -z "$VR_ADMIN_PASSWORD" ]; then
    echo "Ensuring admin user '$VR_ADMIN_USER' exists..."
    $BINARY --config "$CONFIG" user add "$VR_ADMIN_USER" "$VR_ADMIN_PASSWORD" --role administrator || echo "User already exists."
fi

# 4. Start Velociraptor
echo "Starting Velociraptor Frontend..."
exec $BINARY --config "$CONFIG" frontend -v
