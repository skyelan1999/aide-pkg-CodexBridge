#!/bin/sh
set -eu
status=0
sh "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/uninstall.sh" || status=$?
if [ -t 0 ]; then
  printf '\nPress Enter to close / 按回车关闭…'
  read -r answer || true
fi
exit "$status"
