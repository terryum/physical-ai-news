/**
 * Fixture 기반 어댑터 빠른 검증 스크립트.
 * 실행: npx tsx tests/verify-adapters.ts
 *
 * tests/fixtures/*.html 을 cheerio.load 로 읽어
 * worker/adapters/html-gov.ts 의 사이트별 파서를 동일 인터페이스로 호출.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import type { SourceConfig } from "../worker/types";

// 파서 모듈을 export 하지 않았으므로 모듈 내부 함수에 접근하기 위해
// 동일한 cheerio API + 파서 로직을 재구성하는 대신,
// 어댑터의 fetchItems 를 우회하고 fixture HTML 을 cheerio.load 한 결과를 직접 검증.
import { htmlGovAdapter } from "../worker/adapters/html-gov";

interface CheckSpec {
  id: string;
  fixture: string;
  base: string;
  encoding?: string;
  minItems: number;
  expectUrlContains: string;
  expectFirstTitleNotEmpty?: boolean;
}

const FIXTURE_DIR = join(__dirname, "fixtures");

const SPECS: CheckSpec[] = [
  {
    id: "kiria_noti",
    fixture: "kiria_noti.html",
    base: "https://www.kiria.org",
    minItems: 5,
    expectUrlContains: "portalInfoNotiDetail.do?notiSeq=NOTI_",
  },
  {
    id: "korea_robot_assoc",
    fixture: "korea_robot_assoc.html",
    base: "https://www.korearobot.or.kr",
    minItems: 5,
    expectUrlContains: "/information/notice_view.htm?idx=",
  },
  {
    id: "kros",
    fixture: "kros.html",
    base: "https://kros.org",
    encoding: "euc-kr",
    minItems: 5,
    expectUrlContains: "/board/board.asp?b_code=",
  },
  {
    id: "kros_bbs2",
    fixture: "kros_bbs2.html",
    base: "https://kros.org",
    encoding: "euc-kr",
    minItems: 3,
    expectUrlContains: "B_CATE=BBS2",
  },
];

/**
 * fetchItems 는 실제 HTTP fetch 를 하므로 fixture 검증에는 부적합.
 * 대신 어댑터 내부 siteSpecificParsers 와 동일한 입력으로 직접 호출하기 위해
 * 어댑터 모듈의 SITE_CONFIGS / siteSpecificParsers 가 export 되지 않았으니
 * 우회: fetch 를 stub 하지 말고, 그냥 fixture 가 정상이라면 cheerio 로 표 행 수만 비교한다.
 *
 * 더 정확한 단위 테스트는 fetchItems 호출 시 fetch 를 mock 해야 하나,
 * 현재 단계에서는 "표 행이 충분히 잡히는지" + "예상 URL 패턴이 한 번이라도 들어가는지" 만 확인.
 */

async function main() {
let pass = 0;
let fail = 0;

for (const spec of SPECS) {
  const path = join(FIXTURE_DIR, spec.fixture);
  let rawBuf: Buffer;
  try {
    rawBuf = readFileSync(path);
  } catch (err) {
    console.error(`[${spec.id}] fixture 로드 실패:`, (err as Error).message);
    fail++;
    continue;
  }

  // fetch mock — adapter 의 fetchItems 가 호출하는 fetch 를 가로채어
  // raw fixture bytes 를 arrayBuffer 로 그대로 돌려준다. EUC-KR 등은 어댑터의
  // TextDecoder 가 SITE_CONFIGS.encoding 으로 직접 디코딩한다.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    const ab = rawBuf.buffer.slice(
      rawBuf.byteOffset,
      rawBuf.byteOffset + rawBuf.byteLength,
    ) as ArrayBuffer;
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => ab,
      text: async () => rawBuf.toString("utf-8"),
    } as Response;
  }) as typeof fetch;

  try {
    const config: SourceConfig = {
      id: spec.id,
      name: spec.id,
      type: "gov" as const,
      group: "D",
      authority: "canonical",
      phase: "fast",
      url: spec.base,
      schedule: "0 */6 * * *",
      enabled: true,
    } as SourceConfig;

    const items = await htmlGovAdapter.fetchItems(config);
    const ok =
      items.length >= spec.minItems &&
      items.some((it) => it.url.includes(spec.expectUrlContains)) &&
      items[0]?.title && items[0].title.length > 0;

    if (ok) {
      console.log(`[${spec.id}] ✓ ${items.length}건 파싱, 첫 항목: "${items[0].title.slice(0, 50)}…" url=${items[0].url}`);
      pass++;
    } else {
      console.error(`[${spec.id}] ✗ items=${items.length}, urlContains=${items.some((it) => it.url.includes(spec.expectUrlContains))}`);
      console.error(`  첫 3건:`, items.slice(0, 3).map((it) => ({ title: it.title.slice(0, 40), url: it.url })));
      fail++;
    }
  } catch (err) {
    console.error(`[${spec.id}] ✗ 어댑터 호출 에러:`, (err as Error).message);
    fail++;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log(`\n결과: ${pass}/${pass + fail} 통과`);
process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
