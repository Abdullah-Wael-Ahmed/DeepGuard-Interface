#!/bin/bash

echo "=========================================="
echo "    Applying Kali Infrastructure Fixes    "
echo "=========================================="

# Apply the fixed files from the kali_overrides folder
cp kali_overrides/app.js server/app.js
cp kali_overrides/logstash.conf configs/logstash/pipeline/logstash.conf
cp kali_overrides/requirements.txt anomaly-detector/requirements.txt

# Ensure velociraptor config directory exists and copy config
mkdir -p velociraptor/config
cp kali_overrides/server.config.yaml velociraptor/config/server.config.yaml

echo "File overrides successfully applied!"
echo ""
echo "To start the platform with Kali configurations, run:"
echo "sudo docker compose -f docker-compose.yml -f docker-compose.kali.yml up --build -d"
echo "=========================================="
