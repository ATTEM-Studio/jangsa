const test = require("node:test");
const assert = require("node:assert/strict");

const { presentDiagnosis } = require("../src/diagnosis-presenter.js");

test("presenter keeps storefront score and business bottleneck separate", () => {
  const view = presentDiagnosis({
    businessResult: {
      input: { storeName: "Dori Restaurant", currentRevenue: 10_000_000 },
      metrics: { shortfallRevenue: 5_000_000, requiredCustomersPerDay: 8 },
      action: {
        key: "localDiscovery",
        title: "Improve why customers choose you in local search",
        summary: "The first screen needs stronger proof.",
        why: "You need about 8 more customers per day.",
        steps: ["Select photos", "Revise description", "Track responses"],
        metric: "Search conversion",
        avoid: "Do not start by increasing ad spend.",
      },
      confidence: {
        level: "medium",
        label: "Some estimates included",
        reasons: ["Customer count is estimated from average order value."],
      },
      assumptions: ["Check response for 7 days."],
    },
    storefrontScore: { visible: true, score: 74, coverage: 0.86, categories: [], items: [] },
    targetScore: { current: 74, target: 83, gain: 9, recovered: ["coverPhoto"] },
    observationMap: {
      coverPhoto: { source: "owner", status: "confirmed", evidence: "Owner confirmed." },
    },
  });

  assert.equal(view.storefront.score, 74);
  assert.equal(view.bottleneck.requiredCustomersPerDay, 8);
  assert.equal(view.target.target, 83);
  assert.equal(view.evidence.observations.length, 1);
  assert.equal(view.safeShare.includes("10000000"), false);
});
