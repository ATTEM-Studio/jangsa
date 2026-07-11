# Explainable Diagnosis Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, explainable diagnosis core that separates externally observable storefront readiness from internal business bottlenecks and turns both into one feasible action, a traceable target score, and a 3/7-day check-in.

**Architecture:** Keep the existing static, framework-free application. Add small UMD modules for observation resolution, storefront scoring, action ranking, and diagnosis presentation; the existing rule engine remains responsible for business metrics and action content. The UI consumes one presenter model, while future collectors only need to emit the documented observation contract.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript UMD modules, Node.js 20+, `node:test`, `happy-dom`, static GitHub Pages build.

## Global Constraints

- Do not add runtime dependencies or a frontend framework.
- Unknown observations are excluded from the score denominator; they never receive zero points.
- Hide the total storefront score when weighted coverage is below 60% and show `정보 추가 필요`.
- Only storefront readiness is scored out of 100; internal business data is presented as a bottleneck, not averaged into that score.
- Target score equals current score plus recoverable missing points from the selected actions, capped at 100.
- Do not display an industry average until a valid same-industry sample contains at least 30 stores using the same score version and data from the last 90 days.
- Recommendations requiring consent, capacity, menu changes, or paid spend must pass their prerequisites first.
- A low-confidence recommendation must not require substantial spend.
- Keep all existing v11 business-metric tests passing.
- Do not claim guaranteed revenue, guaranteed rank, or unsupported percentile standing.
- Never put raw revenue or advertising values in shared URLs or share cards.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/observations.js` | Create, resolve, and summarize automatic/owner/calculated observations. |
| `src/storefront-score.js` | Calculate category scores, coverage, total score, missing points, and target score. |
| `src/action-priority.js` | Enforce prerequisites and rank feasible actions with confidence included. |
| `src/diagnosis-presenter.js` | Convert engine, score, and observation output into one stable UI model. |
| `src/ui-logic.js` | Validate link/manual inputs and transform confirmation form values. |
| `src/engine.js` | Preserve business calculations while attaching explicit action conditions and priority factors. |
| `src/app.js` | Manage the link/manual/confirmation/questions/results/check-in flow. |
| `index.html` | Add intake, analysis status, confirmation, score, bottleneck, target, and CTA containers. |
| `assets/styles.css` | Responsive states for progress, confidence, score coverage, categories, and CTA hierarchy. |
| `tests/observations.test.cjs` | Observation precedence, status, and source tests. |
| `tests/storefront-score.test.cjs` | Score, coverage, unknown, and target tests. |
| `tests/action-priority.test.cjs` | Eligibility and ranking tests. |
| `tests/diagnosis-presenter.test.cjs` | Result-model and safe-copy tests. |
| `tests/ui-logic.test.cjs` | Intake and confirmation validation tests. |
| `tests/app.integration.test.cjs` | Complete success, fallback, low-coverage, result, and check-in flows. |
| `scripts/build-static.cjs` | Include new modules in the static build without changing build behavior. |

---

### Task 1: Observation Contract and Owner-Confirmation Precedence

**Files:**
- Create: `src/observations.js`
- Create: `tests/observations.test.cjs`
- Modify: `index.html`
- Modify: `scripts/build-static.cjs`

**Interfaces:**
- Produces: `createObservation(input) -> Observation`
- Produces: `resolveObservations(observations) -> Record<string, Observation>`
- Produces: `summarizeObservationCoverage(observationMap, keys) -> { known, total, ratio }`
- Observation fields: `{ key, value, source, confidence, observedAt, status, evidence }`

- [ ] **Step 1: Write failing observation tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createObservation,
  resolveObservations,
  summarizeObservationCoverage,
} = require("../src/observations.js");

test("owner-confirmed values override collector values without deleting evidence", () => {
  const resolved = resolveObservations([
    createObservation({ key: "reservation", value: false, source: "collector", confidence: "medium", status: "inferred", evidence: "예약 버튼 미발견", observedAt: "2026-07-12T00:00:00.000Z" }),
    createObservation({ key: "reservation", value: true, source: "owner", confidence: "high", status: "confirmed", evidence: "사장님 확인", observedAt: "2026-07-12T00:01:00.000Z" }),
  ]);

  assert.equal(resolved.reservation.value, true);
  assert.equal(resolved.reservation.source, "owner");
});

test("unknown observations do not count as known coverage", () => {
  const resolved = resolveObservations([
    createObservation({ key: "menu", value: true, source: "collector", confidence: "high", status: "confirmed", evidence: "메뉴 12개", observedAt: "2026-07-12T00:00:00.000Z" }),
    createObservation({ key: "coupon", value: null, source: "collector", confidence: "low", status: "unknown", evidence: "확인 불가", observedAt: "2026-07-12T00:00:00.000Z" }),
  ]);

  assert.deepEqual(summarizeObservationCoverage(resolved, ["menu", "coupon"]), { known: 1, total: 2, ratio: 0.5 });
});

test("an owner unknown answer does not erase a known collector value", () => {
  const resolved = resolveObservations([
    createObservation({ key: "menu", value: true, source: "collector", confidence: "high", status: "confirmed", evidence: "메뉴 12개", observedAt: "2026-07-12T00:00:00.000Z" }),
    createObservation({ key: "menu", value: null, source: "owner", confidence: "low", status: "unknown", evidence: "잘 모르겠음", observedAt: "2026-07-12T00:01:00.000Z" }),
  ]);
  assert.equal(resolved.menu.value, true);
  assert.equal(resolved.menu.source, "collector");
});
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run: `node --test tests/observations.test.cjs`

Expected: FAIL with `Cannot find module '../src/observations.js'`.

- [ ] **Step 3: Implement the observation module**

```js
(function initJangsaObservations(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaObservations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createObservationApi() {
  "use strict";

  const SOURCES = new Set(["collector", "owner", "calculated"]);
  const CONFIDENCES = new Set(["high", "medium", "low"]);
  const STATUSES = new Set(["confirmed", "inferred", "unknown", "unavailable"]);
  const sourcePriority = { collector: 1, calculated: 2, owner: 3 };
  const statusPriority = { unavailable: 0, unknown: 0, inferred: 1, confirmed: 2 };

  function createObservation(input) {
    if (!input || !String(input.key || "").trim()) throw new TypeError("관측값 key가 필요합니다.");
    if (!SOURCES.has(input.source)) throw new TypeError("지원하지 않는 관측값 source입니다.");
    if (!CONFIDENCES.has(input.confidence)) throw new TypeError("지원하지 않는 관측값 confidence입니다.");
    if (!STATUSES.has(input.status)) throw new TypeError("지원하지 않는 관측값 status입니다.");
    return Object.freeze({
      key: String(input.key),
      value: input.value,
      source: input.source,
      confidence: input.confidence,
      observedAt: String(input.observedAt),
      status: input.status,
      evidence: String(input.evidence || ""),
    });
  }

  function resolveObservations(observations) {
    return observations.reduce((resolved, observation) => {
      const current = resolved[observation.key];
      const currentPriority = current ? sourcePriority[current.source] : 0;
      const nextPriority = sourcePriority[observation.source];
      const currentStatus = current ? statusPriority[current.status] : -1;
      const nextStatus = statusPriority[observation.status];
      if (!current || nextStatus > currentStatus || (nextStatus === currentStatus && (nextPriority > currentPriority || (nextPriority === currentPriority && observation.observedAt >= current.observedAt)))) {
        resolved[observation.key] = observation;
      }
      return resolved;
    }, {});
  }

  function summarizeObservationCoverage(observationMap, keys) {
    const known = keys.filter((key) => {
      const item = observationMap[key];
      return item && (item.status === "confirmed" || item.status === "inferred");
    }).length;
    return { known, total: keys.length, ratio: keys.length ? known / keys.length : 0 };
  }

  return { createObservation, resolveObservations, summarizeObservationCoverage };
});
```

- [ ] **Step 4: Load the module before UI modules and include it in static builds**

Add before `src/engine.js` in `index.html`:

```html
<script src="src/observations.js"></script>
```

Do not change `DIRECTORIES`; the entire `src` directory is already copied. Add a build assertion to `tests/build.test.cjs`:

```js
assert.equal(fs.existsSync(path.join(outDir, "src", "observations.js")), true);
```

- [ ] **Step 5: Run focused and build tests**

Run: `node --test tests/observations.test.cjs tests/build.test.cjs`

Expected: PASS.

- [ ] **Step 6: Commit the observation contract**

```bash
git add src/observations.js tests/observations.test.cjs tests/build.test.cjs index.html
git commit -m "feat: add explainable observation contract"
```

---

### Task 2: Storefront Score, Coverage Gate, and Target Score

**Files:**
- Create: `src/storefront-score.js`
- Create: `tests/storefront-score.test.cjs`
- Modify: `index.html`
- Modify: `tests/build.test.cjs`

**Interfaces:**
- Consumes: `Record<string, Observation>` from Task 1.
- Produces: `STOREFRONT_RULES`, the stable v1 category and item catalog.
- Produces: `buildScoreItems(observationMap) -> ScoreItem[]`.
- Produces: `calculateStorefrontScore(scoreItems) -> StorefrontScoreResult`
- Produces: `calculateTargetScore(scoreResult, recoverableKeys) -> { current, target, gain, recovered }`
- `StorefrontScoreResult`: `{ visible, score, coverage, earnedPoints, knownMaxPoints, totalMaxPoints, categories, items }`

- [ ] **Step 1: Write failing scoring tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateStorefrontScore, calculateTargetScore } = require("../src/storefront-score.js");

const items = [
  { key: "keywords", category: "discovery", maxPoints: 20, state: "pass", reason: "대표키워드 확인" },
  { key: "coverPhoto", category: "conversion", maxPoints: 20, state: "partial", reason: "대표사진 개선 가능" },
  { key: "reviews", category: "trust", maxPoints: 20, state: "fail", reason: "최근 리뷰 부족" },
  { key: "description", category: "content", maxPoints: 20, state: "unknown", reason: "확인 불가" },
  { key: "recentActivity", category: "activity", maxPoints: 20, state: "pass", reason: "최근 소식 확인" },
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
  const result = calculateStorefrontScore(items.map((item, index) => index < 2 ? item : { ...item, state: "unknown" }));
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
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/storefront-score.test.cjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement score calculations**

```js
(function initStorefrontScore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaStorefrontScore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createScoreApi() {
  "use strict";

  const STATE_FACTOR = { pass: 1, partial: 0.5, fail: 0, unknown: null };
  const STOREFRONT_RULES = [
    ["businessCategory", "discovery", 4], ["address", "discovery", 3], ["directions", "discovery", 3], ["keywords", "discovery", 5], ["businessHours", "discovery", 2], ["contact", "discovery", 3],
    ["coverPhoto", "conversion", 5], ["menu", "conversion", 5], ["prices", "conversion", 3], ["reservation", "conversion", 4], ["order", "conversion", 3], ["inquiry", "conversion", 2], ["coupon", "conversion", 3],
    ["reviewVolume", "trust", 4], ["reviewRecency", "trust", 4], ["reviewQuality", "trust", 4], ["ownerReplies", "trust", 4], ["photoReviews", "trust", 2], ["negativeResponse", "trust", 2],
    ["description", "content", 5], ["menuDescriptions", "content", 4], ["photoDiversity", "content", 4], ["uniqueValue", "content", 3], ["recentPosts", "content", 4],
    ["profileUpdated", "activity", 3], ["reservationSlots", "activity", 3], ["replySpeed", "activity", 3], ["recentPostActivity", "activity", 3], ["featureHealth", "activity", 3],
  ].map(([key, category, maxPoints]) => Object.freeze({ key, category, maxPoints }));

  function buildScoreItems(observationMap) {
    return STOREFRONT_RULES.map((rule) => {
      const observation = observationMap[rule.key];
      const state = !observation || ["unknown", "unavailable"].includes(observation.status)
        ? "unknown"
        : ["pass", "partial", "fail"].includes(observation.value)
          ? observation.value
          : observation.value === true ? "pass" : observation.value === false ? "fail" : "unknown";
      return { ...rule, state, reason: observation?.evidence || "확인되지 않음" };
    });
  }

  function calculateStorefrontScore(scoreItems) {
    const items = scoreItems.map((item) => {
      const factor = STATE_FACTOR[item.state];
      if (factor === undefined) throw new TypeError(`지원하지 않는 점수 상태: ${item.state}`);
      return { ...item, earnedPoints: factor === null ? null : item.maxPoints * factor };
    });
    const totalMaxPoints = items.reduce((sum, item) => sum + item.maxPoints, 0);
    const known = items.filter((item) => item.earnedPoints !== null);
    const knownMaxPoints = known.reduce((sum, item) => sum + item.maxPoints, 0);
    const earnedPoints = known.reduce((sum, item) => sum + item.earnedPoints, 0);
    const coverage = totalMaxPoints ? knownMaxPoints / totalMaxPoints : 0;
    const visible = coverage >= 0.6;
    const score = visible && knownMaxPoints ? Math.round((earnedPoints / knownMaxPoints) * 100) : null;
    const categories = Object.values(items.reduce((result, item) => {
      const category = result[item.category] || { key: item.category, earnedPoints: 0, knownMaxPoints: 0, totalMaxPoints: 0 };
      category.totalMaxPoints += item.maxPoints;
      if (item.earnedPoints !== null) {
        category.earnedPoints += item.earnedPoints;
        category.knownMaxPoints += item.maxPoints;
      }
      result[item.category] = category;
      return result;
    }, {})).map((category) => ({
      ...category,
      score: category.knownMaxPoints ? Math.round((category.earnedPoints / category.knownMaxPoints) * 100) : null,
    }));
    return { visible, score, coverage, earnedPoints, knownMaxPoints, totalMaxPoints, categories, items };
  }

  function calculateTargetScore(scoreResult, recoverableKeys) {
    if (!scoreResult.visible) return { current: null, target: null, gain: 0, recovered: [] };
    const recoverable = scoreResult.items.filter((item) => recoverableKeys.includes(item.key) && item.earnedPoints !== null && item.earnedPoints < item.maxPoints);
    const recoveredPoints = recoverable.reduce((sum, item) => sum + item.maxPoints - item.earnedPoints, 0);
    const normalizedGain = Math.round((recoveredPoints / scoreResult.knownMaxPoints) * 100);
    const target = Math.min(100, scoreResult.score + normalizedGain);
    return { current: scoreResult.score, target, gain: target - scoreResult.score, recovered: recoverable.map((item) => item.key) };
  }

  return { STOREFRONT_RULES, buildScoreItems, calculateStorefrontScore, calculateTargetScore };
});
```

- [ ] **Step 4: Load and build the module**

Add after `src/observations.js` in `index.html`:

```html
<script src="src/storefront-score.js"></script>
```

Add to `tests/build.test.cjs`:

```js
assert.equal(fs.existsSync(path.join(outDir, "src", "storefront-score.js")), true);
```

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/storefront-score.test.cjs tests/build.test.cjs`

Expected: PASS with three scoring tests and the build test.

- [ ] **Step 6: Commit scoring**

```bash
git add src/storefront-score.js tests/storefront-score.test.cjs tests/build.test.cjs index.html
git commit -m "feat: add transparent storefront scoring"
```

---

### Task 3: Feasibility and Confidence-Aware Action Ranking

**Files:**
- Create: `src/action-priority.js`
- Create: `tests/action-priority.test.cjs`
- Modify: `src/engine.js`
- Modify: `tests/engine.test.cjs`
- Modify: `index.html`

**Interfaces:**
- Produces: `isEligible(candidate, context) -> boolean`
- Produces: `scoreAction(candidate) -> number`
- Produces: `selectTopAction(candidates, context) -> candidate | null`
- Candidate factors are integers from 0 to 100: `impact`, `urgency`, `feasibility`, `lowCost`, `confidenceScore`.

- [ ] **Step 1: Write failing eligibility and ranking tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { isEligible, scoreAction, selectTopAction } = require("../src/action-priority.js");

const message = { key: "message", requires: { hasConsentDb: true }, spendsMoney: false, impact: 80, urgency: 70, feasibility: 90, lowCost: 90, confidenceScore: 90 };
const ads = { key: "ads", requires: { capacity: "yes" }, spendsMoney: true, impact: 90, urgency: 80, feasibility: 60, lowCost: 20, confidenceScore: 30 };
const local = { key: "local", requires: { capacity: "yes" }, spendsMoney: false, impact: 65, urgency: 70, feasibility: 85, lowCost: 90, confidenceScore: 80 };

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
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/action-priority.test.cjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement action ranking**

```js
(function initActionPriority(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaActionPriority = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createActionPriorityApi() {
  "use strict";

  function isEligible(candidate, context) {
    const requirements = candidate.requires || {};
    const requirementsPass = Object.entries(requirements).every(([key, value]) => context[key] === value);
    if (!requirementsPass) return false;
    if (candidate.spendsMoney && candidate.confidenceScore < 60) return false;
    return !(candidate.disqualify || []).some((rule) => context[rule.key] === rule.value);
  }

  function scoreAction(candidate) {
    return candidate.impact * 0.35
      + candidate.urgency * 0.2
      + candidate.feasibility * 0.2
      + candidate.lowCost * 0.1
      + candidate.confidenceScore * 0.15;
  }

  function selectTopAction(candidates, context) {
    const eligible = candidates.filter((candidate) => isEligible(candidate, context));
    return eligible.sort((a, b) => scoreAction(b) - scoreAction(a) || a.key.localeCompare(b.key))[0] || null;
  }

  return { isEligible, scoreAction, selectTopAction };
});
```

- [ ] **Step 4: Attach explicit factors and conditions to existing actions**

First, replace the `src/engine.js` wrapper so Node and browser execution receive the same dependency:

```js
(function initJangsaEngine(root, factory) {
  const priorityApi = typeof module !== "undefined" && module.exports
    ? require("./action-priority.js")
    : root.JangsaActionPriority;
  const api = factory(priorityApi);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createJangsaEngine(priorityApi) {
  "use strict";
```

Each action factory in `src/engine.js` must return the existing display fields plus this stable shape:

```js
priority: {
  impact: 80,
  urgency: 70,
  feasibility: 90,
  lowCost: 90,
  confidenceScore: 85,
},
requires: { canChangeMenu: true },
disqualify: [],
spendsMoney: false,
recoverableScoreItems: ["menu", "menuDescriptions"],
```

Use these exact conditions:

- `existingCustomer` and consent-based `repeat`: `requires: { hasConsentDb: true }`
- `aov`: `requires: { canChangeMenu: true }`
- `creatorTest` and paid acquisition actions: `requires: { capacity: "yes" }`, `spendsMoney: true`
- `localDiscovery`: `requires: { capacity: "yes" }`
- `dataCheck`, `repeatInStore`, and `profitDefense`: no consent requirement and `spendsMoney: false`

Keep `diagnoseStore()` output-compatible by routing every existing return branch through this helper. A branch may supply one or more context-appropriate candidates, but it must not supply candidates whose prerequisites are known to fail:

```js
function finalizeDiagnosis({ input, metrics, candidates, confidenceResult, assumptions }) {
  const rankedCandidates = candidates.map((action) => ({
    ...action,
    ...action.priority,
    requires: action.requires || {},
    disqualify: action.disqualify || [],
    spendsMoney: action.spendsMoney === true,
  }));
  const selected = priorityApi.selectTopAction(rankedCandidates, input);
  if (!selected) throw new Error("실행 가능한 추천 행동이 없습니다.");
  return {
    input,
    metrics,
    action: { ...selected, priorityScore: priorityApi.scoreAction(selected) },
    confidence: confidenceResult,
    assumptions,
  };
}
```

For example, replace the missing-field branch with:

```js
if (missing) {
  return finalizeDiagnosis({
    input,
    metrics,
    candidates: [dataCheckAction(missing)],
    confidenceResult: confidence("low", [`${missing[1]}가 필요합니다.`]),
    assumptions: [],
  });
}
```

Apply the same wrapper to every existing branch. When a branch has a safe fallback, pass both candidates, such as `[adScreenAction(input, metrics), localDiscoveryAction(metrics)]`; when only one action matches the context, pass one. The existing 36-case regression test is the acceptance criterion for candidate-set calibration.

Use these exact candidate sets in existing branch order:

| Branch | Candidate set |
|---|---|
| missing required field | `[dataCheckAction(missing)]` |
| target reached | `[profitDefenseAction(input, metrics)]` |
| repeat is the stated pain | consent DB: `[repeatAction(input)]`; otherwise `[repeatInStoreAction()]` |
| no capacity | menu change allowed: `[aovAction(metrics)]`; otherwise `[repeatInStoreAction()]` |
| margin pain and menu change allowed | `[aovAction(metrics)]` |
| ad pain and unsafe click range | `[adScreenAction(input, metrics), localDiscoveryAction(metrics)]` |
| customers pain, at most 3 needed daily, consent DB | `[existingCustomerAction(metrics)]` |
| customers pain, at least 8 needed daily, visual fit | `[creatorAction(metrics), localDiscoveryAction(metrics)]` |
| customers pain with capacity | `[localDiscoveryAction(metrics)]` |
| remaining menu-change case | `[aovAction(metrics)]` |
| remaining unsafe-ad case | `[adScreenAction(input, metrics)]` |
| remaining small-gap consent case | `[existingCustomerAction(metrics)]` |
| final fallback | no capacity: `[repeatInStoreAction()]`; otherwise `[localDiscoveryAction(metrics)]` |
```

- [ ] **Step 5: Extend engine regression tests**

Add to `tests/engine.test.cjs`:

```js
test("추천은 우선순위 요인과 회복 가능한 점수 항목을 제공한다", () => {
  const result = diagnoseStore(scenario({ painPoint: "margin", capacity: "no", canChangeMenu: true }));
  assert.equal(typeof result.action.priorityScore, "number");
  assert.ok(Array.isArray(result.action.recoverableScoreItems));
  assert.equal(result.action.requires.canChangeMenu, true);
});
```

- [ ] **Step 6: Load module before engine and run all engine tests**

Add before `src/engine.js`:

```html
<script src="src/action-priority.js"></script>
```

Run: `node --test tests/action-priority.test.cjs tests/engine.test.cjs`

Expected: PASS, including all 36 balanced v11 scenarios.

- [ ] **Step 7: Commit action ranking**

```bash
git add src/action-priority.js src/engine.js tests/action-priority.test.cjs tests/engine.test.cjs index.html
git commit -m "feat: rank only feasible diagnosis actions"
```

---

### Task 4: Stable Diagnosis Presenter and Safe Goal Model

**Files:**
- Create: `src/diagnosis-presenter.js`
- Create: `tests/diagnosis-presenter.test.cjs`
- Modify: `index.html`
- Modify: `tests/build.test.cjs`

**Interfaces:**
- Consumes: `{ businessResult, storefrontScore, targetScore, observationMap }`.
- Produces: `presentDiagnosis(input) -> DiagnosisViewModel`.
- `DiagnosisViewModel` contains `headline`, `action`, `storefront`, `bottleneck`, `target`, `evidence`, `safeShare`.

- [ ] **Step 1: Write failing presenter tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { presentDiagnosis } = require("../src/diagnosis-presenter.js");

test("presenter keeps storefront score and business bottleneck separate", () => {
  const view = presentDiagnosis({
    businessResult: {
      input: { storeName: "우리식당", currentRevenue: 10_000_000 },
      metrics: { shortfallRevenue: 5_000_000, requiredCustomersPerDay: 8 },
      action: { key: "localDiscovery", title: "지역 검색에서 선택받는 이유를 고치세요", summary: "대표 화면을 고칩니다.", why: "하루 8명이 더 필요합니다.", steps: ["사진 선택", "설명 수정", "반응 기록"], metric: "길찾기 수", avoid: "광고부터 늘리지 마세요" },
      confidence: { level: "medium", label: "일부 가정 포함", reasons: ["객단가로 손님 수를 추정했습니다."] },
      assumptions: ["7일간 반응을 확인합니다."],
    },
    storefrontScore: { visible: true, score: 74, coverage: 0.86, categories: [], items: [] },
    targetScore: { current: 74, target: 83, gain: 9, recovered: ["coverPhoto"] },
    observationMap: { coverPhoto: { source: "owner", status: "confirmed", evidence: "사장님 확인" } },
  });

  assert.equal(view.storefront.score, 74);
  assert.equal(view.bottleneck.requiredCustomersPerDay, 8);
  assert.equal(view.target.target, 83);
  assert.equal(view.safeShare.includes("10000000"), false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/diagnosis-presenter.test.cjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement presenter**

```js
(function initDiagnosisPresenter(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaDiagnosisPresenter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPresenterApi() {
  "use strict";

  function presentDiagnosis({ businessResult, storefrontScore, targetScore, observationMap }) {
    const { input, metrics, action, confidence, assumptions } = businessResult;
    const headline = storefrontScore.visible
      ? `${input.storeName}의 외부 매장 준비도는 ${storefrontScore.score}점입니다.`
      : `${input.storeName}은 점수보다 정보 확인이 먼저 필요합니다.`;
    const safeShare = [
      `[${input.storeName}] 오늘의 장사네비게이션`,
      storefrontScore.visible ? `매장 준비도 ${storefrontScore.score}점` : "매장 준비도 정보 추가 필요",
      action.title,
      `확인할 숫자: ${action.metric}`,
    ].join("\n");
    return {
      headline,
      action,
      storefront: storefrontScore,
      bottleneck: {
        shortfallRevenue: metrics.shortfallRevenue,
        requiredCustomersPerDay: metrics.requiredCustomersPerDay,
        label: action.why,
      },
      target: targetScore,
      evidence: {
        confidence,
        assumptions,
        observations: Object.values(observationMap),
      },
      safeShare,
    };
  }

  return { presentDiagnosis };
});
```

- [ ] **Step 4: Load and build the module**

Add after score and engine modules in `index.html`:

```html
<script src="src/diagnosis-presenter.js"></script>
```

Add a build assertion for `src/diagnosis-presenter.js`.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/diagnosis-presenter.test.cjs tests/build.test.cjs`

Expected: PASS.

- [ ] **Step 6: Commit presenter**

```bash
git add src/diagnosis-presenter.js tests/diagnosis-presenter.test.cjs tests/build.test.cjs index.html
git commit -m "feat: add safe diagnosis presentation model"
```

---

### Task 5: Link Intake, Honest Fallback, and Confirmation Input

**Files:**
- Modify: `src/ui-logic.js`
- Modify: `src/app.js`
- Modify: `tests/ui-logic.test.cjs`
- Modify: `tests/app.integration.test.cjs`
- Modify: `index.html`
- Modify: `assets/styles.css`

**Interfaces:**
- Produces: `normalizePlaceUrl(value) -> string | null`.
- Produces: `buildOwnerObservations(values, observedAt) -> Observation[]`.
- UI state values: `intake`, `analyzing`, `confirming`, `questions`, `result`.

- [ ] **Step 1: Write failing UI-logic tests**

```js
test("네이버 플레이스와 공유 링크만 정규화한다", () => {
  assert.equal(normalizePlaceUrl("https://naver.me/abc123"), "https://naver.me/abc123");
  assert.equal(normalizePlaceUrl("https://m.place.naver.com/restaurant/123/home"), "https://m.place.naver.com/restaurant/123/home");
  assert.equal(normalizePlaceUrl("https://example.com/store"), null);
});

test("사장님 확인값은 confirmed owner 관측값으로 변환한다", () => {
  const observations = buildOwnerObservations({ "confirm-coverPhoto": "pass", "confirm-reservation": "unknown" }, "2026-07-12T00:00:00.000Z");
  assert.deepEqual(observations.map(({ key, status, source }) => ({ key, status, source })), [
    { key: "coverPhoto", status: "confirmed", source: "owner" },
    { key: "reservation", status: "unknown", source: "owner" },
  ]);
});
```

Update the import destructuring in `tests/ui-logic.test.cjs` to include both functions.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/ui-logic.test.cjs`

Expected: FAIL because the two exports do not exist.

- [ ] **Step 3: Implement intake and confirmation transforms**

Add inside `src/ui-logic.js`:

```js
function normalizePlaceUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const supported = url.hostname === "naver.me"
      || url.hostname === "place.naver.com"
      || url.hostname === "m.place.naver.com";
    return supported && url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function buildOwnerObservations(values, observedAt = new Date().toISOString()) {
  return Object.entries(values)
    .filter(([name]) => name.startsWith("confirm-"))
    .map(([name, state]) => ({
      key: name.slice("confirm-".length),
      value: state === "pass" ? true : state === "partial" ? "partial" : state === "fail" ? false : null,
      source: "owner",
      confidence: state === "unknown" ? "low" : "high",
      observedAt,
      status: state === "unknown" ? "unknown" : "confirmed",
      evidence: state === "unknown" ? "사장님도 확인하지 못함" : "사장님 확인",
    }));
}
```

Export both functions.

- [ ] **Step 4: Add intake and confirmation sections to HTML**

Add before the existing diagnosis section:

```html
<section class="intake-section shell" id="intake">
  <div class="section-heading">
    <div><span class="section-kicker">2분 진단</span><h2>우리 가게 링크 하나로 시작하세요</h2></div>
  </div>
  <form id="place-intake-form" class="intake-card" novalidate>
    <label class="field-label" for="place-url">네이버 플레이스 URL 또는 공유 링크</label>
    <div class="intake-row">
      <input id="place-url" name="placeUrl" type="url" placeholder="https://naver.me/..." autocomplete="url" />
      <button class="button primary" type="submit">가게 확인하기</button>
    </div>
    <p id="place-url-error" class="field-error" hidden></p>
    <button class="text-button" type="button" id="manual-intake">링크 없이 직접 진단</button>
  </form>
</section>

<section class="analysis-section shell" id="analysis" hidden aria-live="polite">
  <h2>가게 정보를 확인하고 있어요</h2>
  <ol id="analysis-progress" class="analysis-progress"></ol>
</section>

<section class="confirmation-section shell" id="confirmation" hidden>
  <div class="section-heading"><div><span class="section-kicker">정보 확인</span><h2>이 정보가 맞나요?</h2></div></div>
  <form id="confirmation-form" class="confirmation-list"></form>
  <button class="button primary" type="button" id="confirm-storefront">맞아요, 경영 진단 시작</button>
</section>
```

- [ ] **Step 5: Add an honest static fallback flow**

Add to `src/app.js` after the existing DOM lookups:

```js
const intakeForm = document.getElementById("place-intake-form");
const analysisSection = document.getElementById("analysis");
const confirmationSection = document.getElementById("confirmation");
const diagnosisSection = document.getElementById("diagnosis");
const confirmationForm = document.getElementById("confirmation-form");
const storefrontScoreApi = window.JangsaStorefrontScore;
let currentOwnerObservations = [];

const confirmationLabels = {
  businessCategory: "업종 정보", address: "주소", directions: "찾아오는 길", keywords: "대표키워드", businessHours: "영업시간", contact: "연락처",
  coverPhoto: "대표사진", menu: "메뉴", prices: "가격", reservation: "예약", order: "주문", inquiry: "문의", coupon: "쿠폰",
  reviewVolume: "리뷰 수", reviewRecency: "최근 리뷰", reviewQuality: "리뷰 내용", ownerReplies: "사장님 답글", photoReviews: "사진 리뷰", negativeResponse: "불만 리뷰 대응",
  description: "상세설명", menuDescriptions: "메뉴 설명", photoDiversity: "사진 다양성", uniqueValue: "가게 차별점", recentPosts: "최근 소식",
  profileUpdated: "정보 최신성", reservationSlots: "예약 가능 시간", replySpeed: "답글 속도", recentPostActivity: "소식 활동", featureHealth: "기능 정상 작동",
};

function showCoreState(state) {
  analysisSection.hidden = state !== "analyzing";
  confirmationSection.hidden = state !== "confirming";
  diagnosisSection.hidden = state !== "questions";
}

function renderManualConfirmation(reason) {
  confirmationForm.innerHTML = `<p class="confirmation-notice">${escapeHtml(reason)}</p>` + storefrontScoreApi.STOREFRONT_RULES.map((rule) => `
    <label class="confirmation-item"><span>${escapeHtml(confirmationLabels[rule.key])}</span>
      <select name="confirm-${escapeHtml(rule.key)}">
        <option value="unknown">잘 모르겠어요</option><option value="pass">충족</option><option value="partial">일부 충족</option><option value="fail">미충족</option>
      </select>
    </label>
  `).join("");
  showCoreState("confirming");
}

intakeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const normalized = ui.normalizePlaceUrl(new FormData(intakeForm).get("placeUrl"));
  const error = document.getElementById("place-url-error");
  if (!normalized) {
    error.textContent = "네이버 플레이스 URL 또는 naver.me 공유 링크를 확인해 주세요.";
    error.hidden = false;
    return;
  }
  error.hidden = true;
  showCoreState("analyzing");
  renderManualConfirmation("현재 정적 버전에서는 자동 확인 결과를 만들지 않습니다. 실제 수집기 연결 전까지 사장님 확인값으로 안전하게 진단합니다.");
});

document.getElementById("manual-intake").addEventListener("click", () => renderManualConfirmation("링크 없이 사장님 확인값으로 진단합니다."));
document.getElementById("confirm-storefront").addEventListener("click", () => {
  currentOwnerObservations = ui.buildOwnerObservations(Object.fromEntries(new FormData(confirmationForm).entries()));
  showCoreState("questions");
});

showCoreState("intake");
```

Do not add fake delays, fake review counts, or text claiming that the URL was automatically analyzed. Add this integration test:

```js
test("지원 링크는 자동 분석을 가장하지 않고 사장님 확인으로 전환한다", () => {
  const window = createApp();
  const input = window.document.getElementById("place-url");
  input.value = "https://naver.me/abc123";
  window.document.getElementById("place-intake-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(window.document.getElementById("confirmation").hidden, false);
  assert.match(window.document.getElementById("confirmation").textContent, /정적 버전|사장님 확인/);
  assert.doesNotMatch(window.document.getElementById("confirmation").textContent, /리뷰 [0-9,]+건 분석/);
});
```

- [ ] **Step 6: Add responsive intake and confirmation styles**

```css
.intake-card,.confirmation-list{background:#fff;border:1px solid var(--line);border-radius:24px;padding:24px;box-shadow:var(--shadow)}
.intake-row{display:grid;grid-template-columns:1fr auto;gap:12px}.field-error{color:#b42318;font-weight:700}
.analysis-progress{display:grid;gap:12px;list-style:none;padding:0}.analysis-progress li{padding:14px 16px;border-radius:14px;background:#f8fafc}
.confirmation-list{display:grid;gap:14px}.confirmation-item{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:16px;border:1px solid var(--line);border-radius:16px}
@media (max-width:680px){.intake-row,.confirmation-item{grid-template-columns:1fr}}
```

- [ ] **Step 7: Run UI tests and syntax check**

Run: `node --test tests/ui-logic.test.cjs tests/app.integration.test.cjs && node --check src/ui-logic.js && node --check src/app.js`

Expected: PASS.

- [ ] **Step 8: Commit intake and confirmation UI**

```bash
git add src/ui-logic.js src/app.js tests/ui-logic.test.cjs tests/app.integration.test.cjs index.html assets/styles.css
git commit -m "feat: add place intake and owner confirmation"
```

---

### Task 6: Explainable Result Screen and CTA Hierarchy

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `assets/styles.css`
- Modify: `tests/app.integration.test.cjs`

**Interfaces:**
- Consumes: `DiagnosisViewModel` from Task 4.
- Produces DOM states for score hidden/visible, categories, target, bottleneck, evidence, and CTA.

- [ ] **Step 1: Write failing integration tests for visible and hidden scores**

```js
test("충분히 확인된 샘플은 외부 준비도와 목표점수를 분리해 보여준다", () => {
  const window = createApp();
  window.document.querySelector("[data-sample]").click();
  assert.match(window.document.getElementById("storefront-score").textContent, /점/);
  assert.match(window.document.getElementById("target-score").textContent, /목표/);
  assert.match(window.document.getElementById("business-bottleneck").textContent, /필요 손님|병목/);
});

test("확인 범위가 낮으면 총점 대신 정보 추가 필요를 보여준다", () => {
  const window = createApp();
  window.JangsaAppTest.renderLowCoverageSample();
  assert.match(window.document.getElementById("storefront-score").textContent, /정보 추가 필요/);
  assert.equal(window.document.getElementById("target-score").hidden, true);
});

test("공유 문구에 원본 매출 숫자가 포함되지 않는다", () => {
  const window = createApp();
  window.document.querySelector("[data-sample]").click();
  assert.equal(window.JangsaAppTest.resultCopyText().includes("10000000"), false);
});
```

- [ ] **Step 2: Run and verify the missing-container failure**

Run: `node --test tests/app.integration.test.cjs`

Expected: FAIL because `storefront-score`, `target-score`, and test hooks do not exist.

- [ ] **Step 3: Add result containers**

Inside `#result`, before the existing action details, add:

```html
<section class="diagnosis-overview">
  <article class="score-hero" id="storefront-score" aria-live="polite"></article>
  <article class="target-card" id="target-score"></article>
</section>
<section class="score-categories" id="score-categories" aria-label="영역별 매장 준비도"></section>
<article class="bottleneck-card" id="business-bottleneck"></article>
<div class="result-cta-stack">
  <button class="button primary" id="primary-fix-action" type="button">지금 고치기</button>
  <button class="button secondary" id="generate-draft" type="button">AI로 초안 만들기</button>
  <button class="text-button" id="defer-action" type="button">오늘은 어려워요</button>
</div>
```

- [ ] **Step 4: Render one view model and expose narrow test hooks**

Add to `src/app.js`:

```js
function renderDiagnosisView(view) {
  const score = document.getElementById("storefront-score");
  score.innerHTML = view.storefront.visible
    ? `<span>외부 매장 준비도</span><strong>${view.storefront.score}점</strong><small>확인 범위 ${Math.round(view.storefront.coverage * 100)}%</small>`
    : `<span>외부 매장 준비도</span><strong>정보 추가 필요</strong><small>확인 범위 ${Math.round(view.storefront.coverage * 100)}%</small>`;
  const target = document.getElementById("target-score");
  target.hidden = !view.storefront.visible || view.target.target === null;
  if (!target.hidden) target.innerHTML = `<span>이번 행동 후 1차 목표</span><strong>${view.target.current}점 → ${view.target.target}점</strong><small>회복 가능 +${view.target.gain}점</small>`;
  document.getElementById("score-categories").innerHTML = view.storefront.categories.map((category) => `
    <article><span>${escapeHtml(category.key)}</span><strong>${category.score === null ? "미확인" : `${category.score}점`}</strong></article>
  `).join("");
  document.getElementById("business-bottleneck").innerHTML = `
    <span>현재 성장 병목</span><strong>${escapeHtml(view.bottleneck.label)}</strong><p>하루 필요 손님 ${view.bottleneck.requiredCustomersPerDay.toLocaleString("ko-KR")}명</p>
  `;
}

globalThis.JangsaAppTest = {
  renderLowCoverageSample() {
    renderDiagnosisView({ storefront: { visible: false, score: null, coverage: 0.4, categories: [] }, target: { target: null }, bottleneck: { label: "기준 숫자 확인", requiredCustomersPerDay: 0 } });
  },
  resultCopyText,
};
```

Production code must call `renderDiagnosisView(view)` immediately before the existing `renderResult(businessResult)` details are populated.

Compose the view in `generateResult()` with the exact contracts from Tasks 1–4:

```js
const input = ui.buildDiagnosisInput(getValues());
const businessResult = engine.diagnoseStore(input);
const resolvedObservations = observationsApi.resolveObservations(currentOwnerObservations);
const scoreItems = storefrontScoreApi.buildScoreItems(resolvedObservations);
const storefront = storefrontScoreApi.calculateStorefrontScore(scoreItems);
const target = storefrontScoreApi.calculateTargetScore(storefront, businessResult.action.recoverableScoreItems || []);
const view = presenterApi.presentDiagnosis({ businessResult, storefrontScore: storefront, targetScore: target, observationMap: resolvedObservations });
latestResult = { ...businessResult, view };
renderDiagnosisView(view);
renderResult(latestResult);
```

At application startup define:

```js
const observationsApi = window.JangsaObservations;
const presenterApi = window.JangsaDiagnosisPresenter;
```

At the start of `loadSample()`, create a deterministic, sufficiently covered storefront sample so the existing sample CTA demonstrates the visible-score state:

```js
currentOwnerObservations = storefrontScoreApi.STOREFRONT_RULES.map((rule, index) => observationsApi.createObservation({
  key: rule.key,
  value: index % 6 === 0 ? "partial" : index % 9 === 0 ? false : true,
  source: "owner",
  confidence: "high",
  observedAt: "2026-07-12T00:00:00.000Z",
  status: "confirmed",
  evidence: "샘플 매장 확인값",
}));
```

- [ ] **Step 5: Add result styles**

```css
.diagnosis-overview{display:grid;grid-template-columns:1.2fr 1fr;gap:18px}.score-hero,.target-card,.bottleneck-card{padding:24px;border:1px solid var(--line);border-radius:22px;background:#fff}.score-hero strong,.target-card strong{display:block;font-size:clamp(2rem,6vw,3.5rem)}
.score-categories{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.score-categories article{padding:16px;border-radius:16px;background:#f8fafc}.score-categories strong{display:block;margin-top:8px}.result-cta-stack{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
@media (max-width:800px){.diagnosis-overview{grid-template-columns:1fr}.score-categories{grid-template-columns:1fr 1fr}}
```

- [ ] **Step 6: Run integration and accessibility-oriented assertions**

Run: `node --test tests/app.integration.test.cjs`

Expected: PASS. Confirm every dynamic score update occurs inside an `aria-live` region and every action uses a button or link.

- [ ] **Step 7: Commit result UI**

```bash
git add index.html src/app.js assets/styles.css tests/app.integration.test.cjs
git commit -m "feat: render explainable diagnosis results"
```

---

### Task 7: 3/7-Day Progress Record and Backward-Compatible History

**Files:**
- Modify: `src/ui-logic.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `tests/ui-logic.test.cjs`
- Modify: `tests/app.integration.test.cjs`

**Interfaces:**
- Produces: history version `2` records with `scoreVersion`, `storefrontScore`, `coverage`, `targetScore`, `checkInDueAt`, and `safeShare`.
- Produces: `migrateHistoryEntry(entry) -> v2Entry`.

- [ ] **Step 1: Write failing history migration tests**

```js
test("v1 실행 이력을 v2로 안전하게 보완한다", () => {
  const migrated = migrateHistoryEntry({ id: "old", storeName: "우리식당", actionKey: "aov", status: "accepted" });
  assert.equal(migrated.version, 2);
  assert.equal(migrated.storefrontScore, null);
  assert.equal(migrated.coverage, null);
  assert.equal(migrated.checkInDueAt, null);
});

test("새 실행 이력은 7일 확인일과 민감정보 없는 공유 문구를 저장한다", () => {
  const entry = createHistoryEntry({
    input: { storeName: "우리식당", currentRevenue: 10_000_000 },
    action: { key: "aov", title: "세트메뉴 배치", metric: "객단가" },
    confidence: { label: "근거 충분" },
    view: { storefront: { visible: true, score: 74, coverage: 0.8 }, target: { target: 83 }, safeShare: "우리식당 74점" },
  }, new Date("2026-07-12T00:00:00.000Z"));
  assert.equal(entry.version, 2);
  assert.equal(entry.checkInDueAt, "2026-07-19T00:00:00.000Z");
  assert.equal(JSON.stringify(entry).includes("10000000"), false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/ui-logic.test.cjs`

Expected: FAIL because migration and v2 fields do not exist.

- [ ] **Step 3: Implement v2 history records**

Replace `createHistoryEntry` and add migration:

```js
function migrateHistoryEntry(entry) {
  if (entry && entry.version === 2) return entry;
  return {
    ...entry,
    version: 2,
    scoreVersion: null,
    storefrontScore: null,
    coverage: null,
    targetScore: null,
    checkInDueAt: null,
    safeShare: "",
  };
}

function createHistoryEntry(result, now = new Date()) {
  const timestamp = now.toISOString();
  const checkInDueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    version: 2,
    id: `diagnosis-${timestamp.replace(/[^0-9]/g, "")}`,
    createdAt: timestamp,
    storeName: result.input.storeName,
    actionKey: result.action.key,
    actionTitle: result.action.title,
    metric: result.action.metric,
    confidenceLabel: result.confidence.label,
    scoreVersion: "storefront-v1",
    storefrontScore: result.view?.storefront.visible ? result.view.storefront.score : null,
    coverage: result.view?.storefront.coverage ?? null,
    targetScore: result.view?.target.target ?? null,
    checkInDueAt,
    safeShare: result.view?.safeShare || "",
    status: "pending",
    resultNote: "",
    resultValue: "",
  };
}
```

Export `migrateHistoryEntry`.

- [ ] **Step 4: Migrate records when loading and show due dates**

Change `loadHistory()` in `src/app.js`:

```js
const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
return Array.isArray(saved) ? saved.map(ui.migrateHistoryEntry) : [];
```

In `renderHistory()`, add:

```js
const due = item.checkInDueAt ? new Date(item.checkInDueAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) : null;
const dueText = due ? `<p class="history-due">${escapeHtml(due)}에 결과 확인</p>` : "";
```

Render `dueText` beneath the action title.

- [ ] **Step 5: Add integration assertion**

```js
test("오늘 실행하기는 v2 이력과 7일 확인일을 저장한다", () => {
  const window = createApp();
  window.document.querySelector("[data-sample]").click();
  window.document.getElementById("accept-action").click();
  const history = JSON.parse(window.localStorage.getItem("jangsaNavigationV11History"));
  assert.equal(history[0].version, 2);
  assert.match(history[0].checkInDueAt, /^\d{4}-\d{2}-\d{2}T/);
});
```

- [ ] **Step 6: Run UI and integration tests**

Run: `node --test tests/ui-logic.test.cjs tests/app.integration.test.cjs`

Expected: PASS, including the existing accepted/completed history tests.

- [ ] **Step 7: Commit history upgrade**

```bash
git add src/ui-logic.js src/app.js index.html tests/ui-logic.test.cjs tests/app.integration.test.cjs
git commit -m "feat: add seven-day diagnosis check-ins"
```

---

### Task 8: End-to-End Verification, Copy Audit, and Release Documentation

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/validation-plan.md`
- Modify: `package.json`
- Test: `tests/*.test.cjs`

**Interfaces:**
- Produces a verified static v12 core build in `dist/`.
- Does not add real collector, account, notification, or industry-average claims.

- [ ] **Step 1: Update product metadata and scripts**

Change `package.json`:

```json
{
  "name": "jangsa-navigation-v12",
  "version": "12.0.0",
  "private": true,
  "description": "외부 매장 준비도와 내부 성장 병목을 분리해 오늘의 행동을 설명하는 자영업자용 실행 코치",
  "scripts": {
    "test": "node --test tests/*.test.cjs",
    "check": "node --check src/observations.js && node --check src/storefront-score.js && node --check src/action-priority.js && node --check src/diagnosis-presenter.js && node --check src/engine.js && node --check src/ui-logic.js && node --check src/app.js && node --check scripts/build-static.cjs",
    "build": "node scripts/build-static.cjs",
    "verify": "npm run check && npm test && npm run build"
  },
  "engines": { "node": ">=20" },
  "devDependencies": { "happy-dom": "^20.10.6" }
}
```

- [ ] **Step 2: Update README with honest product boundaries**

Add a `v12 진단 구조` section containing:

```markdown
## v12 진단 구조

- 외부 매장 준비도: 공개 정보와 사장님 확인값으로만 100점 계산
- 내부 성장 병목: 매출·객단가·광고·재방문을 점수에 섞지 않고 행동 판단에 사용
- 미확인 항목: 0점이 아니라 계산 제외
- 목표점수: 선택한 행동으로 회복 가능한 배점만 반영
- 업종 비교: 유효 표본이 준비되기 전에는 `권장 기준 대비`만 표시

현재 정적 버전은 수집기 인터페이스와 수동 확인 흐름을 제공합니다. 네이버 플레이스 자동 수집은 별도 서버 수집기 프로젝트에서 연결합니다.
```

- [ ] **Step 3: Add validation cases**

Add these rows to `docs/validation-plan.md`:

```markdown
| 일부 자동 확인 실패 | 미확인 항목이 0점 처리되지 않는가 |
| 확인 범위 59% | 총점 대신 정보 추가 필요가 보이는가 |
| 확인 범위 60% | 총점과 확인 범위가 함께 보이는가 |
| 수신동의 없음 | 고객 메시지 행동이 제외되는가 |
| 수용 여력 없음 | 신규 유입 행동이 제외되는가 |
| 낮은 신뢰도 | 유료 행동이 제외되는가 |
| 목표점수 | 회복 가능한 배점만 더해지는가 |
| 공유 문구 | 매출·광고 원본값이 없는가 |
```

- [ ] **Step 4: Record release changes**

Add at the top of `CHANGELOG.md`:

```markdown
## 12.0.0 - 2026-07-12

- 외부 매장 준비도와 내부 성장 병목 분리
- 미확인 항목 제외 및 60% 확인 범위 기준 추가
- 근거 신뢰도를 포함한 행동 우선순위 추가
- 실제 회복 배점 기반 목표점수 추가
- 링크 입력, 수동 확인, 실패 대체 흐름 추가
- 7일 결과 확인과 v2 실행 이력 추가
```

- [ ] **Step 5: Run the full verification suite**

Run: `npm run verify`

Expected:

- syntax checks exit 0;
- all unit and integration tests pass;
- balanced 36-scenario engine test passes;
- `dist/` contains HTML, assets, and every new `src` module;
- command exits 0.

- [ ] **Step 6: Inspect the built copy for prohibited claims**

Run:

```bash
rg -n "매출 보장|순위 보장|상위 [0-9]+%|업종 평균" dist
```

Expected: no unsupported claim. Any `업종 평균` occurrence must be explanatory copy stating that a valid benchmark is unavailable, not a displayed benchmark value.

- [ ] **Step 7: Check the final diff and status**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended source, test, documentation, and generated `dist/` changes. Do not stage `dist/` because it is ignored.

- [ ] **Step 8: Commit the verified v12 core**

```bash
git add package.json README.md CHANGELOG.md docs/validation-plan.md
git commit -m "docs: document explainable diagnosis v12"
```

---

## Implementation Completion Gate

Do not call the core complete until all of the following are true:

- `npm run verify` exits 0 from a clean dependency install.
- Score tests prove unknown denominator exclusion and the 60% coverage gate.
- Action tests prove consent, capacity, menu-change, and low-confidence paid-action exclusions.
- Integration tests prove success, partial failure, manual fallback, visible score, hidden score, and 7-day check-in flows.
- Sharing tests prove raw revenue and advertising values are absent.
- The UI clearly labels automatic, owner-confirmed, inferred, and unknown information.
- No benchmark or percentile is shown without a valid dataset.
- The result screen leads with one action, its reason, three steps, one prohibited action, one check metric, and a traceable target score.
