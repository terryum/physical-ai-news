# CLAUDE.md

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Mention unrelated dead code; don't delete it.
- Remove imports/variables your changes orphaned.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → ensure tests pass before and after.

For multi-step tasks, state a brief plan with verifiable checks per step.

---

## Project: physical-ai-news (Physical AI News radar)

크롤링 → 큐레이션 → UI 빌드 → Cloudflare Pages 배포 파이프라인. 정부 사업공고와 Physical AI 관련 뉴스를 모아 일일 대시보드로 제공한다. PRD: `docs/PRD_v3.md`.

### ⚠ Next.js 14+ caveat
This project uses a Next.js version with **breaking changes** vs. older training data — APIs, conventions, and file structure may differ. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code; heed deprecation notices.

### Design system (single source of truth)
`docs/design-system.md`. `terryum-ai`와 동일한 `@theme` 토큰을 `src/app/globals.css`에 정의. 새 UI는 토큰 클래스만 사용 (`text-accent`, `bg-bg-surface`, `border-line-default`, `text-text-primary`). hex/rgb/oklch 인라인 금지. 우선순위/카테고리 위계는 색상이 아닌 텍스트·위치로 표현 (단일 teal accent 정책).

UI 컴포넌트 라이브러리 없음 — Base UI / shadcn / CVA / clsx / tailwind-merge 모두 제거됨. 순수 Tailwind 클래스만.

### Skills
`crawl-sources` (어댑터/크롤링), `curate-content` (분류·스코어링·중복 제거), `build-radar` (전체 파이프라인 오케스트레이션), `deploy-cloudflare` (배포).

### Deploy
GitHub push만으로 Cloudflare Pages가 자동 빌드·배포한다.

**See also**: `AGENTS.md`, `docs/design-system.md`, `docs/PRD_v3.md`.
