# Skippy

A lightweight rhythm sketchbook made with plain HTML, CSS, and a little JavaScript. No dependencies, build step, or network connection needed.

Open `public/index.html` in your browser.

Project layout:

- `public/` — HTML, CSS, and JavaScript served to browsers.
- `scripts/` — release packaging and deployment tools.
- `tests/` — release and deployment tests.
- `ansible/` — server provisioning.
- `.github/workflows/` — automated validation and deployment.

Run commands from the repository root. Release packaging reads from `public/` by default.

- Click a slot (or focus it and press Space/Enter) to cycle through empty → step → hop → action → empty.
- Numbered counts use ● and ◯. The “&” and “a” subdivisions use • and ∘. A backslash represents an action without a weight change on any subdivision.
- Add two-beat blocks; they wrap onto new lines as needed. Counts run from 1 through 8, then repeat.
- Click **Randomize** on any block, including the first, to replace its slots with randomized steps, hops, actions, and empty slots. **Random two beats** adds a new random block. Each random block has at least one non-empty slot, and every slot stays editable.
- Remove blocks with ×. Remaining blocks are renumbered; at least one block stays on the page.

Saving is planned for a future version. Reloading or closing the page clears your rhythm.
