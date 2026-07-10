# 장사네비게이션 ver 11.0

자영업자가 어려운 지표를 해석하지 않아도 오늘 가장 먼저 실행할 행동 하나를 이해하도록 만든 고객 실행형 프로토타입입니다.

> 오늘 할 행동 하나 · 실행 순서 세 단계 · 7일 뒤 확인할 숫자 하나

## 바로 실행하기

`index.html`을 더블클릭하면 브라우저에서 실행됩니다. 별도 설치나 서버가 필요하지 않습니다.

개발 서버 없이 간단히 확인하려면 다음 명령도 사용할 수 있습니다.

```bash
npm ci
npm run verify
```

## GitHub에 올리기

GitHub에서 빈 `jangsa-navigation` 저장소를 만든 뒤 프로젝트 폴더에서 실행합니다.

```bash
git init
git add .
git commit -m "feat: add jangsa navigation v11"
git branch -M main
git remote add origin https://github.com/YOUR_ID/jangsa-navigation.git
git push -u origin main
```

자세한 과정은 [`docs/github-upload-guide.md`](docs/github-upload-guide.md)에서 확인할 수 있습니다.

## GitHub Pages 배포

저장소의 `Settings → Pages → Build and deployment`에서 Source를 `GitHub Actions`로 선택합니다. 이후 `main` 브랜치에 커밋하면 자동으로 다음 과정이 실행됩니다.

1. 의존성 설치
2. 문법 검사
3. 자동 테스트
4. 정적 사이트 빌드
5. GitHub Pages 배포

## ver 10.0에서 달라진 점

- 5단계·19개 입력을 상황별 3단계 입력으로 축소
- 사장님이 실제로 쓰는 고민 문장부터 선택
- 실행할 수 없는 행동은 추천 후보에서 제외
- 데이터 부족 시 억지 추천 대신 확인할 숫자 한 개 안내
- Action Score는 내부 판단용으로 숨기고 근거 수준만 표시
- 객단가 예상효과를 전체 손님이 아닌 20~40% 선택률 범위로 계산
- 결과 첫 화면은 행동·이유·시간·3단계·확인지표만 표시
- 추천 수락·불일치 피드백과 실행 결과 기록
- 민감한 원본 숫자를 URL에 넣는 공유 기능 제거
- 최근 10개 진단을 브라우저 로컬 저장소에만 보관

## 검증

```bash
npm ci
npm run verify
```

검증에는 추천엔진 단위 테스트, 36개 균형 검증 시나리오, 입력 변환, 화면 흐름, 정적 빌드 테스트가 포함됩니다.

## 파일 구조

```text
index.html                 화면 구조
assets/styles.css          반응형 디자인
assets/favicon.svg         사이트 아이콘
src/engine.js              계산·추천엔진
src/ui-logic.js            입력 검증·기록 변환
src/app.js                 화면 동작·로컬 기록
scripts/build-static.cjs   GitHub Pages용 정적 빌드
tests/                     자동 검증
docs/validation-plan.md    실제 고객 검증 계획
.github/workflows/         CI·Pages 자동화
AGENTS.md                  AI 개발 작업 규칙
```

`dist/`는 `npm run build`로 생성되는 배포 결과이며 Git에 올리지 않습니다.

## 현재 범위와 한계

- 서버·로그인·다중 매장 계정 기능은 포함하지 않은 검증용 MVP입니다.
- 입력과 진단 이력은 현재 브라우저에만 저장됩니다.
- 추천은 실행 우선순위를 돕는 참고 정보이며 매출을 보장하지 않습니다.
- 실제 공개 전 자영업자 사용성 테스트와 3~5개 매장 파일럿이 필요합니다.

## 문서

- [고객 검증 계획](docs/validation-plan.md)
- [GitHub 업로드 가이드](docs/github-upload-guide.md)
- [기여 가이드](CONTRIBUTING.md)
- [보안 안내](SECURITY.md)
- [변경 기록](CHANGELOG.md)
