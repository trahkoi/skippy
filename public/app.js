const blocks = document.querySelector('#blocks');
const template = document.querySelector('#block-template');
const addButton = document.querySelector('#add-block');
const randomButton = document.querySelector('#random-block');
const sequenceButton = document.querySelector('#random-six-counts');
let rhythmStarted = false;
const printingEnabled = new URLSearchParams(window.location.search).get('print') === '1';
document.querySelector('#print-help').hidden = !printingEnabled;
const actions = ['empty', 'step', 'hop', 'action without weight change'];
// Probability of a symbol at each position: & a 1 & a 2.
const actionProbabilities = [0.05, 0.4, 1, 0.2, 0.6, 1];
const actionWeights = { step: 6, 'action without weight change': 3, hop: 1 };
const symbols = { small: ['', '•', '∘', '\\'], large: ['', '●', '◯', '\\'] };

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
  slots.forEach((slot, index) => {
    const hasAction = Math.random() < actionProbabilities[index];
    slot.dataset.state = hasAction
      ? String(randomActionState())
      : '0';
  });
}

function addBlock(focus = false, randomize = false) {
  const block = template.content.firstElementChild.cloneNode(true);
  block.querySelector('.print-button').hidden = !printingEnabled;
  const positions = block.querySelector('.positions');
  for (let index = 0; index < 6; index++) {
    const position = document.createElement('div');
    position.className = `position${index % 3 === 2 ? ' is-count' : ''}`;
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'slot';
    slot.dataset.state = '0';
    const label = document.createElement('span');
    label.className = 'count';
    label.setAttribute('aria-hidden', 'true');
    position.append(slot, label);
    positions.append(position);
  }
  blocks.append(block);
  if (randomize) randomizeBlock(block);
  updateBlocks();
  if (focus) {
    rhythmStarted = true;
    block.querySelector('.slot').focus();
    document.querySelector('#status').textContent = `Block ${blocks.children.length} added${randomize ? ' with randomized actions' : ''}.`;
  }
}

function clearPrintSelection() {
  blocks.classList.remove('printing-block');
  blocks.querySelector('.print-selected')?.classList.remove('print-selected');
}

// The dialog may be asynchronous, so keep the selection until it closes.
window.addEventListener('afterprint', clearPrintSelection);

blocks.addEventListener('click', (event) => {
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
addBlock();
