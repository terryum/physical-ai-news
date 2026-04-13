---
name: build-radar
description: "Physical AI Radar 웹 대시보드를 빌드하는 오케스트레이터. 프로젝트 구조 설정, UI 컴포넌트 생성, 시드 데이터 구성, Vercel 배포까지 전체 파이프라인을 실행한다. '레이더 빌드', '대시보드 만들어줘', '웹사이트 구축', 'Physical AI Radar' 키워드가 나오면 이 스킬을 사용할 것."
---

# Physical AI Radar Build Orchestrator

제조 피지컬AI 정부과제·뉴스 수집 대시보드를 빌드하고 배포하는 통합 스킬.

## 실행 모드: 서브 에이전트 (파이프라인)

작업이 순차적이고 에이전트 간 통신이 불필요하므로 서브 에이전트 모드를 사용한다.

## 에이전트 구성

| 에이전트 | 타입 | 역할 | 출력 |
|---------|------|------|------|
| fullstack-dev | general-purpose | UI + 데이터 레이어 개발 | 소스 코드 |
| deploy-ops | general-purpose | GitHub push + Vercel 배포 | 배포 URL |

## 워크플로우

### Phase 1: 준비
1. PRD 파일 확인 (`docs/PRD_v3.md`)
2. 현재 프로젝트 상태 파악 (기존 코드, 패키지)
3. 변경 범위 결정

### Phase 2: 개발
1. `fullstack-dev` 에이전트로 기능 구현
   - 에이전트 정의: `.claude/agents/fullstack-dev.md` 참조
   - model: opus
2. `npm run build` 검증

### Phase 3: 배포
1. `deploy-ops` 에이전트로 배포
   - GitHub commit + push
   - `vercel deploy --prod --scope terry-ums-projects`
2. 배포 URL 확인

## 에러 핸들링
- 빌드 실패 → TypeScript 에러 분석 후 자체 수정, 최대 3회 재시도
- Vercel 배포 실패 → `vercel inspect`로 로그 확인 후 수정
- 1회 재시도 후에도 실패 시 사용자에게 보고

## 데이터 전달
- 파일 기반: 모든 산출물은 프로젝트 디렉토리 내 파일로 전달
- 에이전트 간 통신 불필요 (순차 파이프라인)

## 테스트 시나리오

### 정상 흐름
1. 사용자가 "새 필터 기능 추가해줘" 요청
2. fullstack-dev가 컴포넌트 수정 + 빌드 통과
3. deploy-ops가 commit + push + vercel deploy
4. 배포 URL 반환

### 에러 흐름
1. fullstack-dev가 코드 작성 후 빌드 실패
2. TypeScript 에러 분석 → 수정 → 재빌드
3. 3회 실패 시 사용자에게 에러 보고
