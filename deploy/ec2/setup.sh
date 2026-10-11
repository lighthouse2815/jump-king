#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
test -s backend.tar.gz
test -s .origin-token
test "$(id -un)" = ubuntu

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx curl ca-certificates xz-utils gettext-base

node_download_dir=$(mktemp -d)
trap 'rm -rf "$node_download_dir"' EXIT
curl --fail --silent --show-error https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$node_download_dir/SHASUMS256.txt"
node_archive=$(awk '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz$/ {print $2}' "$node_download_dir/SHASUMS256.txt")
test -n "$node_archive"
curl --fail --silent --show-error "https://nodejs.org/dist/latest-v24.x/$node_archive" -o "$node_download_dir/$node_archive"
(
  cd "$node_download_dir"
  awk -v archive="$node_archive" '$2 == archive' SHASUMS256.txt | sha256sum --check -
)
sudo mkdir -p /opt/node /opt/jump-king
sudo tar -xJf "$node_download_dir/$node_archive" --strip-components=1 -C /opt/node
sudo chown ubuntu:ubuntu /opt/jump-king
tar -xzf backend.tar.gz -C /opt/jump-king

export JUMPKING_ORIGIN_TOKEN
JUMPKING_ORIGIN_TOKEN=$(cat .origin-token)
envsubst '${JUMPKING_ORIGIN_TOKEN}' < nginx.conf.template | sudo tee /etc/nginx/sites-available/jump-king >/dev/null
sudo chmod 600 /etc/nginx/sites-available/jump-king
if [ -L /etc/nginx/sites-enabled/default ]; then
  sudo unlink /etc/nginx/sites-enabled/default
fi
sudo ln -sfn /etc/nginx/sites-available/jump-king /etc/nginx/sites-enabled/jump-king
sudo nginx -t
sudo install -m 644 jump-king.service jump-king-free-expiry.service jump-king-free-expiry.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jump-king.service jump-king-free-expiry.timer
sudo systemctl restart jump-king.service
sudo systemctl restart nginx
curl --fail --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:2567/health
sudo systemctl list-timers jump-king-free-expiry.timer --no-pager
