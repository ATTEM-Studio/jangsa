# GitHub 업로드 가이드

## 1. 저장소 만들기

GitHub에서 새 저장소를 만들고 이름을 `jangsa-navigation`으로 지정합니다. README나 `.gitignore`는 이 프로젝트에 이미 있으므로 저장소 생성 화면에서는 추가하지 않습니다.

## 2. 로컬에서 처음 올리기

프로젝트 폴더에서 아래 명령을 실행합니다. `YOUR_ID`는 GitHub 아이디로 바꿉니다.

```bash
git init
git add .
git commit -m "feat: add jangsa navigation v11"
git branch -M main
git remote add origin https://github.com/YOUR_ID/jangsa-navigation.git
git push -u origin main
```

## 3. GitHub Pages 켜기

1. 저장소의 `Settings`를 엽니다.
2. 왼쪽 메뉴에서 `Pages`를 선택합니다.
3. `Build and deployment`의 Source를 `GitHub Actions`로 선택합니다.
4. 저장소의 `Actions`에서 `Deploy GitHub Pages`가 완료되는지 확인합니다.

`main` 브랜치에 새 커밋을 올리면 테스트가 통과한 뒤 사이트가 자동으로 다시 배포됩니다.

## 4. 업로드 전 확인

```bash
npm ci
npm run verify
```

`dist/`는 자동 생성되므로 커밋하지 않습니다.
