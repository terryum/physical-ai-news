const SUBSTACK_URL = process.env.NEXT_PUBLIC_SUBSTACK_URL;

export function SubstackSubscribe() {
  if (!SUBSTACK_URL) return null;
  const base = SUBSTACK_URL.replace(/\/$/, "");
  const embed = `${base}/embed`;
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">뉴스레터 구독</h2>
        <a
          href={base}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Substack에서 보기 →
        </a>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        매일 오후 1시, 당일 클리핑을 이메일로 받아보세요.
      </p>
      <iframe
        src={embed}
        title="Physical AI News 뉴스레터 구독"
        className="w-full rounded border-0 bg-transparent"
        style={{ height: 150 }}
        scrolling="no"
        loading="lazy"
      />
    </section>
  );
}
