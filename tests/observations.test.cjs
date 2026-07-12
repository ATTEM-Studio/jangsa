const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createObservation,
  resolveObservations,
  summarizeObservationCoverage,
} = require("../src/observations.js");

test("owner-confirmed values override collector values without deleting evidence", () => {
  const resolved = resolveObservations([
    createObservation({
      key: "reservation",
      value: false,
      source: "collector",
      confidence: "medium",
      status: "inferred",
      evidence: "reservation button not found",
      observedAt: "2026-07-12T00:00:00.000Z",
    }),
    createObservation({
      key: "reservation",
      value: true,
      source: "owner",
      confidence: "high",
      status: "confirmed",
      evidence: "owner confirmed reservation",
      observedAt: "2026-07-12T00:01:00.000Z",
    }),
  ]);

  assert.equal(resolved.reservation.value, true);
  assert.equal(resolved.reservation.source, "owner");
});

test("unknown observations do not count as known coverage", () => {
  const resolved = resolveObservations([
    createObservation({
      key: "menu",
      value: true,
      source: "collector",
      confidence: "high",
      status: "confirmed",
      evidence: "menu has 12 items",
      observedAt: "2026-07-12T00:00:00.000Z",
    }),
    createObservation({
      key: "coupon",
      value: null,
      source: "collector",
      confidence: "low",
      status: "unknown",
      evidence: "coupon unavailable",
      observedAt: "2026-07-12T00:00:00.000Z",
    }),
  ]);

  assert.deepEqual(summarizeObservationCoverage(resolved, ["menu", "coupon"]), {
    known: 1,
    total: 2,
    ratio: 0.5,
  });
});

test("an owner unknown answer does not erase a known collector value", () => {
  const resolved = resolveObservations([
    createObservation({
      key: "menu",
      value: true,
      source: "collector",
      confidence: "high",
      status: "confirmed",
      evidence: "menu has 12 items",
      observedAt: "2026-07-12T00:00:00.000Z",
    }),
    createObservation({
      key: "menu",
      value: null,
      source: "owner",
      confidence: "low",
      status: "unknown",
      evidence: "owner unsure",
      observedAt: "2026-07-12T00:01:00.000Z",
    }),
  ]);

  assert.equal(resolved.menu.value, true);
  assert.equal(resolved.menu.source, "collector");
});
