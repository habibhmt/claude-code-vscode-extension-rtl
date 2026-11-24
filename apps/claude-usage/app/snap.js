'use strict';
// Snap the floating panel to the nearest screen edge, minimap-style.
// Pure function so it can be tested without Electron: give it the window
// bounds and the display's work area, get back the snapped top-left corner.
const MARGIN = 2; // a hairline gap so the rounded border stays visible

function snapToEdges(bounds, workArea, threshold = 28) {
  const { width: w, height: h } = bounds;
  let x = bounds.x;
  let y = bounds.y;

  const left = workArea.x + MARGIN;
  const right = workArea.x + workArea.width - w - MARGIN;
  const top = workArea.y + MARGIN;
  const bottom = workArea.y + workArea.height - h - MARGIN;

  // horizontal: pick whichever vertical edge is nearer, if it is within reach
  const dLeft = Math.abs(x - left);
  const dRight = Math.abs(x - right);
  if (dLeft <= threshold && dLeft <= dRight) x = left;
  else if (dRight <= threshold) x = right;

  // vertical: same for the menu-bar and dock edges
  const dTop = Math.abs(y - top);
  const dBottom = Math.abs(y - bottom);
  if (dTop <= threshold && dTop <= dBottom) y = top;
  else if (dBottom <= threshold) y = bottom;

  return { x: Math.round(x), y: Math.round(y) };
}

module.exports = { snapToEdges, MARGIN };
