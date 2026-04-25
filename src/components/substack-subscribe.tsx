const SUBSTACK_URL = process.env.NEXT_PUBLIC_SUBSTACK_URL;

interface Props {
  variant: "header" | "footer";
}

export function SubstackSubscribe({ variant }: Props) {
  if (!SUBSTACK_URL) return null;
  const base = SUBSTACK_URL.replace(/\/$/, "");
  const action = `${base}/api/v1/free`;

  if (variant === "header") {
    return (
      <form
        action={action}
        method="POST"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:flex items-center gap-1.5"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="뉴스레터 이메일"
          className="h-7 w-44 rounded-md border bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
        >
          구독
        </button>
      </form>
    );
  }

  return (
    <form
      action={action}
      method="POST"
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      <span className="text-xs text-muted-foreground hidden sm:inline">
        매일 오전 8시 Substack으로 발행
      </span>
      <input
        type="email"
        name="email"
        required
        placeholder="이메일 주소"
        className="h-8 w-56 rounded-md border bg-background px-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
      >
        구독
      </button>
    </form>
  );
}
