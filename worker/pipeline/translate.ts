import OpenAI from "openai";

interface Translatable {
  id: string;
  title: string;
  titleKo?: string;
}

const BATCH_SIZE = 20;

const SYSTEM_PROMPT = `You are a Korean tech news editor. Translate AI/robotics paper and post titles to natural, concise Korean (뉴스 헤드라인 톤).
Rules:
- Keep proper nouns and product/model names in English (e.g. GPT-5, Claude, NVIDIA, Figure 03, RT-2, π0, VLA).
- Do not translate arXiv-style code names or paper acronyms (ReCAPA, 3D-VCD 등).
- Do not add extra commentary; output only the translation.
- Headlines should be tight (under 50 Korean characters when possible).
Respond with JSON: {"items":[{"id":"...","titleKo":"..."}, ...]} matching the input ids.`;

/**
 * 트렌딩 항목 중 titleKo가 비어 있는 것만 골라 BizRouter OpenAI로 번역.
 * 캐시(prevTranslations)에 같은 ID가 있으면 재사용. 환경변수 미설정 시 전체 스킵.
 */
export async function translateTrending<
  T extends Translatable & { itemType?: string; sourceName?: string },
>(items: T[], prevTranslations: Map<string, string>): Promise<T[]> {
  const baseURL = process.env.BIZROUTER_BASE_URL ?? "https://api.bizrouter.ai/v1";
  const apiKey = process.env.BIZROUTER_API_KEY;
  const model = process.env.BIZROUTER_TRANSLATE_MODEL ?? "openai/gpt-5-mini";

  if (!apiKey) {
    console.log(`[translate] BIZROUTER_API_KEY 미설정 — 번역 스킵`);
    return items;
  }

  // 트렌딩 + titleKo 비어있는 항목만 대상
  const targets = items.filter(
    (i) =>
      i.itemType === "trending" &&
      !i.titleKo &&
      // 캐시 hit 우선 처리
      !prevTranslations.has(i.id),
  );

  // 1) 캐시 적용
  let cacheHits = 0;
  for (const item of items) {
    if (!item.titleKo && prevTranslations.has(item.id)) {
      item.titleKo = prevTranslations.get(item.id);
      cacheHits++;
    }
  }

  if (targets.length === 0) {
    console.log(`[translate] 신규 0건 (캐시 hit ${cacheHits})`);
    return items;
  }

  console.log(
    `[translate] ${items.filter((i) => i.itemType === "trending").length}건 중 신규 ${targets.length}건 번역 시작 (캐시 hit ${cacheHits}, model=${model})`,
  );

  const client = new OpenAI({ baseURL, apiKey });
  const idToTitleKo = new Map<string, string>();

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const userPayload = JSON.stringify({
      items: batch.map((b) => ({ id: b.id, title: b.title })),
    });

    try {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPayload },
        ],
        response_format: { type: "json_object" },
      });

      const content = res.choices[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content) as { items?: Array<{ id: string; titleKo: string }> };
      for (const r of parsed.items ?? []) {
        if (r.id && r.titleKo) idToTitleKo.set(r.id, r.titleKo);
      }
    } catch (err) {
      console.log(
        `[translate] 배치 ${i}/${targets.length} 에러:`,
        (err as Error).message,
      );
    }
  }

  for (const item of items) {
    if (idToTitleKo.has(item.id)) {
      item.titleKo = idToTitleKo.get(item.id);
    }
  }

  console.log(
    `[translate] 완료 — 신규 번역 ${idToTitleKo.size}/${targets.length}건`,
  );
  return items;
}
