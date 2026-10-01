const blocks = document.querySelector('#blocks');
const template = document.querySelector('#block-template');
const addButton = document.querySelector('#add-block');
const randomButton = document.querySelector('#random-block');
const sequenceButton = document.querySelector('#random-six-counts');
const clearButton = document.querySelector('#clear-rhythm');
const safeModeSwitch = document.querySelector('#safe-mode');
let rhythmStarted = false;
const queryParams = new URLSearchParams(window.location.search);
const beatToolsEnabled = queryParams.get('showBeatTools') === 'true';
addButton.hidden = !beatToolsEnabled;
randomButton.hidden = !beatToolsEnabled;
document.querySelector('#beat-tools-help').hidden = !beatToolsEnabled;
const printingEnabled = queryParams.get('print') === '1';
document.querySelector('#print-help').hidden = !printingEnabled;
const actions = ['empty', 'step', 'hop', 'action without weight change'];
// Probability of a symbol at each position: & a 1 & a 2.
const actionProbabilities = [0.05, 0.4, 1, 0.2, 0.6, 1];
const actionWeights = { step: 6, 'action without weight change': 3, hop: 1 };
const symbols = { small: ['', '•', '∘', '\\'], large: ['', '●', '◯', '\\'] };
// Six slots in display order: & a 1 & a 2. States: 0 empty, 1 step, 3 action.
const presetSets = {
  Basics: [
    { name: 'Step step', states: '001001' },
    { name: 'Triple', states: '001011' },
    { name: 'Triple variant', states: '011001' },
    { name: 'Delayed double', states: '003011' },
    { name: 'Delayed single', states: '003001' },
    { name: 'Quad', states: '011011' },
  ],
};

safeModeSwitch.addEventListener('change', () => {
  document.querySelector('#status').textContent = safeModeSwitch.checked
    ? 'Safe mode on. Future random generation uses Basics presets.'
    : 'Safe mode off. Future random generation uses all actions.';
});

function describeSlot(slot, blockIndex, positionIndex) {
  const beat = (blockIndex * 2 + Math.floor(positionIndex / 3)) % 8 + 1;
  const part = ['&', 'a', String(beat)][positionIndex % 3];
  const state = Number(slot.dataset.state);
  const size = positionIndex % 3 === 2 ? 'large' : 'small';
  slot.textContent = symbols[size][state];
  slot.setAttribute('aria-label', `Block ${blockIndex + 1}, ${part}${positionIndex % 3 === 2 ? '' : ` before ${beat}`}: ${actions[state]}. Click to change to ${actions[(state + 1) % 4]}.`);
  slot.title = `${actions[state]} → ${actions[(state + 1) % 4]}`;
  slot.nextElementSibling.textContent = part;
}

function updateBlocks() {
  [...blocks.children].forEach((block, index) => {
    const firstBeat = (index * 2) % 8 + 1;
    // Support both heading levels while older HTML may still be cached.
    block.querySelector('.block-heading h2, .block-heading h3').textContent = `Beats ${firstBeat}–${firstBeat + 1}`;
    block.setAttribute('aria-label', `Block ${index + 1}, beats ${firstBeat}–${firstBeat + 1}`);
    block.querySelector('.expand-button')?.setAttribute('aria-label', `Open practice view for block ${index + 1}`);
    const remove = block.querySelector('.remove-button');
    remove.disabled = blocks.children.length === 1;
    remove.setAttribute('aria-label', `Remove block ${index + 1}`);
    block.querySelector('.randomize-button')?.setAttribute('aria-label', `Randomize block ${index + 1}`);
    block.querySelector('.print-button')?.setAttribute('aria-label', `Print block ${index + 1} or save as PDF`);
    block.querySelectorAll('.slot').forEach((slot, position) => describeSlot(slot, index, position));
  });
  const count = blocks.children.length;
  document.querySelector('#block-count').textContent = `${count} ${count === 1 ? 'block' : 'blocks'} · ${count * 2} beats`;
}

function randomActionState() {
  const totalWeight = Object.values(actionWeights).reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * totalWeight;
  for (const [action, weight] of Object.entries(actionWeights)) {
    if (roll < weight) return actions.indexOf(action);
    roll -= weight;
  }
}

function randomizeBlock(block) {
  const slots = [...block.querySelectorAll('.slot')];
  if (safeModeSwitch.checked) {
    const presets = presetSets.Basics;
    const preset = presets[Math.floor(Math.random() * presets.length)];
    slots.forEach((slot, index) => { slot.dataset.state = preset.states[index]; });
    return;
  }
  slots.forEach((slot, index) => {
    const hasAction = Math.random() < actionProbabilities[index];
    slot.dataset.state = hasAction
      ? String(randomActionState())
      : '0';
  });
}

function addBlock(focus = false, randomize = false, states = '000000', update = true) {
  const block = template.content.firstElementChild.cloneNode(true);
  block.querySelector('.print-button').hidden = !printingEnabled;
  const positions = block.querySelector('.positions');
  for (let index = 0; index < 6; index++) {
    const position = document.createElement('div');
    position.className = `position${index % 3 === 2 ? ' is-count' : ''}`;
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'slot';
    slot.dataset.state = states[index];
    const label = document.createElement('span');
    label.className = 'count';
    label.setAttribute('aria-hidden', 'true');
    position.append(slot, label);
    positions.append(position);
  }
  blocks.append(block);
  if (randomize) randomizeBlock(block);
  if (update) updateBlocks();
  if (focus) {
    rhythmStarted = true;
    block.querySelector('.slot').focus();
    document.querySelector('#status').textContent = `Block ${blocks.children.length} added${randomize ? ' with randomized actions' : ''}.`;
  }
}

// Match the desktop layout; practice is a read-only view of existing blocks.
const desktopView = window.matchMedia('(min-width: 651px)');
const practice = document.querySelector('#practice-view');
const practiceNotation = document.querySelector('#practice-notation');
const fullscreenButton = document.querySelector('#practice-fullscreen');
let practiceIndex = 0;
let practiceTrigger = null;
let practiceScroll = 0;
let practiceFullscreen = false;
let practiceTouch = null;

function movePractice(direction) {
  practiceIndex = Math.max(0, Math.min(blocks.children.length - 1, practiceIndex + direction));
  renderPractice();
}

function renderPractice() {
  const block = blocks.children[practiceIndex];
  if (!block) return closePractice();
  const heading = block.querySelector('.block-heading h2, .block-heading h3').textContent;
  document.querySelector('#practice-title').textContent = `${heading} · Block ${practiceIndex + 1} of ${blocks.children.length}`;
  practiceNotation.replaceChildren();
  block.querySelectorAll('.position').forEach(position => {
    const copy = document.createElement('div');
    copy.className = position.className;
    const source = position.querySelector('.slot');
    const mark = document.createElement('span');
    mark.className = 'slot';
    mark.dataset.state = source.dataset.state;
    mark.setAttribute('role', 'img');
    mark.setAttribute('aria-label', source.getAttribute('aria-label').split('. Click')[0]);
    copy.append(mark, position.querySelector('.count').cloneNode(true));
    practiceNotation.append(copy);
  });
}

function openPractice(block, trigger) {
  if (!desktopView.matches || practice.open) return;
  practiceIndex = [...blocks.children].indexOf(block);
  practiceTrigger = trigger;
  practiceScroll = window.scrollY;
  renderPractice();
  fullscreenButton.hidden = !document.fullscreenEnabled;
  document.querySelector('#practice-status').textContent = '';
  document.body.classList.add('practising');
  practice.showModal();
}

function closePractice() {
  if (practice.open) practice.close();
}

practice.addEventListener('close', () => {
  practiceTouch = null;
  if (practiceFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  document.body.classList.remove('practising');
  if (desktopView.matches && practiceTrigger?.isConnected) practiceTrigger.focus({ preventScroll: true });
  window.scrollTo(0, practiceScroll);
});
document.querySelector('#practice-close').addEventListener('click', closePractice);
practice.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    movePractice(event.key === 'ArrowRight' ? 1 : -1);
  }
});
practice.addEventListener('touchstart', event => {
  practiceTouch = null;
  if (!practice.open || event.touches.length !== 1 || event.target.closest('button')) return;
  const touch = event.touches[0];
  practiceTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
}, { passive: true });
practice.addEventListener('touchmove', event => {
  if (!practiceTouch) return;
  const touch = [...event.touches].find(touch => touch.identifier === practiceTouch.id);
  // Once a gesture becomes vertical or multi-touch, leave it to the browser.
  if (event.touches.length !== 1 || !touch ||
      Math.abs(touch.clientY - practiceTouch.y) > Math.max(20, Math.abs(touch.clientX - practiceTouch.x))) {
    practiceTouch = null;
  }
}, { passive: true });
practice.addEventListener('touchend', event => {
  const start = practiceTouch;
  practiceTouch = null;
  if (!practice.open || !start || event.touches.length) return;
  const touch = [...event.changedTouches].find(touch => touch.identifier === start.id);
  if (!touch) return;
  const dx = touch.clientX - start.x;
  const dy = touch.clientY - start.y;
  if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    movePractice(dx < 0 ? 1 : -1);
  }
}, { passive: true });
practice.addEventListener('touchcancel', () => {
  practiceTouch = null;
}, { passive: true });
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      practiceFullscreen = true;
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    practiceFullscreen = false;
    document.querySelector('#practice-status').textContent = 'Fullscreen is unavailable. Practice view still fills the browser window.';
  }
});
document.addEventListener('fullscreenchange', () => {
  fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  document.querySelector('#practice-help').textContent = document.fullscreenElement
    ? '← → Switch blocks · Esc Exit fullscreen'
    : '← → Switch blocks · Esc Close';
  if (practiceFullscreen && document.fullscreenElement && !practice.open) document.exitFullscreen().catch(() => {});
  if (!document.fullscreenElement) practiceFullscreen = false;
});
desktopView.addEventListener('change', () => {
  if (!desktopView.matches) closePractice();
});

function clearPrintSelection() {
  blocks.classList.remove('printing-block');
  blocks.querySelector('.print-selected')?.classList.remove('print-selected');
}

// The dialog may be asynchronous, so keep the selection until it closes.
window.addEventListener('afterprint', clearPrintSelection);

blocks.addEventListener('click', (event) => {
  const expand = event.target.closest('.expand-button');
  if (expand) {
    openPractice(expand.closest('.block'), expand);
    return;
  }
  const print = event.target.closest('.print-button');
  if (print) {
    if (!printingEnabled) return;
    clearPrintSelection();
    print.closest('.block').classList.add('print-selected');
    blocks.classList.add('printing-block');
    try {
      window.print();
    } catch (error) {
      clearPrintSelection();
      document.querySelector('#status').textContent = 'Printing could not open. Try your browser’s Print command.';
    }
    return;
  }
  const randomize = event.target.closest('.randomize-button');
  if (randomize) {
    rhythmStarted = true;
    const block = randomize.closest('.block');
    randomizeBlock(block);
    updateBlocks();
    document.querySelector('#status').textContent = `Block ${[...blocks.children].indexOf(block) + 1} randomized.`;
  }
  const slot = event.target.closest('.slot');
  if (slot) {
    rhythmStarted = true;
    slot.dataset.state = String((Number(slot.dataset.state) + 1) % 4);
    const block = slot.closest('.block');
    describeSlot(slot, [...blocks.children].indexOf(block), [...block.querySelectorAll('.slot')].indexOf(slot));
  }
  const remove = event.target.closest('.remove-button');
  if (remove && blocks.children.length > 1) {
    const block = remove.closest('.block');
    const next = block.nextElementSibling || block.previousElementSibling;
    block.remove();
    updateBlocks();
    next.querySelector('.slot').focus();
    document.querySelector('#status').textContent = 'Block removed. Counts updated.';
  }
});
addButton.addEventListener('click', () => addBlock(true));
clearButton.addEventListener('click', () => {
  clearPrintSelection();
  blocks.replaceChildren();
  rhythmStarted = false;
  addBlock();
  blocks.querySelector('.slot').focus();
  document.querySelector('#status').textContent = 'Rhythm cleared. One empty block ready.';
});
randomButton?.addEventListener('click', () => addBlock(true, true));
sequenceButton?.addEventListener('click', () => {
  if (!rhythmStarted) {
    clearPrintSelection();
    blocks.replaceChildren();
  }
  const firstNewBlock = blocks.children.length;
  for (let index = 0; index < 3; index++) addBlock(false, true);
  rhythmStarted = true;
  blocks.children[firstNewBlock].querySelector('.slot').focus();
  document.querySelector('#status').textContent = 'Six random counts generated as three two-beat blocks.';
});
// Version 1: six base-4 digits per block, in display order. The fragment stays
// in the browser and is never included in HTTP requests to the static host.
const maxSharedBlocks = 1000;

function rhythmFromHash(hash) {
  if (!hash.startsWith('#rhythm=')) return null;
  const payload = hash.slice('#rhythm='.length);
  if (!payload.startsWith('1.') || payload.length > 2 + maxSharedBlocks * 6) {
    throw new Error('Unsupported or oversized rhythm');
  }
  const states = payload.slice(2);
  if (!states.length || states.length % 6 !== 0 || /[^0-3]/.test(states)) {
    throw new Error('Invalid rhythm');
  }
  return states.match(/.{6}/g);
}

function loadSharedRhythm() {
  try {
    const sharedBlocks = rhythmFromHash(window.location.hash);
    if (!sharedBlocks) return;
    closePractice();
    clearPrintSelection();
    blocks.replaceChildren();
    sharedBlocks.forEach(states => addBlock(false, false, states, false));
    updateBlocks();
    safeModeSwitch.checked = sharedBlocks.every(states =>
      presetSets.Basics.some(preset => preset.states === states));
    // Even an empty shared rhythm is an intentional rhythm, not a fresh sheet.
    rhythmStarted = true;
    document.querySelector('#share-result').hidden = true;
    document.querySelector('#status').textContent = 'Shared rhythm loaded. You can edit it and share your own copy.'
      + (safeModeSwitch.checked ? ' Safe mode selected: every block matches a Basics preset.' : ' Safe mode off.');
  } catch (error) {
    document.querySelector('#status').textContent = 'This rhythm link is invalid, unsupported, or too large. Your current rhythm has not been changed.';
  }
}

async function copyRhythmLink(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Try selected-text copying when the asynchronous API is blocked.
    }
  }
  const previousFocus = document.activeElement;
  const copyField = document.createElement('textarea');
  copyField.value = text;
  copyField.readOnly = true;
  // It must remain rendered and selectable for Firefox's copy command.
  copyField.style.cssText = 'position:fixed;left:-9999px;top:0;';
  document.body.append(copyField);
  try {
    copyField.focus({ preventScroll: true });
    copyField.select();
    return document.execCommand('copy');
  } catch (error) {
    return false;
  } finally {
    copyField.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

document.querySelector('#share-rhythm').addEventListener('click', async () => {
  const status = document.querySelector('#status');
  if (blocks.children.length > maxSharedBlocks) {
    status.textContent = `Share links support up to ${maxSharedBlocks} blocks. Remove some blocks and try again.`;
    return;
  }
  const states = [...blocks.querySelectorAll('.slot')].map(slot => slot.dataset.state).join('');
  const url = new URL(window.location.href);
  url.hash = `rhythm=1.${states}`;
  const field = document.querySelector('#share-url');
  const result = document.querySelector('#share-result');
  field.value = url.href;
  result.hidden = true;
  if (url.protocol === 'file:') {
    status.textContent = 'This link points to a file on your device. Open the hosted app to create a link that other people can use.';
    return;
  }
  status.textContent = 'Copying rhythm link…';
  if (await copyRhythmLink(url.href)) {
    status.textContent = 'Rhythm link copied. Paste it to share your rhythm.';
  } else {
    result.hidden = false;
    field.focus();
    field.select();
    status.textContent = 'Copy the selected link to share your rhythm. Automatic copying is unavailable in this browser.';
  }
});
document.querySelector('#share-url').addEventListener('click', event => event.target.select());
window.addEventListener('hashchange', loadSharedRhythm);
addBlock();
loadSharedRhythm();
