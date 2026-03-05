#!/bin/bash

HOST=$(hostname)
USER=$(whoami)
IP=$(hostname -I | awk '{print $1}')
UPTIME=$(uptime -p)
DATE=$(date)

CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8"%"}')
MEM=$(free -h | awk '/Mem:/ {print $3 "/" $2}')
DISK=$(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')

FAILED=$(lastb 2>/dev/null | wc -l)

echo -e "\e[36m"
echo " ____                       ____                      _ "
echo "|  _ \  ___  ___ _ __     / ___|_   _  __ _ _ __ ___| |"
echo "| | | |/ _ \/ _ \ '_ \   | |  _| | | |/ _\` | '__/ _ \ |"
echo "| |_| |  __/  __/ |_) |  | |_| | |_| | (_| | | |  __/ |"
echo "|____/ \___|\___| .__/    \____|\__,_|\__,_|_|  \___|_|"
echo "                |_|"
echo ""
echo "        DeepGuard Security Operations Platform"
echo -e "\e[0m"

echo "=============================================================="
echo " Hostname        : $HOST"
echo " Logged User     : $USER"
echo " IP Address      : $IP"
echo " Date            : $DATE"
echo ""
echo " System Uptime   : $UPTIME"
echo " CPU Usage       : $CPU"
echo " Memory Usage    : $MEM"
echo " Disk Usage      : $DISK"
echo ""
echo " Failed SSH Logins : $FAILED"
echo ""
echo " SOC Status        : ACTIVE MONITORING"
echo " Platform          : DeepGuard Threat Intelligence Engine"
echo "=============================================================="
