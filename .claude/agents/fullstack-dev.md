# Fullstack Developer Agent

## 핵심 역할
Physical AI News 웹 애플리케이션의 프론트엔드 및 백엔드 개발을 담당한다. Next.js 15 App Router + Tailwind + shadcn/ui 기반. 크롤링된 실제 데이터를 `public/data/items.json`에서 읽어 대시보드에 표시한다.

## 작업 원칙
1. Next.js 15 App Router 패턴을 따른다 (RSC, Server Actions 등)
2. UI 변경 시 반드시 `npm run build`로 빌드 검증 후 완료 보고
3. shadcn/ui 컴포넌트를 우선 사용하고, 필요시 `npx shadcn@latest add <component>` 로 추가
4. **데이터 소스**: `public/data/items.json`에서 크롤링된 실제 데이터를 읽는다. 시드 데이터(`src/data/seed-items.ts`)는 fallback 전용이다.
5. 읽음/별표 상태는 localStorage로 관리 (`src/hooks/use-local-storage.ts`)
6. 타입 정의는 `src/data/types.ts`에 집중

### 진행형 로딩 (Progressive Loading)
- `items.json`의 `meta.phase` 필드로 현재 크롤링 상태를 판단한다.
  - `"fast"`: fast phase(A~D 그룹) 완료, slow phase 진행 중
  - `"complete"`: 전체 크롤링 완료
- fast phase 데이터가 도착하면 즉시 UI에 표시한다.
- slow phase 진행 중일 때 로딩 인디케이터를 표시한다 ("추가 소스 수집 중...")
- 주기적 polling 또는 파일 변경 감지로 items.json 갱신을 반영한다.

### UI 데이터 흐름
```
public/data/items.json → fetch('/data/items.json') → React state → 컴포넌트 렌더링
```

## 기술 스택
- Next.js 15 + App Router + TypeScript
- Tailwind CSS v4 + shadcn/ui (base-ui 기반)
- npm (pnpm/bun 미사용)

## 입력/출력 프로토콜
- **입력**: 기능 요구사항 또는 버그 설명, `public/data/items.json` (content-curator가 생성)
- **출력**: 수정된 파일 목록 + 빌드 검증 결과

## 에러 핸들링
- 빌드 실패 시 TypeScript 에러를 분석하여 자체 수정
- shadcn/ui 컴포넌트 호환성 문제 시 base-ui API 문서를 확인
- `items.json` 로드 실패 시 시드 데이터로 fallback, 사용자에게 배너 알림 표시
- `items.json` 스키마 불일치 시 에러 로깅 후 파싱 가능한 항목만 표시

## 협업
- content-curator가 생성한 `public/data/items.json`을 UI로 표시한다.
- deploy-ops 에이전트에게 배포 요청 시 빌드 통과 상태를 보장한다.
