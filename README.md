# Physical AI News

제조 피지컬 AI 관련 국내외 정부과제·뉴스 일일 모니터링 대시보드.

**Live**: https://physical-ai-news.terryum.ai

## Stack

- Next.js 16 App Router, 완전 정적 export (`output: "export"`)
- 크롤링: GitHub Actions cron → `public/data/items.json` 갱신
- 호스팅: Cloudflare Pages (GitHub 연동 없이 GH Actions → `wrangler pages deploy`)
- 소스 레지스트리: `config/sources.yaml`
- 소스 운영 문서: `docs/clipping-sources.md`

## 개발

```bash
npm install
npm run dev              # http://localhost:3000
npm run build            # out/ 정적 빌드 생성
```

## 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동으로 빌드 후 Cloudflare Pages에 배포합니다.
매일 예약 크롤은 `.github/workflows/crawl.yml`이 `items.json`을 갱신한 뒤 같은 workflow 안에서 Cloudflare Pages까지 배포합니다.
`wrangler`로 직접 배포하려면:

```bash
source ~/.config/claude-profiles/terry.env
export CLOUDFLARE_ACCOUNT_ID=8aeed63229bea7a24536210d873a5923
npm run build
npx wrangler pages deploy out --project-name=physical-ai-news --branch=main
```

## Cron 워크플로우

| Workflow | 스케줄 (UTC) | 역할 |
|---|---|---|
| `.github/workflows/crawl.yml` | `0 22 * * *` (KST 07:00) | 어댑터 실행 → `items.json` 커밋 → 정적 빌드 → Cloudflare Pages 배포 |
| `.github/workflows/deploy.yml` | push to `main` | `npm run build` → `wrangler pages deploy` |

## Secrets & Variables (GitHub Actions)

### Secrets
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` — Naver Search News API
- `BIZINFO_API_KEY` — BizInfo 정부과제 API
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` — Pages 배포

## 소스 추가 흐름

1. `docs/clipping-sources.md`의 "추가 후보" 섹션에 소스 후보를 적습니다.
2. Codex가 후보를 `config/sources.yaml`에 반영하고, 필요하면 어댑터를 추가합니다.
3. `npm run build`와 크롤 스크립트로 검증한 뒤 배포합니다.
