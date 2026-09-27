# Skippy

A lightweight rhythm sketchbook made with plain HTML, CSS, and a little JavaScript. No dependencies, build step, or network connection needed.

Open `index.html` in your browser.

To host it on your own server, follow the [Hetzner deployment guide](DEPLOYMENT.md) for DNS, HTTPS, and publishing updates.

To deploy automatically on pushes to `main`, follow the [continuous deployment setup](CONTINUOUS_DEPLOYMENT.md). GitHub Actions uploads releases to Hetzner over SSH, verifies Caddy serves the release over HTTPS, and rolls back if verification fails.

Provision the existing VM with the Ansible playbook in `ansible/provision.yml`; the setup guide covers installation, check mode, and GitHub settings.

- Click a slot (or focus it and press Space/Enter) to cycle through empty → step → hop → action → empty.
- Numbered counts use ● and ◯. The “&” and “a” subdivisions use • and ∘. A backslash represents an action without a weight change on any subdivision.
- Add two-beat blocks; they wrap onto new lines as needed. Counts run from 1 through 8, then repeat.
- Remove blocks with ×. Remaining blocks are renumbered; at least one block stays on the page.

Saving is planned for a future version. Reloading or closing the page clears your rhythm.
