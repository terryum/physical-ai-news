---
name: send-digest
description: "일일 다이제스트를 Substack에 발행하는 스킬. 크롤링된 사업공고·뉴스를 필터링하여 Substack 퍼블리케이션에 포스팅하고 구독자 전원에게 이메일 발송한다. '다이제스트', '뉴스레터', 'substack', '서브스택', '발행', '퍼블리시', '구독', 'newsletter', 'digest', 'publish', '클리핑', '일일 발행' 키워드 시 트리거. Substack 관련 작업이면 반드시 이 스킬을 사용할 것."
---

# Send Digest (Substack)

크롤링된 `public/data/items.json` 데이터를 기반으로 일일 다이제스트를 **Substack 퍼블리케이션**에 발행하는 스킬. Substack이 구독자 전원에게 이메일을 자동 발송한다.

## 다이제스트 3개 섹션

| 섹션 | 필터 기준 | 정렬 |
|------|----------|------|
| 새로 등록된 코스맥스 관련 사업공고 | gov, 72시간 이내, 코스맥스 관련 | 최신순 |
| 마감 임박 코스맥스 관련 사업공고 | gov, open, deadline 14일 이내, 코스맥스 관련 | 마감일순 |
| 오늘의 주요 뉴스 | news, P0, 48시간 이내 | 점수순 |

## 실행 명령

```bash
npm run digest               # Substack 발행 + 구독자 이메일 발송
npm run digest:preview       # ProseMirror JSON 프리뷰 (digest-preview.json)
npm run digest:dry-run       # 발행 없이 필터 결과만 콘솔 출력

# 테스트용 (구독자 이메일 발송 안 함)
SUBSTACK_SEND_EMAIL=false npm run digest
npx tsx scripts/send-digest.ts --no-email
```

## 데이터 흐름

```
public/data/items.json
    ↓
worker/digest/filter.ts          (3개 섹션 필터링)
    ↓
worker/digest/substack-body.ts   (ProseMirror JSON 빌드)
    ↓
worker/digest/substack-client.ts (Substack API 호출)
    ↓
Substack 퍼블리케이션
    ↓
구독자 이메일 (Substack이 자동 발송)
```

## 본문 구조

- 제목: `YYYY.MM.DD (요일) Physical AI News 일일 클리핑`
- 부제: `새 공고 N건 · 마감 임박 N건 · 주요 뉴스 N건`
- 본문: 각 섹션은 `heading(level=2)` + 기사 링크 문단들 (기사 타이틀은 원본 URL로 직접 연결)
- 하단 CTA: 중앙정렬 링크 `더 많은 소식 보기 →` ( `https://physical-ai-news.terryum.ai` )
- `button` ProseMirror 노드는 사용하지 않는다 — 사용 시 Substack 기본 구독 위젯이 사라짐

## 환경변수

| 변수 | 용도 | 등록 위치 |
|------|------|----------|
| `SUBSTACK_COOKIE` | substack.sid 쿠키값 (Chrome DevTools → Application → Cookies → substack.com) | GitHub Secret |
| `NEXT_PUBLIC_SUBSTACK_URL` | 퍼블리케이션 URL (예: `https://physicalainews.substack.com`) | GitHub Variable + Cloudflare Pages build env |
| `SUBSTACK_SUBDOMAIN` | 서브도메인 직접 지정 (옵션, `NEXT_PUBLIC_SUBSTACK_URL`에서 자동 추출) | 옵션 |
| `SUBSTACK_SEND_EMAIL` | `false` 시 구독자 이메일 발송 생략 (테스트) | 옵션 |

## 인증 흐름

1. `substack.sid` 쿠키로 `GET /api/v1/user/profile/self` → user_id 획득
2. `GET {subdomain}.substack.com/publish/posts` → `csrf-token` 쿠키 획득
3. `POST {subdomain}.substack.com/api/v1/drafts` (헤더에 `X-CSRFToken`)
4. `POST {subdomain}.substack.com/api/v1/drafts/{id}/publish` (`send_email: true`)

## 에러 매트릭스

| 상황 | 전략 |
|------|------|
| items.json 없음 | 에러 로그 + exit 1 |
| 3개 섹션 모두 빔 | 발행 스킵, 로그 출력, exit 0 |
| 401 / 403 (쿠키 만료) | 에러 로그 "substack.sid 재추출 필요" + exit 1 |
| 400 (필드 누락) | 응답 본문 로그 + exit 1, `publish-substack.py` 참조 구현과 페이로드 비교 |
| 발행 성공 | `digest-sent.json` 업데이트 → GitHub Actions가 git commit/push |

## 테스트 시나리오

### 정상 흐름
1. `npm run digest:dry-run` — 필터 결과 콘솔 확인
2. `npm run digest:preview` — `digest-preview.json` 생성, JSON 뷰어로 구조 검증
3. `.env.local`에 `SUBSTACK_COOKIE` + `NEXT_PUBLIC_SUBSTACK_URL` 설정 후 `SUBSTACK_SEND_EMAIL=false npm run digest` → Substack 웹에서 발행된 글 확인 (이메일 미발송)
4. `SUBSTACK_SEND_EMAIL` 해제 후 실제 발송, 본인 이메일로 수신 확인

### GitHub Actions 워크플로우
- `.github/workflows/digest.yml` 을 `workflow_dispatch`로 수동 실행
- Secret: `SUBSTACK_COOKIE`
- Variable: `NEXT_PUBLIC_SUBSTACK_URL`
- 실행 후 Substack 퍼블리케이션에 글이 올라오고 구독자 전원에게 메일 발송

## 쿠키 갱신 절차

`substack.sid`가 만료돼 401이 나면:
1. Chrome → `substack.com` 로그인 → F12 → Application → Cookies → `substack.sid` 값 복사
2. GitHub 레포 Settings → Secrets and variables → Actions → `SUBSTACK_COOKIE` 업데이트
3. `workflow_dispatch`로 재실행하여 확인
