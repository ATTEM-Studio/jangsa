const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateStorefrontScore,
  calculateTargetScore,
} = require("../src/storefront-score.js");

const items = [
  { key: "keywords", category: "discovery", maxPoints: 20, state: "pass", reason: "keywords confirmed" },
  { key: "coverPhoto", category: "conversion", maxPoints: 20, state: "partial", reason: "cover photo can improve" },
  { key: "reviews", category: "trust", maxPoints: 20, state: "fail", reason: "recent reviews missing" },
  { key: "description", category: "content", maxPoints: 20, state: "unknown", reason: "needs confirmation" },
  { key: "recentActivity", category: "activity", maxPoints: 20, state: "pass", reason: "recent activity confirmed" },
];

test("unknown items are excluded from the denominator", () => {
  const result = calculateStorefrontScore(items);
  assert.equal(result.knownMaxPoints, 80);
  assert.equal(result.earnedPoints, 50);
  assert.equal(result.score, 63);
  assert.equal(result.coverage, 0.8);
  assert.equal(result.visible, true);
});

test("coverage below 60 percent hides the total score", () => {
  const result = calculateStorefrontScore(
    items.map((item, index) => (index < 2 ? item : { ...item, state: "unknown" })),
  );
  assert.equal(result.coverage, 0.4);
  assert.equal(result.visible, false);
  assert.equal(result.score, null);
});

test("target score only adds recoverable missing points", () => {
  const result = calculateStorefrontScore(items);
  assert.deepEqual(calculateTargetScore(result, ["coverPhoto", "reviews", "missing"]), {
    current: 63,
    target: 100,
    gain: 37,
    recovered: ["coverPhoto", "reviews"],
  });
});
