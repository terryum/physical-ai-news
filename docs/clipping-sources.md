# Physical AI News clipping sources

이 문서는 사람이 소스를 확인하고 후보를 추가하기 위한 운영 문서입니다. 실제 크롤러의 실행 원본은 `config/sources.yaml`입니다.

## 현재 상황

- 예약 크롤: `.github/workflows/crawl.yml`, 매일 `22:00 UTC` (`07:00 KST`)
- 배포: 크롤 후 같은 workflow에서 `npm run build`와 Cloudflare Pages 배포 실행
- 최신 로컬 데이터: `public/data/items.json`, 264건 (`gov` 64, `news` 100, `trending` 100)
- 최신 데이터의 가장 새 `publishedAt`: `2026-06-25T23:06:00.000Z`
- 등록 소스: 48개 (`enabled` 38, `disabled` 10)
- 주의: `schedule` 필드는 소스 메타데이터이며, 현재 실제 실행 주기는 GitHub Actions workflow가 결정합니다.

## 최근 출력에 포함된 소스

아래 표는 최신 `items.json`에 실제로 남은 소스입니다. 수집 후 스코어링, 중복 제거, 카테고리별 cap을 거친 결과라서 원시 수집 성공 수와 다를 수 있습니다.

| Source ID | 이름 | 유형 | 출력 건수 |
|---|---|---:|---:|
| `naver_news` | 네이버 뉴스 API | news | 94 |
| `arxiv_cs_ai` | arXiv cs.AI | trending | 56 |
| `ieee_spectrum_robotics` | IEEE Spectrum Robotics | trending | 23 |
| `kiat` | KIAT | gov | 15 |
| `arxiv_cs_ro` | arXiv cs.RO | trending | 13 |
| `srome` | SROME 과제공고 | gov | 10 |
| `kiria` | KIRIA | gov | 9 |
| `kros` | 한국로봇학회 (KROS) 공지 | gov | 9 |
| `kros_bbs2` | 한국로봇학회 (KROS) 학술 | gov | 9 |
| `kiria_noti` | KIRIA 공지사항 | gov | 8 |
| `robot_report` | The Robot Report | trending | 5 |
| `google_news_physicalai` | 구글뉴스 (피지컬AI) | news | 4 |
| `smtech` | SMTECH | gov | 4 |
| `arxiv_cs_lg` | arXiv cs.LG | trending | 3 |
| `google_news_manufacturing` | 구글뉴스 (제조자동화) | news | 2 |

## 등록된 enabled 소스

| Source ID | 이름 | 유형 | 그룹 | 권위 | 상태 메모 |
|---|---|---|---|---|---|
| `bizinfo` | 기업마당 | gov | A | discovery | API/RSS. 최근 GitHub Actions에서 타임아웃 발생. |
| `ntis` | NTIS | gov | A | discovery | enabled지만 현재 그룹 A 어댑터 미구현으로 스킵. |
| `naver_news` | 네이버 뉴스 API | news | A | discovery | 정상 출력 중. `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 필요. |
| `google_news_physicalai` | 구글뉴스 (피지컬AI) | news | B | discovery | 정상 출력 중. |
| `google_news_manufacturing` | 구글뉴스 (제조자동화) | news | B | discovery | 정상 출력 중. |
| `irobotnews` | 로봇신문 | news | C | canonical | 원시 수집은 되지만 최신 출력에는 없음. |
| `cosinkorea` | 코스인코리아 | news | C | canonical | 원시 수집은 되지만 최신 출력에는 없음. |
| `cmn` | CMN | news | C | canonical | 최근 검색 요청 일부 HTTP 404. |
| `cosmorning` | 코스모닝 | news | C | canonical | 원시 수집은 되지만 최신 출력에는 없음. |
| `beautynuri` | 뷰티누리 | news | C | canonical | 최근 검색 요청 일부 HTTP 404. |
| `jangup` | 장업신문 | news | C | canonical | 원시 수집은 되지만 최신 출력에는 없음. |
| `motie` | 산업부 | gov | D | canonical | 최근 한 실행에서 timeout. |
| `mss` | 중기부 | gov | D | canonical | 최근 한 실행에서 timeout. |
| `kiat` | KIAT | gov | D | canonical | 정상 출력 중. |
| `kiria` | KIRIA | gov | D | canonical | 정상 출력 중. |
| `kiria_noti` | KIRIA 공지사항 | gov | D | canonical | 정상 출력 중. |
| `korea_robot_assoc` | 한국AI로봇산업협회 | gov | D | canonical | 최근 원시 수집 0건. |
| `kros` | 한국로봇학회 (KROS) 공지 | gov | D | canonical | 정상 출력 중. |
| `kros_bbs2` | 한국로봇학회 (KROS) 학술 | gov | D | canonical | 정상 출력 중. |
| `smtech` | SMTECH | gov | D | canonical | 정상 출력 중. |
| `iris` | IRIS | gov | E | discovery | slow phase. 현재 Playwright 미구현으로 실행 안 됨. |
| `srome` | SROME 과제공고 | gov | D | canonical | 정상 출력 중. |
| `srome_demand` | SROME 수요조사 | gov | D | canonical | 최근 원시 수집 0건. |
| `smart_factory` | 스마트공장 사업관리 | gov | E | canonical | slow phase. 현재 Playwright 미구현으로 실행 안 됨. |
| `iitp` | IITP | gov | E | canonical | slow phase. 현재 Playwright 미구현으로 실행 안 됨. |
| `hackernews` | Hacker News | trending | G | discovery | 최근 Algolia 요청 400. 어댑터 점검 필요. |
| `reddit_ml` | r/MachineLearning | trending | G | discovery | GitHub Actions IP에서 Reddit 403. |
| `reddit_localllama` | r/LocalLLaMA | trending | G | discovery | GitHub Actions IP에서 Reddit 403. |
| `reddit_robotics` | r/robotics | trending | G | discovery | GitHub Actions IP에서 Reddit 403. |
| `reddit_singularity` | r/singularity | trending | G | discovery | GitHub Actions IP에서 Reddit 403. |
| `reddit_futurology` | r/Futurology | trending | G | discovery | GitHub Actions IP에서 Reddit 403. |
| `reddit_artificial` | r/artificial | trending | G | discovery | GitHub Actions IP에서 Reddit 403. |
| `arxiv_cs_ai` | arXiv cs.AI | trending | F | canonical | 정상 출력 중. |
| `arxiv_cs_ro` | arXiv cs.RO | trending | F | canonical | 정상 출력 중. |
| `arxiv_cs_lg` | arXiv cs.LG | trending | F | canonical | 정상 출력 중. |
| `robot_report` | The Robot Report | trending | F | canonical | 정상 출력 중. |
| `ieee_spectrum_robotics` | IEEE Spectrum Robotics | trending | F | canonical | 정상 출력 중. |
| `hf_daily_papers` | Hugging Face Daily Papers | trending | G | canonical | 원시 수집은 되지만 최신 출력에는 없음. |

## 비활성 소스

| Source ID | 이름 | 유형 | 메모 |
|---|---|---|---|
| `etnews` | 전자신문 | news | 비활성. |
| `hellot` | 헬로티 | news | 비활성. |
| `hankyung` | 한국경제 | news | 비활성. 네이버 API가 일부 커버. |
| `msit` | 과기정통부 | gov | 비활성. |
| `keit` | KEIT | gov | 비활성. |
| `nipa` | NIPA | gov | 비활성. |
| `tipa` | TIPA | gov | 비활성. |
| `nia` | NIA | gov | 비활성. |
| `gbsa` | GBSA (경기도) | gov | 비활성. |
| `rndia` | RNDIA (연구산업협회) | gov | 비활성. |

## 소스 추가 후보

새 소스를 추가하고 싶으면 아래 템플릿을 복사해 이 섹션에 붙입니다. Codex가 다음 작업에서 `config/sources.yaml`과 필요한 어댑터에 반영합니다.

```md
### 후보: 소스 이름

- URL:
- 유형: gov | news | trending
- 원하는 역할: canonical | discovery
- 형태: RSS | Google News RSS | API | 정적 HTML | Playwright 필요 | 모름
- 키워드:
- 왜 필요한가:
- 기대하는 항목 예시:
- 비고:
```

## 추가 기준

- RSS 또는 Google News RSS는 가장 빨리 추가할 수 있습니다.
- `group C` 나무엔미디어 CMS 계열은 기존 공통 어댑터를 재사용할 수 있습니다.
- 새 정부 HTML 사이트는 `worker/adapters/html-gov.ts`에 전용 파서가 필요할 수 있습니다.
- 로그인, AJAX, 세션, 무한 스크롤이 필요한 사이트는 Playwright 기반 slow source 구현이 필요합니다.
- 단순 발견용 검색 소스는 `discovery`, 원문 권위가 있는 기관/매체는 `canonical`로 둡니다.
