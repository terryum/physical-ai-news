interface SubstackProfile {
  id: number;
  name: string;
}

interface PublishResult {
  draftId: number;
  url: string;
}

interface PublishOptions {
  subdomain: string;
  title: string;
  subtitle: string;
  bodyJson: string;
  sendEmail?: boolean;
}

/**
 * Substack 비공식 API 클라이언트.
 *
 * 참조: publish-substack.py (terryum-ai).
 * - substack.sid 쿠키로 인증
 * - {subdomain}.substack.com/publish/posts GET → csrf-token 쿠키 획득
 * - /api/v1/drafts POST → /api/v1/drafts/{id}/publish POST
 * - button 노드 사용 시 Substack 기본 구독 위젯이 사라지므로 CTA는 링크 텍스트 문단으로 처리
 */
export class SubstackClient {
  private cookies = new Map<string, string>();
  private userId!: number;

  constructor(sid: string) {
    this.cookies.set("substack.sid", sid);
  }

  async authenticate(): Promise<SubstackProfile> {
    const res = await this.fetch("https://substack.com/api/v1/user/profile/self");
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Substack 인증 실패 (${res.status}) — substack.sid 쿠키가 만료됐거나 잘못됐습니다. ` +
          `Chrome DevTools → Application → Cookies → substack.com → substack.sid 재추출 필요.`,
      );
    }
    if (!res.ok) {
      throw new Error(`Substack auth 실패 (${res.status}): ${await res.text()}`);
    }
    const profile = (await res.json()) as SubstackProfile;
    if (!profile.id) {
      throw new Error("Substack 프로필에서 user id를 찾지 못했습니다.");
    }
    this.userId = profile.id;
    return profile;
  }

  async publish(opts: PublishOptions): Promise<PublishResult> {
    if (!this.userId) {
      throw new Error("publish 호출 전에 authenticate()를 먼저 실행해야 합니다.");
    }
    const base = `https://${opts.subdomain}.substack.com`;

    await this.fetch(`${base}/publish/posts`);
    const csrf = this.cookies.get("csrf-token") ?? "";

    const draftRes = await this.fetch(`${base}/api/v1/drafts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
      },
      body: JSON.stringify({
        draft_title: opts.title,
        draft_subtitle: opts.subtitle,
        draft_body: opts.bodyJson,
        draft_bylines: [{ id: this.userId, is_guest: false }],
        draft_podcast_url: "",
        draft_podcast_duration: null,
        draft_video_upload_id: null,
        draft_podcast_upload_id: null,
        draft_podcast_preview_upload_id: null,
        audience: "everyone",
        section_chosen: false,
      }),
    });
    if (!draftRes.ok) {
      const body = await draftRes.text();
      throw new Error(`드래프트 생성 실패 (${draftRes.status}): ${body.slice(0, 300)}`);
    }
    const draft = (await draftRes.json()) as { id: number };

    const sendEmail = opts.sendEmail ?? true;
    const pubRes = await this.fetch(`${base}/api/v1/drafts/${draft.id}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
      },
      body: JSON.stringify({
        send_email: sendEmail,
        share_automatically: true,
      }),
    });
    if (!pubRes.ok) {
      const body = await pubRes.text();
      throw new Error(`발행 실패 (${pubRes.status}): ${body.slice(0, 300)}`);
    }

    return { draftId: draft.id, url: `${base}/p/${draft.id}` };
  }

  private buildCookieHeader(targetUrl: string): string {
    const host = new URL(targetUrl).hostname;
    const entries: string[] = [];
    for (const [name, value] of this.cookies) {
      if (name === "substack.sid" || host === "substack.com" || host.endsWith(".substack.com")) {
        entries.push(`${name}=${value}`);
      }
    }
    return entries.join("; ");
  }

  private storeSetCookie(header: string | null): void {
    if (!header) return;
    for (const cookieStr of splitSetCookie(header)) {
      const [nameValue] = cookieStr.split(";");
      const eq = nameValue.indexOf("=");
      if (eq <= 0) continue;
      const name = nameValue.slice(0, eq).trim();
      const value = nameValue.slice(eq + 1).trim();
      if (!name) continue;
      this.cookies.set(name, value);
    }
  }

  private async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set(
      "User-Agent",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    );
    headers.set("Referer", "https://substack.com");
    const cookieHeader = this.buildCookieHeader(url);
    if (cookieHeader) headers.set("Cookie", cookieHeader);
    const res = await fetch(url, { ...init, headers, redirect: "manual" });
    this.storeSetCookie(res.headers.get("set-cookie"));
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        const next = new URL(location, url).toString();
        return this.fetch(next, { ...init, method: "GET", body: undefined });
      }
    }
    return res;
  }
}

/**
 * 여러 Set-Cookie 헤더가 하나의 문자열로 합쳐져 올 때 안전하게 분리한다.
 * (쿠키 속성의 Expires 필드에 쉼표가 포함돼 단순 split이 실패하므로 `,` 뒤에 알파벳+`=`가 오는 경계만 인정.)
 */
function splitSetCookie(header: string): string[] {
  const result: string[] = [];
  let buf = "";
  const parts = header.split(",");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (buf && /^\s*[A-Za-z0-9_\-]+=/.test(part)) {
      result.push(buf.trim());
      buf = part;
    } else {
      buf = buf ? `${buf},${part}` : part;
    }
  }
  if (buf) result.push(buf.trim());
  return result;
}
