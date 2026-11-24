#!/bin/bash
# Removes the leftover 4 KB stub of the old project 216 once no live gateway
# still runs from it. The stub only holds a marker plus a symlink to the catalog
# in this folder, because chats that were already open read the catalog from the
# old absolute path on every request.
set -u
STUB="/Users/habib/1-MY-WORK/216th-day-migration-to-open-source-model"
LOG="$(cd "$(dirname "$0")" && pwd)/cleanup-stub.log"

[ -f "$STUB/.migration-stub" ] || { echo "$(date '+%F %T') no stub, nothing to do" >>"$LOG"; exit 0; }

for _ in $(seq 1 720); do          # wait up to 12 hours
    if ! pgrep -f "$STUB/scripts" >/dev/null 2>&1; then
        rm -rf "$STUB" && echo "$(date '+%F %T') stub removed" >>"$LOG"
        exit 0
    fi
    sleep 60
done
echo "$(date '+%F %T') gave up: a gateway still runs from the stub" >>"$LOG"
exit 1
