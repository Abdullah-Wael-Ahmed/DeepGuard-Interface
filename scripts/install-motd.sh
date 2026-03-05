#!/bin/bash

echo "[+] Installing DeepGuard MOTD..."

sudo chmod -x /etc/update-motd.d/*

sudo cp soc/motd/deepguard-motd.sh /etc/update-motd.d/01-deepguard

sudo chmod +x /etc/update-motd.d/01-deepguard

echo "[✓] DeepGuard MOTD installed successfully."
