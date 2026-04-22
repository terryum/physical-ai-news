---
name: deploy-cloudflare
description: "Physical AI News를 Cloudflare Pages에 배포하는 스킬. 'cloudflare 배포', '배포해줘', 'deploy', '프로덕션 올려줘' 요청 시 이 스킬을 사용할 것. GitHub push만으로 Cloudflare Pages가 자동 빌드·배포한다."
---

# Cloudflare Pages Deploy

Physical AI News를 GitHub에 push하면 Cloudflare Pages가 자동으로 정적 빌드하고 배포한다.

## 사전 조건
- `npm run build` 통과 필수 (정적 export → `out/` 생성 확인)
- Git working tree가 clean이거나, 커밋할 변경사항이 있어야 한다

## 절차

1. **빌드 검증**: `npm run build` → `out/index.html` 존재 확인
2. **Git 커밋**: 변경사항이 있으면 의미 있는 커밋 메시지로 커밋
3. **GitHub Push**: `git push origin main`
4. **배포 상태 확인**:
   ```bash
   wrangler pages deployment list --project-name=physical-ai-news | head
   ```
5. **결과 보고**: 배포 URL (`https://physical-ai-news.terryum.ai`)과 빌드 상태 반환

## 환경 정보
- Cloudflare Pages project: `physical-ai-news`
- GitHub repo: `terryum/physical-ai-news`
- 커스텀 도메인: `physical-ai-news.terryum.ai`
- 빌드 설정: `npm run build`, output directory `out`, Node 22
- 배포 방식: GitHub 연동 자동 빌드 (push만으로 트리거됨)

## 즉시 배포가 필요할 때
GitHub 연동으로 충분하지만, 수동 직접 배포가 필요하면:
```bash
npm run build
wrangler pages deploy out --project-name=physical-ai-news
```

## 주의사항
- `next.config.ts`의 `output: "export"`를 제거하면 Cloudflare Pages 빌드가 실패한다 (SSR 필요 시 `@cloudflare/next-on-pages` 어댑터 도입 필요)
- `public/data/items.json`이 커밋되면 Pages가 자동 재배포 → 일일 크롤 cron이 그대로 동작
