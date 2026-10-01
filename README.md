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
- Click **6-count** to generate three ordinary randomized two-beat blocks. If this is your first rhythm action, they replace the initial empty block; after editing, randomizing, or adding blocks, they append to the existing rhythm. Each block can be edited, randomized, removed, or printed independently, and numbering continues through 8 before repeating.
- On desktop (above 650px wide), click a block’s expand icon to open **Practice view**. Its two beats fill the browser view with large, high-contrast, read-only notation. Left/right arrow keys move between blocks, stopping at the ends. Close or Escape returns to the overview at the same scroll position. Fullscreen is available when supported; Escape exits fullscreen first. The expand control is hidden on mobile, and narrowing the window to the mobile layout closes practice view.
- Remove blocks with ×. Remaining blocks are renumbered; at least one block stays on the page.
- Click **Clear** to reset the rhythm to one empty block. The next **6-count** replaces that empty block, just like on first load.
- **Safe mode** limits every random generation action (⟳, Random two beats, and 6-count) to an equally likely preset from the built-in **Basics** set. Switching modes never changes existing blocks. Individual slots remain editable; the initial block, Add two beats, and Clear still use empty blocks. Safe mode starts off on a fresh sheet and is not saved between reloads.
- Basics contains the following patterns, stored in display order `& a 1 & a 2` (`0` = empty, `1` = step, `3` = action without weight change): Step step `001001`, Triple `001011`, Triple variant `011001`, Delayed double `003011`, Delayed single `003001`, and Quad `011011`.
- Printing controls and help are hidden by default. Add `?print=1` to the URL (for example, `public/index.html?print=1`), or `&print=1` if it already has query parameters, to show them. Removing the parameter or using `print=0` hides them again on the next page load. This is a UI toggle, not an access restriction.
- With printing enabled, click **Print / PDF** on a block to print only its symbols and count labels, without the beat heading or editing controls. Choose **Save as PDF** in the browser’s print dialog to keep a copy. Printing uses A4 landscape with large black notation centered horizontally and vertically on each page; keep A4 landscape selected in the print dialog for this layout. Background graphics are not required. The browser’s regular Print command prints all blocks, one per page. Page margins are zero, with spacing inside each block, to suppress automatic browser text where supported. If the title, URL, date, or page numbers still appear, turn off **Headers and footers** in the browser’s print settings.

- Click **Share rhythm** to copy a URL containing a snapshot of all blocks and symbols. Opening it restores an editable copy; share again after editing to make a new snapshot. If clipboard access is unavailable, copy the selected link from the field shown below the controls. Use a hosted copy of the app for links other people can open.
- Shared rhythms load regardless of Safe mode, using the existing link format. Loading a shared rhythm selects Safe mode if every block matches a Basics preset, and turns it off otherwise. Empty blocks are not Basics presets. Subsequent slot edits do not change the selected mode.
- Rhythm data lives entirely in the URL fragment (`#rhythm=1.…`), which is not sent to the server. No account, database, or server-side storage is used. Existing query parameters (including optional beat and print controls) are preserved. Links support up to 1,000 blocks; malformed, unsupported, and oversized links leave the current rhythm unchanged and show an error.

Keep a share link to save a rhythm. Edits are not saved automatically: reloading a shared link restores its original snapshot; reloading without a rhythm link starts an empty sheet.
