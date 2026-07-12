const test = require("node:test");
const assert = require("node:assert/strict");

const { isEligible, scoreAction, selectTopAction } = require("../src/action-priority.js");

const message = {
  key: "message",
  requires: { hasConsentDb: true },
  spendsMoney: false,
  impact: 80,
  urgency: 70,
  feasibility: 90,
  lowCost: 90,
  confidenceScore: 90,
};

const ads = {
  key: "ads",
  requires: { capacity: "yes" },
  spendsMoney: true,
  impact: 90,
  urgency: 80,
  feasibility: 60,
  lowCost: 20,
  confidenceScore: 30,
};

const local = {
  key: "local",
  requires: { capacity: "yes" },
  spendsMoney: false,
  impact: 65,
  urgency: 70,
  feasibility: 85,
  lowCost: 90,
  confidenceScore: 80,
};

test("consent-gated actions are ineligible without consent", () => {
  assert.equal(isEligible(message, { hasConsentDb: false }), false);
});

test("low-confidence paid actions are ineligible", () => {
  assert.equal(isEligible(ads, { capacity: "yes" }), false);
});

test("selection ranks only eligible candidates", () => {
  assert.equal(selectTopAction([message, ads, local], { hasConsentDb: false, capacity: "yes" }).key, "local");
  assert.equal(scoreAction(local), 74.75);
});
