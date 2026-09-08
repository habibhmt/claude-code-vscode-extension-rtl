#!/bin/bash
# Kill runaway Claude native-binary processes.
#
#   ./kill-claude-zombies.sh                 interactive, lists then asks
#   ./kill-claude-zombies.sh --yes           no prompt (for launchd/cron)
#   ./kill-claude-zombies.sh --threshold 50  only processes above 50% CPU
#
# Background note: with --yes a threshold is mandatory in spirit — killing every
# claude process unattended would take down live sessions, so the default
# threshold only reaps processes that are actually spinning.

ASSUME_YES=false
THRESHOLD=80

while [ $# -gt 0 ]; do
    case $1 in
        --yes|-y)      ASSUME_YES=true; shift ;;
        --threshold)   THRESHOLD="$2"; shift 2 ;;
        --all)         THRESHOLD=0; shift ;;
        --help|-h)
            echo "Usage: ./kill-claude-zombies.sh [--yes] [--threshold N] [--all]"
            exit 0 ;;
        *) shift ;;
    esac
done

rows=$(ps aux | grep "claude-code.*native-binary/claude" | grep -v grep \
       | awk -v t="$THRESHOLD" '$3 > t {print $2, $3}')

if [ -z "$rows" ]; then
    [ "$ASSUME_YES" = true ] || echo "✅ No Claude process above ${THRESHOLD}% CPU."
    exit 0
fi

count=$(echo "$rows" | wc -l | tr -d ' ')
echo "⚠️  $count Claude process(es) above ${THRESHOLD}% CPU:"
echo "$rows" | awk '{printf "   PID %-8s CPU %s%%\n", $1, $2}'

if [ "$ASSUME_YES" != true ]; then
    read -p "Kill them? (y/n) " -n 1 -r
    echo ""
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "❌ Cancelled"; exit 0; }
fi

echo "$rows" | awk '{print $1}' | xargs kill -9 2>/dev/null
echo "✅ Killed $count process(es)"
