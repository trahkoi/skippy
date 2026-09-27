# Deploy Skippy to Hetzner with Cloudflare DNS

The live site at `https://skippy.dancelot.dev` now uses Cloudflare's proxy and Caddy's root is `/srv/skippy/current`. See [continuous deployment](CONTINUOUS_DEPLOYMENT.md) for its provisioner and release workflow. The steps below describe an initial setup using DNS-only records; do not reset the live configuration to repeat them.

Skippy consists of `index.html`, `styles.css`, and `app.js`. Upload those files to your VM and serve them with Caddy. There is no build step, backend, database, or Node.js process to run. Rhythms currently live only in the browser's memory and disappear on reload; deploying the app does not add saving.

This guide assumes **Ubuntu 24.04 LTS**, SSH access with an account that can use `sudo`, and a public IPv4 address. Run the commands one block at a time, checking for errors before continuing. If your VM uses another distribution, adapt the package installation steps. If it already hosts websites, preserve their configuration and check which service owns ports 80 and 443 before installing Caddy.

The result is: **your domain → your Hetzner VM → Caddy → Skippy**.

## 1. Choose the address

Your domain is Dancelot and your DNS provider is Cloudflare. Since the full domain ending has not been specified, the examples use `example.com` as a placeholder for your complete Dancelot domain, and `skippy.example.com` for the app. Replace these everywhere with your actual domain and chosen hostname. A subdomain works well if your main domain already hosts another website. To use the whole domain, substitute `example.com` and use the root-domain DNS record described below.

Replace these example values:

| Example | Replace with |
| --- | --- |
| `example.com` | Your registered domain |
| `skippy.example.com` | Your chosen app hostname |
| `203.0.113.10` | Your VM's public IPv4 address from Hetzner Console |
| `root` | Your SSH username, if different |

`203.0.113.10` is a documentation address and will not reach your VM.

## 2. Point DNS at the VM

In the [Cloudflare dashboard](https://dash.cloudflare.com/), select your Dancelot domain, open **DNS → Records**, and choose **Add record**. See [Cloudflare's record management instructions](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/).

On **your Mac**, inspect the current nameservers:

```bash
dig +short NS example.com
```

Confirm the domain is active in Cloudflare and these match the nameservers assigned to it there. If Cloudflare reports a pending nameserver setup, complete its activation instructions first. With Cloudflare DNS already active, you do not need to transfer the domain or change nameservers to host the website at Hetzner.

For `skippy.example.com`, create:

| Type | Name | IPv4 address | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| A | `skippy` | `203.0.113.10` | **DNS only** (gray cloud) | Auto |

For the root domain `example.com`, use `@` instead of `skippy`. Enter only the IP in the value field, without `https://` or a port, and save the record.

Keep the record **DNS only** throughout this guide. Visitors connect directly to Caddy, which provides HTTPS. Cloudflare's proxy and SSL settings do not apply to that traffic, and no Cloudflare API token is needed. See [Cloudflare's proxy status explanation](https://developers.cloudflare.com/dns/proxy-status/).

Replace conflicting A/CNAME records or parking/forwarding settings **only for the chosen hostname**. Preserve unrelated records, particularly MX and TXT records used for email. For this IPv4 setup, remove stale AAAA records for the chosen hostname; only publish an AAAA record if that exact IPv6 address is configured and reachable on your VM.

Check the result on **your Mac**:

```bash
dig +short A skippy.example.com
dig +short AAAA skippy.example.com
dig @1.1.1.1 +short A skippy.example.com
```

The A lookups should return your VM's IPv4 address; the AAAA lookup should be empty for an IPv4-only setup. Cached answers may persist until the previous record's TTL expires. Wait for the correct answers before enabling the domain in Caddy.

## 3. Allow SSH and web traffic

If you use a Hetzner Cloud Firewall, attach it to this VM and allow these inbound connections:

| Protocol | Port | Source | Purpose |
| --- | --- | --- | --- |
| TCP | 22, or your actual SSH port | Any IPv4 and IPv6 address | Key-authenticated administration and deployment |
| TCP | 80 | Any IPv4 and IPv6 address | HTTP and certificate validation |
| TCP | 443 | Any IPv4 and IPv6 address | HTTPS |

SSH on this server is not restricted to your laptop's IP. GitHub Actions can connect directly using a deployment SSH key; no VPN or Tailscale is required. Preserve rules needed by existing services. Hetzner Cloud Firewalls block unmatched inbound traffic, while outbound traffic is allowed when no outbound rules are configured. For this setup, leave outbound traffic allowed. See [Hetzner's firewall documentation](https://docs.hetzner.com/cloud/firewalls/faq/).

Connect from **your Mac**, keeping the session open while checking firewall access:

```bash
ssh root@203.0.113.10
```

Use your existing SSH key and account. For connection details, see [Hetzner's SSH guide](https://docs.hetzner.com/cloud/servers/getting-started/connecting-to-the-server/).

On **the VM**, check the OS, existing listeners, and any Ubuntu firewall:

```bash
cat /etc/os-release
sudo ss -ltnp '( sport = :80 or sport = :443 )'
sudo ufw status
```

If `ufw` is active, allow web traffic through it too:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

If UFW is inactive or not installed, there is nothing to change in it for this guide; the attached Hetzner firewall provides the inbound filtering. Before closing your first SSH session, confirm you can open a second connection from your Mac.

If another server such as Nginx or Apache already owns port 80 or 443, integrate Skippy into that server or plan a migration before proceeding. Two servers cannot share the same listening address and port.

## 4. Install Caddy on the VM

Run on **the VM**. These commands use [Caddy's official stable package repository](https://caddyserver.com/docs/install#debian-ubuntu-raspbian):

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg ca-certificates
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' -o /tmp/caddy-stable.gpg.key
sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/caddy-stable.gpg.key
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /tmp/caddy-stable.list
sudo install -m 644 /tmp/caddy-stable.list /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo apt update
sudo apt install -y caddy
sudo systemctl enable --now caddy
```

If Caddy is already installed from this repository, skip adding its key and repository again. Inspect its existing configuration before changing it.

## 5. Upload the app

In a terminal on **your Mac**, run from the local Skippy repository:

```bash
cd /Users/tero.rahko/code/personal/wcs/skippy
ssh root@203.0.113.10 'mkdir -p ~/skippy-upload'
scp index.html styles.css app.js root@203.0.113.10:skippy-upload/
```

On **the VM**, put the files in the public web directory:

```bash
sudo install -d -m 755 /srv/skippy
sudo install -m 644 ~/skippy-upload/index.html ~/skippy-upload/styles.css ~/skippy-upload/app.js /srv/skippy/
sudo -u caddy test -r /srv/skippy/index.html && echo 'Caddy can read the site'
```

Only these three files need to be public. Keep the Git repository, credentials, and documentation outside `/srv/skippy`.

## 6. Configure the domain and HTTPS

On **the VM**, back up and open the configuration:

```bash
sudo cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)"
sudo nano /etc/caddy/Caddyfile
```

On a fresh installation, replace the default contents with the following, substituting your real hostname. If Caddy already serves other sites, retain their blocks and add this one:

```caddyfile
skippy.example.com {
    root * /srv/skippy
    encode zstd gzip
    header Cache-Control "no-cache"
    file_server
}
```

The `no-cache` header makes browsers revalidate files when loading the page, which helps updates appear promptly with these fixed asset filenames. The root and file server directives serve this app directly; see [Caddy's static file guide](https://caddyserver.com/docs/quick-starts/static-files).

Save in nano with Ctrl+O, Enter, then Ctrl+X. Validate before reloading:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

If validation succeeds:

```bash
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 50 --no-pager
```

Caddy obtains and renews a public TLS certificate and redirects HTTP to HTTPS. DNS must point to this VM, ports 80 and 443 must be reachable, and Caddy's certificate storage must remain writable and persistent. See [Caddy's automatic HTTPS requirements](https://caddyserver.com/docs/automatic-https).

### Optional: support www for a root-domain deployment

If your main site is `example.com` and you also want `www.example.com`, add a DNS CNAME record named `www` targeting `example.com`, also set to **DNS only**. Then use this configuration instead:

```caddyfile
example.com {
    root * /srv/skippy
    encode zstd gzip
    header Cache-Control "no-cache"
    file_server
}

www.example.com {
    redir https://example.com{uri} permanent
}
```

Both names must resolve correctly. Repeat validation and reload after editing.

## 7. Verify the public site

On **your Mac**, using your real hostname:

```bash
curl -I http://skippy.example.com
curl -I https://skippy.example.com
curl -I https://skippy.example.com/styles.css
curl -I https://skippy.example.com/app.js
```

Expect an HTTP redirect to HTTPS, followed by `200` responses for the HTTPS page and both assets. Open the HTTPS address in a browser and check:

- The page loads with styling and no certificate warning.
- Clicking a slot cycles through its symbols.
- “Add two beats” adds a block and × removes a block.
- Reloading clears the rhythm, as expected for the current app.

## 8. Publish later updates

For automatic deployment from GitHub, follow [CONTINUOUS_DEPLOYMENT.md](CONTINUOUS_DEPLOYMENT.md). Once enabled, use that workflow instead of the manual copies below; Caddy will serve `/srv/skippy/current`.

Before uploading a changed `app.js` or `styles.css`, update its `?v=` value in `index.html` to a new release identifier (for example, `20260925-3`). This gives browsers and caches a new asset URL. Upload all three files together, and install `styles.css` and `app.js` before `index.html` so the new page references files that are already present.

On **the VM**, first keep a copy of the current release:

```bash
sudo cp -a /srv/skippy "/srv/skippy-backup-$(date +%Y%m%d-%H%M%S)"
```

On **your Mac**, repeat the `scp` command from step 5 with the updated files. Then on **the VM**, publish the assets first and the page last:

```bash
sudo install -m 644 ~/skippy-upload/styles.css ~/skippy-upload/app.js /srv/skippy/
sudo install -m 644 ~/skippy-upload/index.html /srv/skippy/
```

File-only updates do not require restarting or reloading Caddy. Repeat the browser checks after publishing. These simple copies are not an atomic release; use them for this small app when a brief overlap between old and new assets is acceptable. If Cloudflare has a custom rule caching HTML, purge the site's cached HTML after publishing so visitors receive the updated asset URLs.

To roll back, choose the backup directory created above and substitute its actual timestamp:

```bash
sudo install -m 644 /srv/skippy-backup-YYYYMMDD-HHMMSS/index.html /srv/skippy-backup-YYYYMMDD-HHMMSS/styles.css /srv/skippy-backup-YYYYMMDD-HHMMSS/app.js /srv/skippy/
```

Keep the source backed up in Git and apply Ubuntu/Caddy package updates regularly with `sudo apt update` and `sudo apt upgrade`. If the VM reports that a reboot is required, schedule it and verify the site afterward. Retain `/etc/caddy/Caddyfile` and `/var/lib/caddy`; the latter contains certificate state and private keys and belongs in private backups. Caddy's [service documentation](https://caddyserver.com/docs/running#using-the-service) explains its storage and logging.

## Troubleshooting

If you later enable Cloudflare's orange-cloud proxy, first confirm direct HTTPS works and use **Full (strict)** encryption for this hostname. A zone-wide setting also affects other proxied websites on the domain. Do not use Flexible with Caddy's HTTPS redirect, as that combination can cause redirect loops. Once proxied, DNS lookups return Cloudflare addresses rather than your VM's IP; the direct-IP checks above assume DNS-only mode. See [Cloudflare's Full (strict) requirements](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

| Symptom | What to check |
| --- | --- |
| Domain does not resolve | Confirm you edited the authoritative DNS provider; use the `dig` commands in step 2. |
| Wrong site appears | Check all A/AAAA records for the chosen hostname and the hostname in the Caddyfile. |
| Connection times out | Check the VM's public IP, attached Hetzner firewall, and active OS firewall. |
| Caddy cannot start | Run `sudo journalctl -u caddy -n 100 --no-pager`; check for port conflicts and validate the configuration. |
| HTTPS certificate fails | Check DNS, stale AAAA records, inbound TCP 80/443, outbound connectivity, and the Caddy logs. If CAA records exist, ensure they permit the certificate authority Caddy is trying to use. |
| 404 or missing styling | Confirm all three files are directly in `/srv/skippy` and that this is the configured root. |
| Permission denied / 403 | Check directory traversal and file read permissions with `namei -l /srv/skippy/index.html`; the `caddy` user needs access. |
| Old version appears | Hard-refresh the browser and verify that you uploaded and installed all three new files. |

This guide was checked against the linked official documentation on 25 September 2026. The commands have not been executed on your VM.
