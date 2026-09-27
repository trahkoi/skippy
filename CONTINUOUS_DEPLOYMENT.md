# Continuous deployment to Hetzner

The GitHub Actions workflow validates pull requests and deploys pushes to `main` over ordinary SSH. It uses your existing Hetzner VM and Caddy. SSH is reachable from GitHub runners; no Tailscale or VPN is needed.

Deployment is initially disabled. Provision the VM with the command below, configure GitHub, then set the repository variable `DEPLOY_ENABLED` to `true`.

## Provision with Ansible

The inventory in `ansible/inventory.yml` targets `root@62.238.3.212` and `skippy.dancelot.dev`. The playbook adopts the existing Ubuntu/Caddy installation, manages the deployment account and SSH key, preserves the initial site, and maintains the release directories and Caddy root. It leaves GitHub settings to you.

Install Ansible locally in an isolated Python environment (Python 3.11+):

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r ansible/requirements.txt
cd ansible
../.venv/bin/ansible-galaxy collection install -r requirements.yml
```

On this Mac, Python needs the system CA bundle for the collection download. If the command above reports `CERTIFICATE_VERIFY_FAILED`, rerun it with `SSL_CERT_FILE=/etc/ssl/cert.pem` before the command; do not disable certificate verification.

Run from the `ansible` directory so its inventory and configuration are loaded:

```bash
../.venv/bin/ansible-playbook provision.yml --check --diff
../.venv/bin/ansible-playbook provision.yml
```

The playbook reuses the deployment key at `~/.ssh/skippy_github_actions` and creates it if absent. Keys stay on your Mac; only the public key is installed on the VM. For a first run from another Mac, supply the existing deployment key or create a new one and update the GitHub secret afterward. Check mode requires the local key pair to exist; it does not generate keys. Administrative SSH trust must already be established, as it is on your current Mac. Password prompts are disabled.

Ansible backs up and validates changes to the Caddyfile before installing them, reloads only when needed, and restores the backup if reload or HTTPS verification fails. It preserves other Caddy sites, existing authorized keys, and the current release. Do not provision during an active deployment. This playbook configures the existing VM; it does not create a Hetzner server or install Caddy from scratch.

The live domain uses Cloudflare's proxy, which issues browser challenges to automated requests. Provisioning and release verification connect directly to Caddy at `127.0.0.1` over HTTPS with the real hostname and certificate verification. They do not change Cloudflare settings or verify its public-facing behavior. Check the public URL in a browser after deployment.

### Finish GitHub setup manually

After running Ansible, configure these GitHub settings:

1. In [repository environments](https://github.com/trahkoi/skippy/settings/environments), create `production`. Limit deployment branches to `main`; leave required reviewers unset for automatic deployment.
2. Add `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS` as secrets in that environment. Paste file contents using the commands below, one secret at a time:

   ```bash
   pbcopy < ~/.ssh/skippy_github_actions
   ```

   ```bash
   pbcopy < ~/.ssh/skippy_github_actions.known_hosts
   ```

3. Under [Actions variables](https://github.com/trahkoi/skippy/settings/variables/actions), add these repository variables:

   | Variable | Value |
   | --- | --- |
   | `DEPLOY_HOST` | `62.238.3.212` |
   | `DEPLOY_USER` | `skippy-deploy` |
   | `DEPLOY_PORT` | `22` (optional; the default) |
   | `SITE_URL` | `https://skippy.dancelot.dev` |
   | `DEPLOY_ENABLED` | `true`, once the workflow has been pushed and setup is complete |

4. Commit and push the workflow, scripts, tests, and documentation to `main`. Once enabled, use [Actions](https://github.com/trahkoi/skippy/actions) → **Validate and deploy → Run workflow → main** for the first deployment. Later pushes deploy automatically.

## Release behavior and rollback

Validation checks JavaScript syntax, required asset references, and the release tests. The deployment packages only `index.html`, `styles.css`, `app.js`, and a public `release.txt` containing the commit SHA. The packaged HTML uses the SHA in the asset query strings; source HTML is not modified.

Each release is uploaded privately into the deployment user's home and installed into `/srv/skippy/releases/<commit-sha>`. The workflow switches the `current` symlink atomically, then the VM fetches the HTTPS page, assets, and release marker directly from local Caddy and compares their bytes to the release. A failed check restores the previous symlink and fails the workflow. TLS verification remains enabled with the real site hostname. This confirms the origin release, not Cloudflare caching, browser challenges, or visitor behavior. If you have custom Cloudflare rules that cache HTML, purge that cache after a release or configure it to respect Caddy's `no-cache` response header.

GitHub serializes production deployments; a VM file lock also prevents simultaneous activations. Rerunning the same commit is supported if its packaged content matches. Releases are retained for manual rollback. Periodically remove old releases only after confirming they are neither the current release nor one you need for rollback. An interrupted process or machine failure may require manual inspection; automatic rollback covers detected health-check failures.

To roll back, first disable `DEPLOY_ENABLED` and wait for any running deployment to finish. On the VM, list releases and the current target:

```bash
ls /srv/skippy/releases
readlink /srv/skippy/current
```

Substitute an existing commit directory (or `bootstrap`) below:

```bash
sudo -u skippy-deploy ln -s releases/REPLACE_WITH_RELEASE /srv/skippy/current.rollback
sudo -u skippy-deploy mv -Tf /srv/skippy/current.rollback /srv/skippy/current
```

Check the public site. Revert the faulty commit on `main` before re-enabling deployment, otherwise the next push can restore the faulty changes. The symlink switch is atomic, but a browser that loaded HTML just before a switch can still request assets after it; the current app uses fixed asset filenames.

## Local validation

Requires Python 3.10+ and Node.js. No Python packages are needed:

```bash
python3 -m unittest discover -s tests -v
python3 scripts/release.py package "$(git rev-parse HEAD)" /tmp/skippy-site.tar.gz
```

The tests cover packaging without source edits, activation through a temporary HTTP server, retrying a release, rollback on failed health checks, and rejection of unexpected archive paths.

References: [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), and [Caddy static files](https://caddyserver.com/docs/quick-starts/static-files).
