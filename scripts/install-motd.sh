#!/bin/bash

echo "[+] Installing DeepGuard MOTD..."

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MOTD_SOURCE="$REPO_DIR/motd/deepguard-motd.sh"
MOTD_TARGET="/etc/update-motd.d/01-deepguard"

# Disable default Ubuntu MOTD scripts
sudo chmod -x /etc/update-motd.d/*

# Create symlink so updates come from repo
sudo ln -sf "$MOTD_SOURCE" "$MOTD_TARGET"

# Make executable
sudo chmod +x "$MOTD_SOURCE"
sudo chmod +x "$MOTD_TARGET"

echo "[✓] DeepGuard MOTD installed successfully."
echo "[✓] Source: $MOTD_SOURCE"
echo "[✓] Target: $MOTD_TARGET"
