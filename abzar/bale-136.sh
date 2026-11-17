#!/bin/zsh
# A text to Habib's phone from this project's Bale bot @habib136_reset_bot (Habib, 11 Nov 2026 22:55, window:
# «بله، در بله هم بفرست»; the bot was made by 203, the token is in Keychain service bale-136, never printed).
# Bale is an Iranian service: only through the Iran proxy 127.0.0.1:8899 (browser skill rule 2).
#   usage: bale-136.sh "<text>"      exit 0 sent · 1 not sent (reason in bale-136.log, never the token)
#   BALE_DRY=1 ⇐ only prints the text
matn=$1; CHAT=162875401; LOG=${0:A:h}/bale-136.log
[[ -n $BALE_DRY ]] && { print -r -- "BALE $matn"; exit 0 }
T=$(security find-generic-password -s bale-136 -w 2>/dev/null) || { print -r -- "[$(date '+%F %T')] ❌ توکن در Keychain نیست" >> $LOG; exit 1 }
j=$(curl -s -m 30 -x http://127.0.0.1:8899 "https://tapi.bale.ai/bot$T/sendMessage" --data-urlencode "chat_id=$CHAT" --data-urlencode "text=$matn" 2>&1)
if [[ $j == *'"ok":true'* ]]; then print -r -- "[$(date '+%F %T')] ✅ رفت: ${matn[1,60]}" >> $LOG; exit 0; fi
print -r -- "[$(date '+%F %T')] ❌ نرفت: ${${j//$T/<token>}[1,200]}" >> $LOG; exit 1
