# PRD v3 — Physical AI News

> 두 개의 PRD가 같은 manifold 위 다른 좌표에서 출발했다. v3는 그 둘의 안장점에서 다시 시작한다. 제품 사양은 v1의 압축에서, 운영 골격은 v2의 분리(分離)에서 가져온다. 목적은 변하지 않는다 — **놓치지 않음**.

---

## 0. v3 변경 요약 (vs v1)

| 영역 | v1 | v3 | 이유 |
|---|---|---|---|
| **아키텍처** | Vercel Cron + API Route 단일 | **Monorepo 분리**: `apps/web`(Vercel) + `apps/worker`(GitHub Actions) | Vercel 서버리스에서 Playwright·세션쿠키 정부사이트가 깨진다. 프론트 배포 실패가 수집을 막아서도 안 된다. |
| **중요도** | T0~T3 단일축 | **T(주제) × P(중요도) 이중축** 도입 (P0/P1/P2) | "관련 있음"과 "지금 봐야 함"은 다른 차원이다. |
| **소스 분류** | 평면 목록 | **canonical vs discovery** 구분 | 원문 권위와 발견용 보조를 같은 무게로 다루면 dedup이 무너진다. |
| **소스 정의** | 코드 하드코딩 | **YAML source registry** | Claude Code가 어댑터를 추가/수정할 때 진입점이 단 하나여야 한다. |
| **어댑터** | 단순 함수 | **`SourceAdaptor` 인터페이스 + fixture 회귀 테스트** | 정부 사이트 HTML이 바뀔 때마다 부서지지 않으려면 계약과 회귀가 필요하다. |
| **운영 기능** | 없음 | source on/off, exclude keyword, canonical override, degraded 상태, 마지막 성공 시각 | v1.0부터 운영 흠집이 보이지 않으면 그 자체가 누수다. |
| **화장품 제조 맥락** | T2/T3 부울조건 | + 스코어링 규칙에 명시(생산/품질/설비/물류 컨텍스트 가중) | 마케팅·소비자용 AI 기사 노이즈를 점수로 차단. |

---

## 1. 제품 정의

### 문제
한국 내 피지컬AI·제조AX·화장품 ODM 신호는 (1) 부처별 분산 R&D 공고, (2) 종합지·업계지에 산발한 뉴스, (3) 동일 사안 중복 게시 — 세 축에서 누수된다. **하루 5분 안에 관련 신호를 전수 스캔**할 단일 게시판이 없다.

### 목적
한국 내 **제조 피지컬AI 정부과제와 뉴스**를 매일 자동 수집하고, **화장품 제조 관점에서 꼭 봐야 할 항목만** 선별하여, **한 페이지 게시판**에서 빠르게 훑고 **원문으로 즉시 이동**한다.

### 사용자
Terry 1인 (Head of AI, COSMAX). 매일 아침 1회 + 모바일 1~2회. 한 세션 60초 안에 20~50건 스캔.

### 제품 원칙
1. 놓치지 않음이 최우선 (recall > precision, 단 정밀도 임계 70% 사수).
2. 원문 링크 우선. 본문 저장·요약·재가공은 비목적.
3. 중복은 숨기고 링크는 보존.
4. 제조 피지컬AI · 화장품 제조 맥락 우선.
5. **Claude Code가 고치기 쉬운 구조**가 곧 운영 안정성이다.

### 비목표
다중 사용자, 권한, 댓글, 협업, 본문 풀텍스트 검색, 자동 요약(v1.0 한정), 푸시 알림(v1.1 이후).

---

## 2. 이중축 분류 — Topic(T) × Priority(P)

T는 **무엇에 관한가**, P는 **얼마나 시급한가**. 두 축이 직교하므로 T0 항목이 P2일 수도, T3 항목이 P0일 수도 있다.

### 2.1 Topic Tier

| Tier | 범주 | 키워드 | 매칭 규칙 |
|---|---|---|---|
| **T0** | 제조 피지컬AI (핵심) | 제조 피지컬AI, Physical AI, embodied AI in manufacturing, 제조 AI 로봇, 자율제조, 제조 파운데이션 모델, VLA, Code-as-Policy, 산업용 agentic AI, Isaac Sim 산업 적용 | 단독 매칭 허용 |
| **T1** | 인접 핵심 | 화장품 제조 자동화, 로보틱스/로봇, 휴머노이드, AI agent, 스마트팩토리, 제조AX/산업AX, 비전검사, 디지털트윈, 협동로봇 | 단독 매칭 허용 |
| **T2** | ODM 경쟁사 | 한국콜마, 씨앤씨인터내셔널, 코스메카코리아, 인터코스, 씨앤텍, 엔코스 | **AND (AI/로봇/자동화/스마트팩토리/제조DX/디지털전환)** 필수 |
| **T3** | 종합 화장품사·브랜드 | LG생활건강, 아모레퍼시픽, 애경, APR, 조선미녀, 더파운더즈, 아누아, 달바 | **AND (AI/로봇/자동화/스마트팩토리/제조DX/디지털전환)** 필수 |

기업명 단독 매칭 금지는 v3의 노이즈 차단 핵심 게이트.

### 2.2 Priority

| Priority | 정의 | 기본 노출 |
|---|---|---|
| **P0** | 즉시 봐야 함. ① 제조 피지컬AI 직접 정부과제 ② 제조 현장 AI/로봇/자동화 직접 기사 ③ T2/T3 기업의 생산·품질·물류·설비 자동화 기사 ④ 경기도/중앙정부 실증·보급 지원사업 | ✅ |
| **P1** | 봐두면 좋음. 정책·시장 동향, 인접 주제(스마트팩토리/디지털트윈/뷰티AI), 타 업종 제조AX 사례 | ✅ |
| **P2** | 관찰용. 직접 실행성은 낮지만 맥락 가치가 있음 | ❌ (토글로 노출) |

P0는 **반드시 규칙 기반으로만 결정**한다. LLM은 P1/P2 경계 보정에만 사용.

---

## 3. 소스 전략 — Canonical vs Discovery

### 3.1 구분

**Canonical source** — 원문 권위. 최종 링크와 대표 제목을 결정하는 출처. 중복 묶음의 부모 항목.
- **정부과제**: IRIS, 스마트공장 사업관리시스템, NIPA(nxt.nipa.kr), MSS/SMTECH, KEIT/SROME, KIAT/K-PASS, IITP, KIRIA, NIA, TIPA, 경기도청/GBSA/경기기업비서, 클라우드·데이터 바우처

**Discovery source** — 발견용 보조. 누수 방지가 목적. 단독으로는 부모가 되지 않고 canonical로 매핑.
- 기업마당, 구글 뉴스 RSS, 네이버 뉴스 검색, 기관 보도자료, 업계지 검색 결과

### 3.2 MVP 소스 (v1.0)

**정부과제 (9)**: ① IRIS ② 기업마당(discovery) ③ 스마트공장 사업관리시스템 ④ NIPA ⑤ SMTECH/MSS ⑥ K-PASS(KIAT) ⑦ KEIT/SROME ⑧ KIRIA ⑨ 경기기업비서 또는 GBSA

**뉴스 (11)**: ① 전자신문 ② 헬로티 ③ 로봇신문 ④ 한국경제 ⑤ 코스인코리아 ⑥ CMN ⑦ 코스모닝 ⑧ 뷰티누리 ⑨ 장업신문 ⑩ 구글 뉴스 RSS ⑪ 네이버 뉴스 검색 API

**시드 데이터**: 첨부 PDF의 2026 과기정통부·산업부·중기부 통합공고 11개 사업을 v1.0 출시일에 사전 등록.

---

## 4. UX

### 단일 페이지 게시판

```
┌──────────────────────────────────────────────────────────────────┐
│ Physical AI News     [전체|공고|뉴스]  [P0|P1|P2]  [T0|T1|T2|T3] │
│ 검색 [_______]    기간 [오늘|7일|30일]   기관 [_]  지역 [_]      │
├──────────────────────────────────────────────────────────────────┤
│ ● 03.25 [공고] 산업AI 에이전트 기술개발     P0 T0 산업부·KIAT    │
│         ↳ iris.go.kr · k-pass.kr             마감 04.20          │
│ ● 03.25 [뉴스] 한국콜마, 평택공장 AI 비전검사 도입   P0 T2 전자신문│
│         #한국콜마 #비전검사                                      │
│ ○ 03.24 [공고] 제조AI 특화 스마트공장        P0 T0 중기부 800억  │
│         ↳ smart-factory.kr                   마감 04.30          │
│ ○ 03.24 [뉴스] LG생활건강, 청주 자동화 라인  P1 T3 CMN          │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

**한 행**: 읽음(●/○) · 날짜 · 종류 · 제목 · P배지 · T배지 · 기관/매체 · (마감일|예산|기업태그) · 링크 수.

**다중 링크**: 동일 사안은 1행으로 묶고 `↳` 자식 줄에 출처별 링크 나열. 사용자가 골라 클릭.

**필터**: 종류(공고/뉴스), Priority(P0/P1/P2 토글, 기본 P0+P1), Topic(T0~T3), 기간, 기관, 지역, 키워드 검색.

**상세 페이지 없음** (v1.0). 클릭은 외부 이동만. 별표·읽음만 인라인.

---

## 5. 데이터 모델

```ts
export type SourceType = "gov" | "news";
export type Tier = "T0" | "T1" | "T2" | "T3";
export type Priority = "P0" | "P1" | "P2";
export type LinkKind = "canonical" | "mirror" | "apply" | "related";

export interface Item {
  id: string;                  // hash(normalizedTitle + canonicalDomain)
  itemType: SourceType;
  title: string;
  normalizedTitle: string;
  canonicalUrl: string;
  publishedAt: string;         // ISO
  fetchedAt: string;
  deadlineAt?: string;         // 정부과제 마감
  budgetKrwOk?: number;        // 정부과제 예산(억원)
  sourceName: string;
  sourceAuthority: "canonical" | "discovery";
  tier: Tier;
  priority: Priority;
  score: number;               // 0~100
  matchedKeywords: string[];
  matchedCompanies: string[];
  matchedAgencies: string[];
  region?: string;
  status?: "open" | "upcoming" | "closed";
  duplicateGroupId?: string;
  links: { label: string; url: string; kind: LinkKind }[];
  read: boolean;
  starred: boolean;
  // 운영용
  scoreBreakdown?: Record<string, number>;
  llmJudgment?: "pass" | "hold" | "drop";
  overrides?: { priority?: Priority; tier?: Tier; reason: string };
}
```

---

## 6. 중복 제거

### 정부과제
1. **공고번호 동일** → 즉시 병합
2. **사업명 정규화 동일** → 병합
3. **사업명 임베딩 코사인 ≥ 0.88 + 접수기간 겹침** → 병합
4. **대표 첨부파일/접수 URL 동일** → 병합

### 뉴스
1. 제목 정규화 동일 → 병합
2. 제목 임베딩 코사인 ≥ 0.90 + 발행일 ±2일 → 병합
3. 동일 기업·동일 발표 이벤트 엔티티 일치 → 병합 후보, 사람 검수 큐로

### 병합 규칙
- **canonical source가 부모**, discovery는 자식
- 자식은 `links[]`에 `kind: "mirror"|"related"`로 추가
- 부모 후보가 둘 이상이면 (a) 권위 (b) 발행 시각 빠른 쪽 우선
- 뉴스는 같은 사안이라도 **대표 1건 + 관련 기사 링크**로 표시 (요약하지 않음)

---

## 7. 스코어링 — 규칙 우선, LLM 보조

### 7.1 규칙 (P0 결정의 유일한 근거)

| 조건 | 점수 |
|---|---|
| 제조 피지컬AI 직접 언급 | +30 |
| (로봇 OR 자동화) AND 제조 동시 등장 | +20 |
| T2/T3 기업 AND (생산/품질/설비/물류/공장) 컨텍스트 | +20 |
| 정부 실증/보급/지원/국책과제 키워드 | +25 |
| 화장품 제조 키워드 (충진, 라벨링, 포장, 디스펜싱, 뷰티 ODM) | +15 |
| 경기도 지역 매칭 | +10 |
| 단순 소비자용 AI/마케팅 기사 | -20 |
| 주가/공시/IR 단독 기사 | -15 |
| exclude keyword 매칭 | -50 |

**P 결정**:
- score ≥ 60 AND (T0 OR (T2/T3 AND 생산컨텍스트)) → **P0**
- score ≥ 30 → **P1**
- 그 외 → **P2**

### 7.2 LLM 판정 (Claude Haiku)
- **언제만**: 점수 25~45 경계 구간
- **역할**: 통과 / 보류 / 제외 3분류
- **금지**: P0 결정에 개입 금지
- **상한**: 일 1,000콜, 환경변수 통제

---

## 8. 아키텍처 — Monorepo 분리

```text
physical-ai-radar/
├── apps/
│   ├── web/                    # Next.js 15 dashboard (Vercel 배포)
│   └── worker/                 # crawler · scorer · dedup (GH Actions)
├── packages/
│   ├── core/                   # schemas, scoring, dedup, normalize
│   ├── sources/                # source adaptors (어댑터 한 폴더에 모음)
│   ├── config/                 # source registry, keywords, watchlists
│   ├── db/                     # drizzle schema + queries
│   └── tests/                  # fixtures, parser regression
├── infra/
│   ├── github-actions/         # 스케줄 크론 워크플로우
│   └── scripts/                # seed, backfill, repair
├── CLAUDE.md                   # harness 운영 규약
└── pnpm-workspace.yaml
```

### 런타임 분리
- **Frontend**: Next.js 15 App Router on **Vercel** (Tailwind, shadcn/ui, RSC)
- **DB**: **Neon Postgres** (또는 Supabase). drizzle ORM. 항목 < 50k/년.
- **Crawler/Worker**: **GitHub Actions scheduled job** (cron 1h). Playwright 필요 소스는 여기서만 실행. 결과는 DB direct write.
- **인증**: Vercel Password Protection 단일 비밀번호.

### 왜 분리하는가
1. Vercel 서버리스의 Playwright·세션쿠키 제약과 동적 정부 사이트가 충돌한다.
2. 프론트 배포 실패가 수집 파이프라인을 죽이지 않는다.
3. Claude Code가 디렉토리 경계를 명확히 인식 → harness가 안정적으로 동작.
4. 어댑터를 fixture 기반으로 회귀 테스트하기 쉽다.

---

## 9. Harness 친화 규칙

### 9.1 Source Registry (YAML)
모든 소스를 코드 하드코딩 금지. `packages/config/sources.yaml` 단일 진입점.

```yaml
- id: iris
  type: gov
  authority: canonical
  fetch_mode: html
  schedule: "0 */6 * * *"
  parser: irisNoticeList
  enabled: true
  tags: [r&d, multi-ministry]

- id: smart_factory
  type: gov
  authority: canonical
  fetch_mode: html
  schedule: "0 */6 * * *"
  parser: smartFactoryList
  enabled: true

- id: google_news_physical_ai
  type: news
  authority: discovery
  fetch_mode: rss
  query: '"제조 피지컬AI" OR "스마트팩토리" OR "휴머노이드 화장품"'
  schedule: "0 */2 * * *"
  enabled: true

- id: cosin_korea
  type: news
  authority: canonical
  fetch_mode: html
  parser: cosinList
  schedule: "0 */3 * * *"
  enabled: true
```

### 9.2 Parser Contract
모든 어댑터는 동일 인터페이스. Claude Code가 새 어댑터를 추가할 때 단 하나의 모양만 학습하면 된다.

```ts
export interface SourceAdaptor {
  id: string;
  fetchList(): Promise<RawListItem[]>;
  fetchDetail?(item: RawListItem): Promise<RawDetail | null>;
  normalize(
    input: RawListItem,
    detail?: RawDetail | null
  ): Promise<NormalizedCandidate[]>;
}
```

### 9.3 테스트 전략
- **HTML fixture 저장**: `packages/tests/fixtures/{source_id}/*.html` — 매 어댑터 변경 전 캡처.
- **normalize snapshot 테스트**: fixture → 정규화 결과 스냅샷 비교.
- **dedup regression**: 알려진 중복 케이스 50개 회귀.
- **score rule unit test**: 각 가중치 규칙별 케이스.

### 9.4 운영 명령 (worker CLI)
```
pnpm crawl:once               # 전체 1회 수집
pnpm crawl:source iris        # 단일 소스 수집
pnpm score:backfill           # 점수 재계산
pnpm dedup:repair             # 중복 그룹 재구성
pnpm seed:ax-2026             # 통합공고 시드 적재
pnpm fixtures:capture iris    # 현재 HTML 캡처
```

---

## 10. 운영 기능 (v1.0 필수)

| 기능 | 동작 |
|---|---|
| **source on/off** | YAML enabled 토글 또는 admin UI |
| **exclude keyword** | 글로벌·소스별 부정 키워드 |
| **priority override** | 항목별 P 강제 지정 + 사유 기록 |
| **canonical override** | 잘못 묶인 중복그룹의 부모 재지정 |
| **마지막 성공 수집 시각** | 소스별 표시 |
| **소스별 에러 로그** | 최근 N건 |
| **degraded 상태** | 3회 연속 실패 시 자동 표시, 알림 |

### 장애 대응 룰
- 어댑터 실패 3회 연속 → `degraded` 표시, 게시판 상단 배너
- parser 변경 PR은 fixture 회귀 테스트 통과 필수
- 수집 실패가 24시간 지속 시 daily digest에 포함 (v1.1)

---

## 11. MVP 범위

### v1.0 (Must)
- Monorepo 셋업 (apps/web, apps/worker, packages/*)
- DB 스키마 + drizzle migration
- Source registry YAML + parser contract
- 정부과제 어댑터 9개, 뉴스 어댑터 11개
- T0~T3 키워드 + P0~P2 스코어링 + dedup
- 게시판 UI (필터·검색·다중링크·읽음·별표)
- GitHub Actions 크론
- 시드 데이터 적재 (2026 통합공고 11개)
- 운영 기능 7종 (§10)

### v1.0 (Should)
- 다크 모드, 모바일 레이아웃
- exclude keyword UI
- degraded 배너

### v1.1
- P0 신규 항목 Slack/Email 일 1회 다이제스트
- 아침 브리프 자동 생성
- watchlist UI 편집 (키워드·기업)
- 상세 drawer 옵션
- 추가 소스 (NTIS, 클라우드/데이터 바우처, NIA, IITP, TIPA)
- LLM 1줄 요약

### Won't (당분간)
- 다중 사용자, 권한, 협업, 댓글
- 본문 풀텍스트 저장·검색
- 모바일 네이티브 앱

---

## 12. 마일스톤 (4주)

| 주차 | 산출물 |
|---|---|
| **W1** | monorepo · DB · source registry · parser contract · IRIS / 기업마당 / Google News RSS / 코스인 어댑터 4종 · 시드 적재 |
| **W2** | dedup · 규칙 스코어링 · P 결정 로직 · 게시판 UI 1차 · 필터·다중링크·읽음·별표 |
| **W3** | 스마트공장 / NIPA / SMTECH / K-PASS / KEIT / CMN / 로봇신문 / 전자신문 어댑터 · 운영 로그 화면 · degraded 표시 |
| **W4** | KIRIA / 경기기업비서 · 모바일 정리 · LLM 경계 판정 · 1주 운영 후 임계치·키워드 보정 |

---

## 13. 성공 지표

- **재현율**: 매주 수동 샘플링, T0/P0 누락률 **< 5%**
- **정밀도**: 게시판 노출 항목 중 "관련 있음" 판정 비율 **≥ 70%**
- **스캔 시간**: 일 평균 세션 **< 5분** 안에 전수 확인
- **운영 비용**: 월 **< $30** (Vercel + Neon + Haiku + GH Actions 무료 한도)
- **어댑터 안정성**: degraded 상태 어댑터 비율 < 10%

---

## 14. 리스크

| 리스크 | 대응 |
|---|---|
| 정부 사이트 HTML 잦은 변경 | fixture 회귀 + degraded 자동 표시 |
| 네이버 뉴스 API 호출 한도 | 키워드×Tier 조합 회전 스케줄 |
| 동일 사안 dedup 과병합 | canonical override + 사람 검수 큐 |
| LLM 비용 폭주 | 일 1,000콜 하드 캡 + 점수 경계 구간만 |
| GH Actions 실행 시간 한도 | 소스별 워크플로우 분리 + 병렬화 |
| 화장품 ODM 한정 노이즈 | exclude keyword + 마케팅 기사 -20 가중 |

---

## 15. CLAUDE.md 핵심 (worker repo)

```md
- 새 소스 추가 시: ① YAML 등록 ② parser 작성 ③ fixture 캡처 ④ snapshot 테스트 통과
- 어댑터 수정 시: 기존 fixture 회귀 우선 → 실패 시 fixture 재캡처는 사유 기록
- DB 마이그레이션은 drizzle만 사용
- LLM 호출은 packages/core/llm.ts 경유, 직접 호출 금지
- venv·global install 금지, pnpm workspace로만 설치
- score rule 변경 시 unit test 추가 필수
```

---

> 제품은 한 페이지 게시판이고, 운영은 두 개의 런타임이며, 의사결정은 두 개의 축이다. 단순함이 무너지는 지점에서만 분리한다 — 그 외에는 다 압축한다.
