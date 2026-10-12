#!/usr/bin/env bash
set -euo pipefail
umask 022

archive=${1:?Pass the backend archive path}
revision=${2:?Pass the Git commit SHA}
runtime_dir=/opt/jump-king
deploy_dir="$HOME/jump-king-deploy"

[[ "$revision" =~ ^[0-9a-f]{40}$ ]]
test -s "$archive"
test "$(tar -xOf "$archive" build/revision.txt)" = "$revision"
mkdir -p "$deploy_dir"
backup="$deploy_dir/backend-before-$revision.tar.gz"
if [ ! -e "$backup" ]; then
  tar -czf "$backup" -C "$runtime_dir" build node_modules package.json
fi

restore_backend() {
  trap - ERR
  printf 'Deployment failed; restoring the previous backend.\n' >&2
  tar -xzf "$backup" -C "$runtime_dir"
  sudo -n systemctl restart jump-king.service
  exit 1
}
trap restore_backend ERR

sudo -n systemctl stop jump-king.service
tar -xzf "$archive" -C "$runtime_dir"
sudo -n systemctl start jump-king.service
curl --fail --silent --show-error --retry 20 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:2567/health
test "$(cat "$runtime_dir/build/revision.txt")" = "$revision"
trap - ERR
printf '\nBackend deployed: %s\n' "$revision"
