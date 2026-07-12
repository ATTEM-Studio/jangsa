const test = require("node:test");
const assert = require("node:assert/strict");

const { diagnoseStore } = require("../src/engine.js");

const base = {
  storeName: "우리식당",
  painPoint: "unknown",
  businessType: "meal",
  tradeArea: "residential",
  storeStrength: "specialty",
  currentRevenue: 10_000_000,
  targetRevenue: 15_000_000,
  remainingDays: 20,
  averageOrderValue: 20_000,
  adsRunning: false,
  adSpend: 0,
  paidClicks: 0,
  contributionMarginRate: 0.3,
  hasConsentDb: false,
  capacity: "yes",
  canChangeMenu: false,
  knowsReturningRate: false,
  returningRate: null,
};

function scenario(overrides = {}) {
  return { ...base, ...overrides };
}

test("핵심 숫자가 빠지면 억지 행동 대신 확인할 숫자 하나를 요청한다", () => {
  const result = diagnoseStore(scenario({ averageOrderValue: 0 }));

  assert.equal(result.action.key, "dataCheck");
  assert.match(result.action.title, /객단가/);
  assert.equal(result.confidence.level, "low");
});

test("광고가 문제이고 안전 클릭 수가 좁으면 광고 확대 대신 클릭 후 화면 개선을 추천한다", () => {
  const result = diagnoseStore(scenario({
    painPoint: "ads",
    adsRunning: true,
    adSpend: 600_000,
    paidClicks: 1_000,
    contributionMarginRate: 0.2,
    canChangeMenu: true,
  }));

  assert.equal(result.action.key, "adScreen");
  assert.match(result.action.why, /클릭/);
  assert.ok(result.metrics.maxSafeClicksPerCustomer < 8);
});

test("광고를 하지 않는 매장에는 광고 개선을 추천하지 않는다", () => {
  const result = diagnoseStore(scenario({ painPoint: "ads", adsRunning: false, canChangeMenu: true }));

  assert.notEqual(result.action.key, "adScreen");
});

test("수신동의 고객 DB가 있고 단골이 고민이면 재방문 행동을 추천한다", () => {
  const result = diagnoseStore(scenario({
    painPoint: "repeat",
    hasConsentDb: true,
    knowsReturningRate: true,
    returningRate: 0.08,
  }));

  assert.equal(result.action.key, "repeat");
  assert.match(result.action.title, /재방문/);
});

test("수신동의 DB가 없으면 고객 메시지 발송을 추천하지 않는다", () => {
  const result = diagnoseStore(scenario({ painPoint: "repeat", hasConsentDb: false }));

  assert.notEqual(result.action.key, "existingCustomer");
  assert.ok(result.action.steps.every((step) => !step.includes("문자")));
});

test("수용 여력이 부족하고 메뉴 변경이 가능하면 추가 유입 대신 객단가를 추천한다", () => {
  const result = diagnoseStore(scenario({
    painPoint: "margin",
    capacity: "no",
    canChangeMenu: true,
  }));

  assert.equal(result.action.key, "aov");
});

test("객단가 예상효과는 전체 손님이 아니라 20~40% 선택률 범위로 계산한다", () => {
  const result = diagnoseStore(scenario({
    painPoint: "margin",
    capacity: "no",
    canChangeMenu: true,
  }));

  const estimatedCustomers = base.currentRevenue / base.averageOrderValue;
  assert.equal(result.action.effect.low, estimatedCustomers * 1_000 * 0.2);
  assert.equal(result.action.effect.high, estimatedCustomers * 1_000 * 0.4);
});

test("큰 유입이 필요하고 비주얼 강점이 있으면 소형 크리에이터 테스트를 추천한다", () => {
  const result = diagnoseStore(scenario({
    painPoint: "customers",
    businessType: "cafe",
    tradeArea: "hotplace",
    storeStrength: "visual",
    currentRevenue: 4_000_000,
    targetRevenue: 14_000_000,
    remainingDays: 15,
    capacity: "yes",
  }));

  assert.ok(result.metrics.requiredCustomersPerDay >= 8);
  assert.equal(result.action.key, "creatorTest");
});

test("큰 유입이 필요하지만 비주얼형이 아니면 지역 검색 유입 개선을 추천한다", () => {
  const result = diagnoseStore(scenario({
    painPoint: "customers",
    businessType: "meal",
    tradeArea: "residential",
    storeStrength: "specialty",
    currentRevenue: 4_000_000,
    targetRevenue: 14_000_000,
    remainingDays: 15,
    capacity: "yes",
  }));

  assert.equal(result.action.key, "localDiscovery");
});

test("추가 손님이 적게 필요하고 수신동의 DB가 있으면 최근 고객 재방문을 추천한다", () => {
  const result = diagnoseStore(scenario({
    painPoint: "customers",
    currentRevenue: 14_000_000,
    targetRevenue: 15_000_000,
    remainingDays: 20,
    hasConsentDb: true,
  }));

  assert.ok(result.metrics.requiredCustomersPerDay <= 3);
  assert.equal(result.action.key, "existingCustomer");
});

test("목표를 이미 달성하면 무리한 추가 유입보다 이익 방어를 추천한다", () => {
  const result = diagnoseStore(scenario({
    currentRevenue: 16_000_000,
    targetRevenue: 15_000_000,
    canChangeMenu: true,
  }));

  assert.equal(result.action.key, "profitDefense");
});

test("추천 결과는 행동·이유·3단계·확인지표를 모두 제공한다", () => {
  const result = diagnoseStore(scenario({ canChangeMenu: true, capacity: "no" }));

  assert.ok(result.action.title.length > 0);
  assert.ok(result.action.why.length > 0);
  assert.equal(result.action.steps.length, 3);
  assert.ok(result.action.metric.length > 0);
  assert.ok(["high", "medium", "low"].includes(result.confidence.level));
});

test("recommendations include priority factors and recoverable score items", () => {
  const result = diagnoseStore(scenario({ painPoint: "margin", capacity: "no", canChangeMenu: true }));

  assert.equal(typeof result.action.priorityScore, "number");
  assert.ok(Array.isArray(result.action.recoverableScoreItems));
  assert.equal(result.action.requires.canChangeMenu, true);
});

test("ads pain with no capacity falls back to an executable action", () => {
  const result = diagnoseStore(scenario({
    painPoint: "ads",
    adsRunning: true,
    adSpend: 600_000,
    paidClicks: 1_000,
    capacity: "no",
    canChangeMenu: false,
  }));

  assert.notEqual(result.action.key, "adScreen");
  assert.equal(result.action.requires.capacity, undefined);
});

test("ads pain with a safe click range avoids ad-screen remediation", () => {
  const result = diagnoseStore(scenario({
    painPoint: "ads",
    adsRunning: true,
    adSpend: 30_000,
    paidClicks: 1_000,
    capacity: "yes",
    canChangeMenu: false,
  }));

  assert.ok(result.metrics.maxSafeClicksPerCustomer >= 8);
  assert.notEqual(result.action.key, "adScreen");
});

test("repeat pain keeps repeat action before no-capacity fallback", () => {
  const result = diagnoseStore(scenario({
    painPoint: "repeat",
    hasConsentDb: true,
    capacity: "no",
    canChangeMenu: true,
  }));

  assert.equal(result.action.key, "repeat");
});

test("unsafe ads with uncertain capacity avoids capacity-gated ad-screen action", () => {
  const result = diagnoseStore(scenario({
    painPoint: "unknown",
    adsRunning: true,
    adSpend: 600_000,
    paidClicks: 1_000,
    capacity: "sometimes",
    canChangeMenu: false,
  }));

  assert.notEqual(result.action.key, "adScreen");
  assert.equal(result.action.requires.capacity, undefined);
});

test("uncertain capacity fallback remains executable", () => {
  const result = diagnoseStore(scenario({
    painPoint: "unknown",
    capacity: "sometimes",
    canChangeMenu: false,
    hasConsentDb: false,
  }));

  assert.notEqual(result.action.key, "localDiscovery");
  assert.equal(result.action.requires.capacity, undefined);
});

const balancedCases = [
  ...Array.from({ length: 6 }, (_, index) => ({
    expected: "dataCheck",
    input: scenario({ [index % 2 ? "averageOrderValue" : "remainingDays"]: 0 }),
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    expected: "adScreen",
    input: scenario({ painPoint: "ads", adsRunning: true, adSpend: 500_000 + index * 20_000, paidClicks: 800, contributionMarginRate: 0.18 }),
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    expected: "aov",
    input: scenario({ painPoint: "margin", capacity: "no", canChangeMenu: true, averageOrderValue: 18_000 + index * 1_000 }),
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    expected: "repeat",
    input: scenario({ painPoint: "repeat", hasConsentDb: true, knowsReturningRate: true, returningRate: 0.05 + index * 0.01 }),
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    expected: "localDiscovery",
    input: scenario({ painPoint: "customers", currentRevenue: 3_000_000 + index * 100_000, targetRevenue: 15_000_000, remainingDays: 12, capacity: "yes" }),
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    expected: "creatorTest",
    input: scenario({ painPoint: "customers", businessType: index % 2 ? "cafe" : "bar", tradeArea: "hotplace", storeStrength: "visual", currentRevenue: 3_000_000, targetRevenue: 15_000_000, remainingDays: 12, capacity: "yes" }),
  })),
];

test("균형 검증 36개 상황에서 기대한 1순위 행동과 모두 일치한다", () => {
  const mismatches = balancedCases
    .map((item, index) => ({ index, expected: item.expected, actual: diagnoseStore(item.input).action.key }))
    .filter((item) => item.expected !== item.actual);

  assert.deepEqual(mismatches, []);
});

test("균형 검증 세트에서 특정 행동이 40%를 넘지 않는다", () => {
  const counts = balancedCases.reduce((acc, item) => {
    const key = diagnoseStore(item.input).action.key;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  assert.ok(Math.max(...Object.values(counts)) / balancedCases.length <= 0.4);
});
