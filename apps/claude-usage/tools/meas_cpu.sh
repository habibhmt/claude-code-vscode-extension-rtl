#!/bin/bash
# 10-minute CPU/memory check of the running ClaudeUsage (definition 11).
# One line every 10 s: time, %CPU, RSS (KB), live = chat files changed in the last 3 min.
# Ends with the memory footprint and its peak since launch.
P=$(pgrep -x ClaudeUsage) || { echo "ClaudeUsage is not running"; exit 1; }
for i in $(seq 1 60); do
  l=$(find ~/.claude/projects -maxdepth 2 -name '*.jsonl' -mmin -3 | wc -l | tr -d ' ')
  echo "$(date +%H:%M:%S) $(ps -o %cpu=,rss= -p "$P") live=$l"
  sleep 10
done | tee /dev/stderr | awk '{split($4,a,"=");c+=$2;if($2>m)m=$2;l+=a[2]} END{printf "avg_cpu=%.1f%% max_cpu=%.1f%% live_avg=%.1f\n",c/NR,m,l/NR}'
footprint "$P" | grep phys_footprint
