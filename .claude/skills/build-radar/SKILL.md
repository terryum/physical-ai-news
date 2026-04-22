---
name: build-radar
description: "Physical AI News 전체 파이프라인을 오케스트레이션하는 스킬. 크롤링 → 큐레이션 → UI 빌드 → 배포까지 4개 에이전트를 조율한다. '레이더 빌드', '대시보드 만들어줘', '웹사이트 구축', 'Physical AI News', '전체 파이프라인', '풀 빌드', 'full build', '처음부터 빌드', '전체 실행' 키워드가 나오면 이 스킬을 사용할 것."
---

# Physical AI News Build Orchestrator

제조 피지컬AI 정부과제·뉴스 수집 대시보드를 빌드하고 배포하는 통합 오케스트레이터.

## 에이전트 구성

| 에이전트 | 정의 파일 | 역할 | 출력 |
|---------|----------|------|------|
| crawler-architect | `.claude/agents/crawler-architect.md` | 29개 소스 크롤링 | `RawItem[]` |
| content-curator | `.claude/agents/content-curator.md` | 분류·스코어링·중복 제거 | `Item[]` |
| fullstack-dev | `.claude/agents/fullstack-dev.md` | UI + 데이터 레이어 개발 | 소스 코드 |
| deploy-ops | `.claude/agents/deploy-ops.md` | GitHub push + Vercel 배포 + Actions cron | 배포 URL |

## 데이터 흐름

```
crawler-architect → (RawItem[]) → content-curator → (Item[]) → fullstack-dev → UI
                                                                      ↓
                                                              deploy-ops → GitHub + Vercel
```

### 파일 기반 데이터 전달
- crawler-architect 출력: `data/raw-items.json` (RawItem[])
- content-curator 출력: `public/data/items.json` (Item[] + meta)
- fullstack-dev: `public/data/items.json`을 fetch하여 UI에 표시
- deploy-ops: GitHub Actions가 전체 파이프라인을 cron으로 트리거

## 워크플로우

### Phase 1: 준비
1. PRD 파일 확인 (`docs/PRD_v3.md`)
2. 현재 프로젝트 상태 파악 (기존 코드, 패키지)
3. 변경 범위 결정
4. `config/sources.yaml`, `config/keywords.yaml` 확인

### Phase 2: 크롤링 (Progressive)
1. `crawler-architect` 에이전트로 fast phase 실행 (A~D 그룹)
   - 스킬: `.claude/skills/crawl-sources/SKILL.md`
   - 출력: `data/raw-items.json` (중간 결과)
2. `content-curator` 에이전트로 중간 큐레이션
   - 스킬: `.claude/skills/curate-content/SKILL.md`
   - 출력: `public/data/items.json` (`meta.phase: "fast"`)
3. `crawler-architect` 에이전트로 slow phase 실행 (E 그룹)
4. `content-curator` 에이전트로 최종 큐레이션
   - 출력: `public/data/items.json` (`meta.phase: "complete"`)

### Phase 3: 개발
1. `fullstack-dev` 에이전트로 기능 구현
   - 에이전트 정의: `.claude/agents/fullstack-dev.md` 참조
   - `public/data/items.json`에서 데이터를 읽어 UI 표시
   - 진행형 로딩 인디케이터 구현
2. `npm run build` 검증

### Phase 4: 배포
1. `deploy-ops` 에이전트로 배포
   - GitHub commit + push
   - `vercel deploy --prod --scope terry-ums-projects`
   - GitHub Actions cron 워크플로우 설정
2. 배포 URL 확인

## 진행형 크롤링 워크플로우

일상 운영에서는 GitHub Actions cron이 다음을 자동 실행한다:

```
[KST 09:00] cron 트리거
    ↓
[fast-crawl job]
    crawler-architect: A~D 그룹 병렬 실행 (수 초)
    content-curator: 중간 큐레이션
    deploy: items.json 업데이트 (phase: "fast")
    ↓
[slow-crawl job]
    crawler-architect: E 그룹 순차 실행 (수 분)
    content-curator: 최종 큐레이션 + 병합
    deploy: items.json 최종 업데이트 (phase: "complete")
```

UI는 items.json의 `meta.phase`를 읽어 fast 결과를 즉시 표시하고, complete가 되면 전체 결과로 갱신한다.

## 에러 핸들링

### 크롤링 에러
- 개별 소스 실패는 전체 파이프라인을 중단하지 않는다.
- 모든 소스가 실패한 경우에만 파이프라인을 중단하고 사용자에게 보고한다.

### 큐레이션 에러
- LLM API 실패: 규칙 기반 분류만으로 fallback
- 키워드 사전 누락: 내장 기본 키워드 셋 사용

### 빌드 에러
- TypeScript 에러 분석 후 자체 수정, 최대 3회 재시도
- 3회 실패 시 사용자에게 보고

### 배포 에러
- Vercel 배포 실패 → `vercel inspect`로 로그 확인 후 수정
- GitHub Actions 실패 → `gh run view`로 로그 확인

## 테스트 시나리오

### 정상 흐름
1. 사용자가 "레이더 빌드해줘" 요청
2. crawler-architect가 29개 소스 크롤링 (fast → slow)
3. content-curator가 T/P 분류 + 스코어링 + 중복 제거
4. fullstack-dev가 UI 갱신 + 빌드 통과
5. deploy-ops가 commit + push + vercel deploy
6. 배포 URL 반환

### 에러 흐름
1. 일부 소스 크롤링 실패 → 나머지 소스로 계속 진행
2. LLM API 다운 → 규칙 기반 분류로 fallback
3. 빌드 실패 → TypeScript 에러 수정 → 재빌드
4. 3회 실패 시 사용자에게 에러 보고
