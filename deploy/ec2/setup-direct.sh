#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
export JUMPKING_DOMAIN=${1:?Usage: bash setup-direct.sh game-name.duckdns.org}
if [[ ! $JUMPKING_DOMAIN =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.duckdns\.org$ ]]; then
    printf '%s\n' 'Expected a DuckDNS hostname.' >&2
    exit 1
fi
test "$(id -un)" = ubuntu
sudo nginx -t
sudo systemctl is-active jump-king >/dev/null

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot gettext-base
sudo mkdir -p /var/www/jump-king-acme

# Keep the existing token-protected Worker vhost as a fallback.
# Re-running setup must not interrupt an existing HTTPS endpoint.
if ! sudo test -s "/etc/letsencrypt/live/$JUMPKING_DOMAIN/fullchain.pem"; then
    envsubst '${JUMPKING_DOMAIN}' < nginx-direct-http.conf.template | sudo tee /etc/nginx/sites-available/jump-king-direct >/dev/null
    sudo ln -sfn /etc/nginx/sites-available/jump-king-direct /etc/nginx/sites-enabled/jump-king-direct
    sudo nginx -t
    sudo systemctl reload nginx
fi

sudo certbot certonly --webroot -w /var/www/jump-king-acme \
    -d "$JUMPKING_DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --keep-until-expiring

envsubst '${JUMPKING_DOMAIN}' < nginx-direct.conf.template | sudo tee /etc/nginx/sites-available/jump-king-direct >/dev/null
sudo ln -sfn /etc/nginx/sites-available/jump-king-direct /etc/nginx/sites-enabled/jump-king-direct
sudo nginx -t
sudo systemctl reload nginx
sudo install -m 755 renew-nginx.sh /etc/letsencrypt/renewal-hooks/deploy/jump-king-nginx
sudo systemctl enable --now certbot.timer
curl --fail --retry 3 --silent --show-error "https://$JUMPKING_DOMAIN/health"
