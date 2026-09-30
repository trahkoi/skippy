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
- **Add two beats** and **Random two beats** are hidden by default. Add `?showBeatTools=true` to the URL (or `&showBeatTools=true` alongside other query parameters) to show both buttons and their help text. Removing the parameter or using any other value hides them on the next page load. Blocks wrap onto new lines as needed. Counts run from 1 through 8, then repeat.
- Click **⟳ (Randomize)** on any block, including the first, to replace its slots with randomized steps, hops, and actions. **Random two beats** adds a new random block. The chances of a symbol in each block’s six slots (& a 1 & a 2) are 5%, 40%, 100%, 20%, 60%, and 100%, respectively. When a slot has a symbol, it has a 60% chance of a step, 30% chance of an action without weight change, and 10% chance of a hop (weights 6:3:1). Every slot stays editable.
- Click **Add 6** to generate three ordinary randomized two-beat blocks. If this is your first rhythm action, they replace the initial empty block; after editing, randomizing, or adding blocks, they append to the existing rhythm. Each block can be edited, randomized, removed, or printed independently, and numbering continues through 8 before repeating.
- Remove blocks with ×. Remaining blocks are renumbered; at least one block stays on the page.
- Printing controls and help are hidden by default. Add `?print=1` to the URL (for example, `public/index.html?print=1`), or `&print=1` if it already has query parameters, to show them. Removing the parameter or using `print=0` hides them again on the next page load. This is a UI toggle, not an access restriction.
- With printing enabled, click **Print / PDF** on a block to print only its symbols and count labels, without the beat heading or editing controls. Choose **Save as PDF** in the browser’s print dialog to keep a copy. Printing uses A4 landscape with large black notation centered horizontally and vertically on each page; keep A4 landscape selected in the print dialog for this layout. Background graphics are not required. The browser’s regular Print command prints all blocks, one per page. Page margins are zero, with spacing inside each block, to suppress automatic browser text where supported. If the title, URL, date, or page numbers still appear, turn off **Headers and footers** in the browser’s print settings.

Saving is planned for a future version. Reloading or closing the page clears your rhythm.
