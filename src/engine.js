(function initJangsaEngine(root, factory) {
  const priorityApi = typeof module !== "undefined" && module.exports
    ? require("./action-priority.js")
    : root.JangsaActionPriority;
  const api = factory(priorityApi);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.JangsaEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createJangsaEngine(priorityApi) {
  "use strict";

  const ACTION_SCORE_WEIGHTS = {
    impact: 0.3,
    evidence: 0.25,
    feasibility: 0.2,
    speed: 0.15,
    cost: 0.1,
  };

  const REQUIRED_FIELDS = [
    ["targetRevenue", "목표 매출"],
    ["remainingDays", "목표일까지 남은 기간"],
    ["averageOrderValue", "평균 객단가"],
  ];

  function number(value, fallback = 0) {
    const parsed = typeof value === "string" ? Number(value.replaceAll(",", "")) : Number(value);
    return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(number(value), min), max);
  }

  function won(value) {
    return `${Math.round(number(value)).toLocaleString("ko-KR")}원`;
  }

  function shortWon(value) {
    const amount = number(value);
    if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(amount % 100_000_000 ? 1 : 0)}억원`;
    if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString("ko-KR")}만원`;
    return won(amount);
  }

  function calculateScore(parts) {
    return Math.round(Object.entries(ACTION_SCORE_WEIGHTS).reduce(
      (total, [key, weight]) => total + clamp(parts[key] || 0, 0, 100) * weight,
      0,
    ));
  }

  function confidence(level, reasons) {
    const labels = {
      high: "판단 근거 충분",
      medium: "일부 가정 포함",
      low: "추가 확인 필요",
    };
    return { level, label: labels[level], reasons };
  }

  function makeAction({
    key,
    title,
    summary,
    why,
    time,
    difficulty,
    steps,
    metric,
    avoid,
    effect,
    scoreParts,
    priority,
    requires = {},
    disqualify = [],
    spendsMoney = false,
    recoverableScoreItems = [],
  }) {
    return {
      key,
      title,
      summary,
      why,
      time,
      difficulty,
      steps,
      metric,
      avoid,
      effect,
      internalScore: calculateScore(scoreParts),
      scoreParts,
      priority,
      requires,
      disqualify,
      spendsMoney,
      recoverableScoreItems,
    };
  }

  function finalizeDiagnosis({ input, metrics, action, candidates, confidence: confidenceResult, assumptions }) {
    const options = candidates || [action];
    const rankedCandidates = options.map((candidate) => ({
      ...candidate,
      ...candidate.priority,
      requires: candidate.requires || {},
      disqualify: candidate.disqualify || [],
      spendsMoney: candidate.spendsMoney === true,
    }));
    const selected = priorityApi.selectTopAction(rankedCandidates, input);
    if (!selected) throw new Error("No executable recommendation is available.");
    return {
      input,
      metrics,
      action: { ...selected, priorityScore: priorityApi.scoreAction(selected) },
      confidence: confidenceResult,
      assumptions,
    };
  }

  function normalize(input) {
    const margin = number(input.contributionMarginRate, 0.3);
    return {
      storeName: String(input.storeName || "우리 매장").trim() || "우리 매장",
      painPoint: String(input.painPoint || "unknown"),
      businessType: String(input.businessType || "meal"),
      tradeArea: String(input.tradeArea || "residential"),
      storeStrength: String(input.storeStrength || "specialty"),
      currentRevenue: number(input.currentRevenue),
      targetRevenue: number(input.targetRevenue),
      remainingDays: number(input.remainingDays),
      averageOrderValue: number(input.averageOrderValue),
      adsRunning: input.adsRunning === true || input.adsRunning === "true",
      adSpend: number(input.adSpend),
      paidClicks: number(input.paidClicks),
      contributionMarginRate: clamp(margin > 1 ? margin / 100 : margin, 0, 1),
      hasConsentDb: input.hasConsentDb === true || input.hasConsentDb === "true",
      capacity: ["yes", "no", "sometimes"].includes(input.capacity) ? input.capacity : "sometimes",
      canChangeMenu: input.canChangeMenu === true || input.canChangeMenu === "true",
      knowsReturningRate: input.knowsReturningRate === true || input.knowsReturningRate === "true",
      returningRate: input.returningRate === null || input.returningRate === "" || input.returningRate === undefined
        ? null
        : clamp(number(input.returningRate) > 1 ? number(input.returningRate) / 100 : number(input.returningRate), 0, 1),
    };
  }

  function calculateMetrics(input) {
    const shortfallRevenue = Math.max(input.targetRevenue - input.currentRevenue, 0);
    const estimatedCustomers = input.averageOrderValue > 0 ? input.currentRevenue / input.averageOrderValue : 0;
    const requiredCustomers = input.averageOrderValue > 0 ? Math.ceil(shortfallRevenue / input.averageOrderValue) : 0;
    const requiredCustomersPerDay = input.remainingDays > 0 ? Math.ceil(requiredCustomers / input.remainingDays) : 0;
    const cpc = input.adsRunning && input.adSpend > 0 && input.paidClicks > 0
      ? input.adSpend / input.paidClicks
      : null;
    const safeCustomerAcquisitionCost = input.averageOrderValue * input.contributionMarginRate * 0.6;
    const maxSafeClicksPerCustomer = cpc && safeCustomerAcquisitionCost > 0
      ? safeCustomerAcquisitionCost / cpc
      : null;
    const aovEffect = {
      low: Math.round(estimatedCustomers * 1_000 * 0.2),
      high: Math.round(estimatedCustomers * 1_000 * 0.4),
    };

    return {
      shortfallRevenue,
      estimatedCustomers,
      requiredCustomers,
      requiredCustomersPerDay,
      cpc,
      safeCustomerAcquisitionCost,
      maxSafeClicksPerCustomer,
      aovEffect,
      targetReached: input.targetRevenue > 0 && input.currentRevenue >= input.targetRevenue,
    };
  }

  function missingRequiredField(input) {
    return REQUIRED_FIELDS.find(([key]) => number(input[key]) <= 0) || null;
  }

  function dataCheckAction(field) {
    const [, label] = field;
    return makeAction({
      key: "dataCheck",
      title: `오늘은 ${label}부터 확인하세요`,
      summary: "지금은 행동을 단정하는 것보다 기준 숫자 하나를 확인하는 편이 안전합니다.",
      why: `${label}가 없으면 남은 매출을 손님 수와 실제 행동으로 바꿀 수 없습니다. 숫자 하나만 확인하면 다음 판단이 훨씬 정확해집니다.`,
      time: "5분",
      difficulty: "쉬움",
      steps: [
        `${label}가 보이는 POS 또는 매출 화면을 여세요.`,
        "최근 진단 기간과 같은 기간의 숫자를 확인하세요.",
        "숫자를 입력하고 진단을 다시 실행하세요.",
      ],
      metric: `${label} 확인 완료 여부`,
      avoid: "모르는 숫자를 느낌으로 크게 추정하지 마세요.",
      effect: { label: "추천 정확도 향상", low: null, high: null, basis: "필수 데이터 확인" },
      scoreParts: { impact: 90, evidence: 100, feasibility: 98, speed: 98, cost: 100 },
      priority: { impact: 70, urgency: 95, feasibility: 100, lowCost: 100, confidenceScore: 70 },
    });
  }

  function adScreenAction(input, metrics) {
    const tenClickCost = metrics.cpc * 10;
    const clickLimit = metrics.maxSafeClicksPerCustomer;
    return makeAction({
      key: "adScreen",
      title: "오늘은 광고비를 늘리지 마세요",
      summary: "클릭을 더 사기보다 클릭한 손님이 방문하고 싶게 만드는 화면부터 고치세요.",
      why: `현재 클릭 10번에 약 ${won(tenClickCost)}이 듭니다. 손님 1명이 약 ${clickLimit.toFixed(1)}클릭 안에 와야 보수적인 광고 기준을 지킬 수 있어요.`,
      time: "20분",
      difficulty: "보통",
      steps: [
        "네이버 플레이스 대표 사진을 가장 잘 팔리는 메뉴 사진으로 바꾸세요.",
        "먼 지역·넓은 의미의 비효율 키워드 3개를 제외하세요.",
        "주차·예약·길찾기 정보를 첫 화면에서 바로 보이게 정리하세요.",
      ],
      metric: "7일 뒤 전화·길찾기·예약 수",
      avoid: "화면을 고치기 전에 입찰가와 일예산부터 올리지 마세요.",
      effect: { label: "불필요한 클릭비 보호", low: tenClickCost, high: tenClickCost * 5, basis: "클릭 10~50회 비용" },
      scoreParts: { impact: clickLimit < 5 ? 94 : 78, evidence: 92, feasibility: 82, speed: 88, cost: 95 },
      priority: { impact: 92, urgency: 90, feasibility: 78, lowCost: 70, confidenceScore: 88 },
      requires: { capacity: "yes" },
      spendsMoney: true,
      recoverableScoreItems: ["coverPhoto", "menu", "description", "reservation"],
    });
  }

  function aovAction(metrics) {
    return makeAction({
      key: "aov",
      title: "오늘은 세트메뉴 한 개만 앞에 배치하세요",
      summary: "새 손님을 더 데려오기 전에 이미 온 손님이 자연스럽게 하나 더 담게 만드세요.",
      why: `현재 손님 중 20~40%만 1,000원짜리 추가 메뉴를 선택해도 약 ${shortWon(metrics.aovEffect.low)}~${shortWon(metrics.aovEffect.high)}의 매출 여지가 있습니다.`,
      time: "15분",
      difficulty: "쉬움",
      steps: [
        "가장 많이 팔리는 대표 메뉴와 어울리는 추가 메뉴 하나를 고르세요.",
        "메뉴판에서 대표 메뉴 바로 아래에 세트로 배치하세요.",
        "직원 추천 멘트를 한 문장으로 통일하세요.",
      ],
      metric: "7일간 세트 선택률과 평균 객단가",
      avoid: "메뉴판 전체를 한꺼번에 바꾸거나 모든 손님이 추가 주문한다고 계산하지 마세요.",
      effect: { label: "보수적 객단가 효과", low: metrics.aovEffect.low, high: metrics.aovEffect.high, basis: "1,000원 추가 메뉴·선택률 20~40%" },
      scoreParts: { impact: 84, evidence: 72, feasibility: 96, speed: 96, cost: 94 },
      priority: { impact: 80, urgency: 70, feasibility: 90, lowCost: 90, confidenceScore: 85 },
      requires: { canChangeMenu: true },
      recoverableScoreItems: ["menu", "menuDescriptions", "prices"],
    });
  }

  function repeatAction(input) {
    const knownRate = input.knowsReturningRate && input.returningRate !== null;
    return makeAction({
      key: "repeat",
      title: "오늘은 7일 재방문 이유를 하나 만드세요",
      summary: "새 손님을 계속 사 오기보다 최근 손님이 한 번 더 올 이유를 정하세요.",
      why: knownRate
        ? `현재 확인된 재방문 비율은 약 ${Math.round(input.returningRate * 100)}%입니다. 수신동의를 받은 고객에게 작은 재방문 실험을 할 수 있어요.`
        : "수신동의를 받은 고객 DB가 있어 실제 반응을 측정할 수 있습니다. 작게 보내고 방문 반응을 확인하세요.",
      time: "15분",
      difficulty: "쉬움",
      steps: [
        "7일 안에 다시 올 이유가 되는 메뉴나 시간대 혜택 하나를 정하세요.",
        "수신동의 고객 중 최근 방문 고객에게만 짧게 안내하세요.",
        "발송 인원과 실제 재방문 인원을 따로 기록하세요.",
      ],
      metric: "발송 대비 7일 내 재방문 수",
      avoid: "수신동의가 없거나 오래된 고객에게 일괄 발송하지 마세요.",
      effect: { label: "재방문 실험", low: null, high: null, basis: "실제 발송 후 측정" },
      scoreParts: { impact: 86, evidence: knownRate ? 92 : 76, feasibility: 90, speed: 86, cost: 92 },
      priority: { impact: 82, urgency: 75, feasibility: 88, lowCost: 90, confidenceScore: knownRate ? 92 : 82 },
      requires: { hasConsentDb: true },
      recoverableScoreItems: ["recentPosts", "coupon", "ownerReplies"],
    });
  }

  function repeatInStoreAction() {
    return makeAction({
      key: "repeatInStore",
      title: "오늘은 계산할 때 다음 방문 이유를 말하세요",
      summary: "고객 연락처가 없어도 매장에서 바로 재방문 약속을 만들 수 있습니다.",
      why: "고객 DB와 수신동의가 없으므로 외부 연락보다 결제 순간의 안내가 안전하고 실행하기 쉽습니다.",
      time: "10분",
      difficulty: "쉬움",
      steps: [
        "7일 안에 다시 왔을 때 제공할 작은 혜택 하나를 정하세요.",
        "계산대 안내판에 다음 방문 이유를 한 문장으로 적으세요.",
        "직원이 결제할 때 같은 문장으로 한 번만 안내하세요.",
      ],
      metric: "7일 재방문 혜택 사용 수",
      avoid: "연락 동의가 없는 고객 정보를 별도로 모아 홍보에 쓰지 마세요.",
      effect: { label: "재방문 장치 마련", low: null, high: null, basis: "혜택 사용 수로 측정" },
      scoreParts: { impact: 72, evidence: 70, feasibility: 96, speed: 94, cost: 92 },
      priority: { impact: 65, urgency: 70, feasibility: 95, lowCost: 95, confidenceScore: 75 },
      recoverableScoreItems: ["recentPosts", "coupon"],
    });
  }

  function creatorAction(metrics) {
    return makeAction({
      key: "creatorTest",
      title: "오늘은 지역 소형 크리에이터 1명만 테스트하세요",
      summary: "큰 협찬보다 우리 상권과 메뉴가 맞는 한 명의 반응부터 확인하세요.",
      why: `목표까지 하루 약 ${metrics.requiredCustomersPerDay}명의 추가 손님이 필요하고, 비주얼로 보여주기 좋은 조건이 있습니다. 단, 매출을 보장하지 말고 저장·예약 반응부터 측정해야 합니다.`,
      time: "30분",
      difficulty: "보통",
      steps: [
        "우리 상권 방문 후기가 많은 후보 3명을 찾으세요.",
        "팔로워 수보다 댓글의 실제 방문 질문과 지역 비중을 확인하세요.",
        "한 명에게만 테스트를 제안하고 저장·예약 반응을 기록하세요.",
      ],
      metric: "게시 후 7일간 저장·예약·전화 증가",
      avoid: "팔로워 수만 보고 여러 명과 한꺼번에 계약하지 마세요.",
      effect: { label: "지역 유입 실험", low: null, high: null, basis: "저장·예약 반응으로 측정" },
      scoreParts: { impact: 88, evidence: 72, feasibility: 68, speed: 78, cost: 64 },
      priority: { impact: 90, urgency: 82, feasibility: 72, lowCost: 62, confidenceScore: 76 },
      requires: { capacity: "yes" },
      spendsMoney: true,
      recoverableScoreItems: ["coverPhoto", "photoDiversity", "uniqueValue", "recentPosts"],
    });
  }

  function localDiscoveryAction(metrics) {
    return makeAction({
      key: "localDiscovery",
      title: "오늘은 지역 검색에서 선택받는 이유 하나를 고치세요",
      summary: "광고를 크게 늘리기 전에 검색한 손님이 매장을 선택할 이유를 선명하게 만드세요.",
      why: `목표까지 하루 약 ${metrics.requiredCustomersPerDay}명의 추가 손님이 필요합니다. 먼저 대표 메뉴·이용 상황·위치 정보를 정리해 검색 유입의 방문 가능성을 높이세요.`,
      time: "25분",
      difficulty: "보통",
      steps: [
        "대표 메뉴 사진과 첫 설명 문장을 하나의 메뉴로 통일하세요.",
        "가족식사·점심·회식처럼 가장 강한 이용 상황 하나를 앞에 쓰세요.",
        "주차·예약·영업시간 정보를 최신 상태로 확인하세요.",
      ],
      metric: "7일간 전화·길찾기·예약 수",
      avoid: "서로 다른 지역과 메뉴 키워드를 한꺼번에 나열하지 마세요.",
      effect: { label: "지역 검색 전환 개선", low: null, high: null, basis: "7일 전후 행동 지표 비교" },
      scoreParts: { impact: 82, evidence: 74, feasibility: 86, speed: 82, cost: 94 },
      priority: { impact: 72, urgency: 74, feasibility: 86, lowCost: 90, confidenceScore: 78 },
      requires: { capacity: "yes" },
      recoverableScoreItems: ["businessCategory", "address", "directions", "keywords", "businessHours", "contact", "description"],
    });
  }

  function existingCustomerAction(metrics) {
    return makeAction({
      key: "existingCustomer",
      title: "오늘은 최근 고객에게 빈 시간대 메뉴를 알리세요",
      summary: "큰 광고보다 이미 매장을 아는 고객에게 작은 방문 이유를 전하는 편이 빠릅니다.",
      why: `목표까지 하루 약 ${metrics.requiredCustomersPerDay}명만 더 필요합니다. 수신동의를 받은 최근 고객에게 작은 테스트를 하기 적합한 구간입니다.`,
      time: "10분",
      difficulty: "쉬움",
      steps: [
        "손님이 가장 부족한 시간대 하나를 고르세요.",
        "그 시간대에 맞는 메뉴와 방문 이유를 한 문장으로 작성하세요.",
        "수신동의 고객 일부에게만 보내고 방문 수를 기록하세요.",
      ],
      metric: "발송 대비 3일 내 방문 수",
      avoid: "전체 고객에게 같은 내용을 반복 발송하지 마세요.",
      effect: { label: "필요 손님 소규모 확보", low: metrics.requiredCustomersPerDay, high: metrics.requiredCustomersPerDay * 3, basis: "하루 필요 손님 기준" },
      scoreParts: { impact: 78, evidence: 84, feasibility: 94, speed: 94, cost: 96 },
      priority: { impact: 78, urgency: 80, feasibility: 92, lowCost: 92, confidenceScore: 88 },
      requires: { hasConsentDb: true },
      recoverableScoreItems: ["recentPosts", "coupon", "ownerReplies"],
    });
  }

  function profitDefenseAction(input, metrics) {
    const baseAction = input.canChangeMenu ? aovAction(metrics) : repeatInStoreAction();
    return {
      ...baseAction,
      key: "profitDefense",
      title: input.canChangeMenu ? "오늘은 더 모으기보다 남는 매출을 지키세요" : "오늘은 추가 광고보다 재방문을 지키세요",
      summary: "목표 매출을 이미 넘겼습니다. 무리한 유입 확대보다 이익과 재방문을 지키는 편이 안전합니다.",
      why: `현재 매출이 목표보다 ${shortWon(input.currentRevenue - input.targetRevenue)} 높습니다. 오늘은 광고를 키우기보다 원가·세트 구성·재방문 반응을 점검하세요.`,
    };
  }

  function diagnoseStore(rawInput) {
    const input = normalize(rawInput || {});
    const missing = missingRequiredField(input);
    const metrics = calculateMetrics(input);

    if (missing) {
      return finalizeDiagnosis({
        input,
        metrics,
        action: dataCheckAction(missing),
        confidence: confidence("low", [`${missing[1]}가 필요합니다.`]),
        assumptions: [],
      });
    }

    if (metrics.targetReached) {
      return finalizeDiagnosis({
        input,
        metrics,
        action: profitDefenseAction(input, metrics),
        confidence: confidence("high", ["현재 매출과 목표 매출이 모두 입력되었습니다."]),
        assumptions: input.canChangeMenu ? ["추가 메뉴 선택률은 20~40% 범위로 봅니다."] : [],
      });
    }

    if (
      input.painPoint === "ads"
      && input.capacity === "yes"
      && input.adsRunning
      && metrics.cpc !== null
      && metrics.maxSafeClicksPerCustomer < 8
    ) {
      return finalizeDiagnosis({
        input,
        metrics,
        candidates: [adScreenAction(input, metrics), localDiscoveryAction(metrics)],
        confidence: confidence("high", ["같은 기간의 광고비와 클릭 수를 사용했습니다.", "객단가와 변동이익 기준을 반영했습니다."]),
        assumptions: ["방문 전환율은 단정하지 않고 안전 클릭 수로 판단합니다."],
      });
    }

    if (input.painPoint === "repeat") {
      const action = input.hasConsentDb ? repeatAction(input) : repeatInStoreAction();
      return finalizeDiagnosis({
        input,
        metrics,
        action,
        confidence: confidence(input.hasConsentDb && input.knowsReturningRate ? "high" : "medium", [
          input.hasConsentDb ? "수신동의 고객 DB가 있습니다." : "고객 DB가 없어 매장 안에서 실행하는 방법을 선택했습니다.",
        ]),
        assumptions: input.knowsReturningRate ? [] : ["정확한 재방문 비율은 아직 확인되지 않았습니다."],
      });
    }

    if (input.capacity === "no") {
      return finalizeDiagnosis({
        input,
        metrics,
        action: input.canChangeMenu ? aovAction(metrics) : repeatInStoreAction(),
        confidence: confidence("medium", ["현재 매출과 객단가로 손님 수를 추정했습니다.", "매장 수용 여력을 먼저 반영했습니다."]),
        assumptions: input.canChangeMenu ? ["1,000원 추가 메뉴의 선택률을 20~40%로 가정했습니다."] : [],
      });
    }

    if (input.painPoint === "margin" && input.canChangeMenu) {
      return finalizeDiagnosis({
        input,
        metrics,
        action: aovAction(metrics),
        confidence: confidence("medium", ["현재 매출과 객단가로 손님 수를 추정했습니다.", "메뉴 구성을 변경할 수 있습니다."]),
        assumptions: ["1,000원 추가 메뉴의 선택률을 20~40%로 가정했습니다."],
      });
    }

    if (input.painPoint === "customers" && metrics.requiredCustomersPerDay <= 3 && input.hasConsentDb) {
      return finalizeDiagnosis({
        input,
        metrics,
        action: existingCustomerAction(metrics),
        confidence: confidence("high", ["필요한 추가 손님 수가 작습니다.", "수신동의 고객 DB가 있습니다."]),
        assumptions: [],
      });
    }

    if (input.painPoint === "customers" && input.capacity === "yes" && metrics.requiredCustomersPerDay >= 8) {
      const visualFit = input.storeStrength === "visual"
        || input.tradeArea === "hotplace"
        || ["cafe", "bar"].includes(input.businessType);
      return finalizeDiagnosis({
        input,
        metrics,
        candidates: visualFit ? [creatorAction(metrics), localDiscoveryAction(metrics)] : [localDiscoveryAction(metrics)],
        confidence: confidence("medium", ["필요한 추가 손님 수와 매장 수용 여력을 확인했습니다."]),
        assumptions: ["콘텐츠와 검색 노출이 실제 방문으로 이어지는지는 7일간 측정해야 합니다."],
      });
    }

    if (input.painPoint === "customers" && input.capacity === "yes") {
      return finalizeDiagnosis({
        input,
        metrics,
        action: localDiscoveryAction(metrics),
        confidence: confidence("medium", ["추가 손님 수와 수용 여력을 확인했습니다."]),
        assumptions: ["전화·길찾기·예약 수로 먼저 반응을 확인합니다."],
      });
    }

    if (input.canChangeMenu) {
      return finalizeDiagnosis({
        input,
        metrics,
        action: aovAction(metrics),
        confidence: confidence("medium", ["현재 손님 수를 매출과 객단가로 추정했습니다."]),
        assumptions: ["1,000원 추가 메뉴의 선택률을 20~40%로 가정했습니다."],
      });
    }

    if (input.capacity === "yes" && input.adsRunning && metrics.cpc !== null && metrics.maxSafeClicksPerCustomer < 8) {
      return finalizeDiagnosis({
        input,
        metrics,
        action: adScreenAction(input, metrics),
        confidence: confidence("high", ["광고비·클릭 수·객단가 기준이 모두 있습니다."]),
        assumptions: ["방문 전환율은 안전 클릭 수로 간접 판단합니다."],
      });
    }

    if (input.hasConsentDb && metrics.requiredCustomersPerDay <= 3) {
      return finalizeDiagnosis({
        input,
        metrics,
        action: existingCustomerAction(metrics),
        confidence: confidence("high", ["필요 손님 수가 작고 수신동의 고객 DB가 있습니다."]),
        assumptions: [],
      });
    }

    return finalizeDiagnosis({
      input,
      metrics,
      action: input.capacity === "yes" ? localDiscoveryAction(metrics) : repeatInStoreAction(),
      confidence: confidence("medium", ["현재 입력으로 실행 가능한 행동만 남겼습니다."]),
      assumptions: ["실행 후 7일간 행동 지표를 확인해야 합니다."],
    });
  }

  return {
    ACTION_SCORE_WEIGHTS,
    calculateMetrics,
    diagnoseStore,
    formatWon: won,
    formatShortWon: shortWon,
  };
});
