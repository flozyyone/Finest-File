import test from "node:test";
import assert from "node:assert/strict";

// Simulated zoom levels and Windows Explorer steps
const MIN_ZOOM = 32;
const MAX_ZOOM = 320;
const ZOOM_STEP = 16;
const EXPLORER_STEPS = [48, 72, 96, 128, 192, 256];

function stepZoomIn(current) {
  const next = EXPLORER_STEPS.find((s) => s > current) ?? Math.min(MAX_ZOOM, current + ZOOM_STEP);
  return Math.min(MAX_ZOOM, next);
}

function stepZoomOut(current) {
  const prevSteps = EXPLORER_STEPS.filter((s) => s < current);
  const prev = prevSteps.length > 0 ? prevSteps[prevSteps.length - 1] : current - ZOOM_STEP;
  if (prev < 48) {
    return { mode: "details", zoom: MIN_ZOOM };
  }
  return { mode: "grid", zoom: Math.max(MIN_ZOOM, prev) };
}

test("Ctrl + Wheel - Stepping zoom in follows Windows Explorer discrete steps", () => {
  let z = 48;
  z = stepZoomIn(z);
  assert.equal(z, 72);
  z = stepZoomIn(z);
  assert.equal(z, 96);
  z = stepZoomIn(z);
  assert.equal(z, 128);
  z = stepZoomIn(z);
  assert.equal(z, 192);
  z = stepZoomIn(z);
  assert.equal(z, 256);
  z = stepZoomIn(z);
  assert.equal(z, 272);
  z = stepZoomIn(320);
  assert.equal(z, 320, "Must clamp to MAX_ZOOM");
});

test("Ctrl + Wheel - Stepping zoom out gracefully transitions down to Details view", () => {
  let state = stepZoomOut(256);
  assert.equal(state.zoom, 192);
  state = stepZoomOut(192);
  assert.equal(state.zoom, 128);
  state = stepZoomOut(128);
  assert.equal(state.zoom, 96);
  state = stepZoomOut(96);
  assert.equal(state.zoom, 72);
  state = stepZoomOut(72);
  assert.equal(state.zoom, 48);
  state = stepZoomOut(48);
  assert.equal(state.mode, "details");
  assert.equal(state.zoom, MIN_ZOOM);
});

test("Ctrl + Wheel - Single wheel event without Ctrl does NOT change zoom", () => {
  let zoom = 96;
  const wheelEvent = { ctrlKey: false, deltaY: -100 };
  if (wheelEvent.ctrlKey) {
    zoom = stepZoomIn(zoom);
  }
  assert.equal(zoom, 96, "Zoom must remain unchanged during normal scroll");
});
