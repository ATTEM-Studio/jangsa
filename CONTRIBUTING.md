# 기여 가이드

## 개발 시작

```bash
npm ci
npm test
```

## 변경 원칙

1. 기능보다 해결하려는 사장님 문제를 먼저 정의합니다.
2. 추천 규칙을 바꿀 때는 실패하는 테스트를 먼저 추가합니다.
3. 사장님 화면에는 행동·이유·실행순서·확인지표를 우선합니다.
4. 예상 매출을 보장하거나 근거 없는 단일값으로 표현하지 않습니다.
5. `npm run verify`를 통과한 뒤 PR을 만듭니다.

## 브랜치와 커밋 예시

- 브랜치: `feature/easier-owner-input`
- 커밋: `feat: simplify owner input flow`
- 수정: `fix: prevent ad advice without campaign data`
- 문서: `docs: add pilot interview guide`
