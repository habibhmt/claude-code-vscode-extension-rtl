#!/bin/zsh
cd "$(dirname "$0")"
exec env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron . "$@"
