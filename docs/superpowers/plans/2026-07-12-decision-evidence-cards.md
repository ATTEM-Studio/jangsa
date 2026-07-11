# 판단 근거 카드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 추천 결과의 근거를 사장님이 직관적으로 이해하는 카드형 흐름으로 바꾼다.

**Architecture:** 추천 엔진은 그대로 두고, 결과 렌더러가 입력값·문제 해석·추천 연결·가정을 구조화한 HTML을 만든다. CSS는 해당 구조를 카드와 세로 흐름으로 표현한다.

**Tech Stack:** Vanilla JavaScript, HTML, CSS, Node.js test runner, happy-dom.

## Global Constraints

- 기존 추천 규칙과 수치 계산을 변경하지 않는다.
- 근거에는 확정 입력값과 가정을 분리해 표시한다.
- 모바일 한 열 레이아웃을 유지한다.

---

### Task 1: 카드형 근거 출력 계약 고정

**Files:**
- Modify: `tests/app.integration.test.cjs`

- [ ] **Step 1: Write the failing test**

```js
assert.equal(window.document.querySelectorAll(".evidence-card").length, 4);
assert.match(window.document.getElementById("result-evidence").textContent, /현재 위치/);
assert.match(window.document.getElementById("result-evidence").textContent, /숫자가 말하는 문제/);
assert.match(window.document.getElementById("result-evidence").textContent, /그래서 오늘의 1순위/);
assert.match(window.document.getElementById("result-evidence").textContent, /이번 추천의 기준/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.integration.test.cjs`

Expected: FAIL because `.evidence-card` elements do not exist.

- [ ] **Step 3: Implement the minimal renderer and styles**

Create four semantic cards in `renderEvidence`, then add responsive card and flow styles.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/app.integration.test.cjs`

Expected: PASS.

### Task 2: 전체 회귀 검증

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `assets/styles.css`
- Modify: `tests/app.integration.test.cjs`

- [ ] **Step 1: Run complete verification**

Run: `npm run verify`

Expected: 25 tests pass, syntax checks pass, and `dist` is rebuilt.
