# Physical AI News

제조 피지컬 AI 관련 국내외 정부과제·뉴스 일일 모니터링 대시보드.

**Live**: https://physical-ai-news.terryum.ai
**Newsletter**: Substack 구독 (홈페이지 상단 폼에서 이메일 입력)

## Stack

- Next.js 16 App Router, 완전 정적 export (`output: "export"`)
- 크롤링: GitHub Actions cron → `public/data/items.json` 커밋
- 뉴스레터: Substack 자동 발행 (구독자 전원에게 이메일)
- 호스팅: Cloudflare Pages (GitHub 연동 없이 GH Actions → `wrangler pages deploy`)

## 개발

```bash
npm install
npm run dev              # http://localhost:3000
npm run build            # out/ 정적 빌드 생성
npm run digest:preview   # Substack 본문(ProseMirror JSON) 프리뷰 생성
npm run digest:dry-run   # 발행 없이 필터 결과만 출력
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
| `.github/workflows/digest.yml` | `0 4 * * *` (KST 13:00) | Substack 퍼블리케이션에 다이제스트 발행 → 구독자 이메일 자동 발송 |
| `.github/workflows/deploy.yml` | push to `main` | `npm run build` → `wrangler pages deploy` |

## Secrets & Variables (GitHub Actions)

### Secrets
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` — Naver Search News API
- `BIZINFO_API_KEY` — BizInfo 정부과제 API
- `SUBSTACK_COOKIE` — substack.sid 쿠키 (Chrome DevTools → Application → Cookies → substack.com)
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` — Pages 배포

### Variables
- `NEXT_PUBLIC_SUBSTACK_URL` — 퍼블리케이션 URL (예: `https://physicalainews.substack.com`). Cloudflare Pages 빌드 환경변수에도 동일하게 설정해야 홈페이지 구독 폼이 렌더링됨.

## Substack 구독 흐름

1. 방문자가 홈페이지 상단 구독 폼에 이메일 입력 → Substack으로 바로 제출
2. 매일 KST 13:00 `digest.yml`이 Substack에 글 발행
3. Substack이 구독자 전원에게 이메일 발송 (기사 링크는 원본 URL로 직접 이동)
4. 이메일 하단 "더 많은 소식 보기 →" 링크로 대시보드 유도
