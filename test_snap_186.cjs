// Edge snapping of the 186 floating panel: pure function, no Electron needed.
// Run: node test_snap_186.cjs
const assert = require('node:assert/strict');
const { snapToEdges, MARGIN } = require('./186-montaghel/app/snap.js');

const area = { x: 0, y: 25, width: 1440, height: 875 }; // menu bar on top
const win = { width: 190, height: 118 };
const bounds = (x, y) => ({ x, y, ...win });

// 6px from the left edge, middle height ⇒ only x sticks
assert.deepEqual(snapToEdges(bounds(6, 400), area), { x: MARGIN, y: 400 });
// 9px from the right edge ⇒ x snaps to right minus width
assert.deepEqual(snapToEdges(bounds(1440 - 190 - 9, 400), area), { x: 1440 - 190 - MARGIN, y: 400 });
// 3px below the menu bar ⇒ y sticks to the top, x untouched
assert.deepEqual(snapToEdges(bounds(600, 28), area), { x: 600, y: 25 + MARGIN });
// 12px above the dock edge ⇒ y sticks to the bottom
assert.deepEqual(snapToEdges(bounds(600, 25 + 875 - 118 - 12), area), { x: 600, y: 25 + 875 - 118 - MARGIN });
// corner: both axes stick at once
assert.deepEqual(snapToEdges(bounds(5, 26), area), { x: MARGIN, y: 25 + MARGIN });

// far from every edge ⇒ untouched
assert.deepEqual(snapToEdges(bounds(500, 300), area), { x: 500, y: 300 });

// threshold is the thing that decides: with 0 nothing sticks, with 28 it does.
assert.deepEqual(snapToEdges(bounds(10, 300), area, 0), { x: 10, y: 300 });
assert.deepEqual(snapToEdges(bounds(10, 300), area, 28), { x: MARGIN, y: 300 });

// right edge is preferred when both are somehow in reach (left wins ties, it is first)
assert.deepEqual(snapToEdges(bounds(3, 300), area), { x: MARGIN, y: 300 });

// a second display starts at x=1440; its own work area is used, not the primary's
const second = { x: 1440, y: 25, width: 1920, height: 1055 };
assert.deepEqual(snapToEdges(bounds(1450, 400), second), { x: 1440 + MARGIN, y: 400 });

console.log('PASS');
