# Physical AI News

제조 피지컬 AI 관련 국내외 정부과제·뉴스 일일 모니터링 대시보드.

**Live**: https://physical-ai-news.terryum.ai

## Stack

- Next.js 16 App Router, 완전 정적 export (`output: "export"`)
- 크롤링: GitHub Actions cron → `public/data/items.json` 커밋
- 이메일 다이제스트: nodemailer + Gmail SMTP
- 호스팅: Cloudflare Pages (GitHub 연동 없이 GH Actions → `wrangler pages deploy`)

## 개발

```bash
npm install
npm run dev              # http://localhost:3000
npm run build            # out/ 정적 빌드 생성
npm run digest:preview   # 이메일 다이제스트 HTML 프리뷰
npm run digest:dry-run   # 발송 없이 데이터만 검증
```

## 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동으로 빌드 후 Cloudflare Pages에 배포합니다. `wrangler`로 직접 배포하려면:

```bash
source ~/.config/claude-profiles/terry.env
export CLOUDFLARE_ACCOUNT_ID=8aeed63229bea7a24536210d873a5923
npm run build
npx wrangler pages deploy out --project-name=physical-ai-news --branch=main
```

## Cron 워크플로우

| Workflow | 스케줄 (UTC) | 역할 |
|---|---|---|
| `.github/workflows/crawl.yml` | `0 22 * * *` (KST 07:00) | 어댑터 실행 → `items.json` 커밋 → 자동 재배포 트리거 |
| `.github/workflows/digest.yml` | `0 4 * * *` (KST 13:00) | 이메일 다이제스트 발송 |
| `.github/workflows/deploy.yml` | push to `main` | `npm run build` → `wrangler pages deploy` |

## Secrets (GitHub Actions)

- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` — Naver Search News API
- `BIZINFO_API_KEY` — BizInfo 정부과제 API
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `DIGEST_RECIPIENT` — 다이제스트 이메일
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` — Pages 배포
