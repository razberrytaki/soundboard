import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(217,91,67,0.12),_transparent_28%),linear-gradient(180deg,_#f6f1e7_0%,_#efe5d4_100%)] px-4 py-4 text-[var(--color-ink)] md:px-6 md:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center rounded-[28px] border border-[var(--color-line)] bg-[rgba(251,248,242,0.86)] shadow-[var(--shadow-shell)] backdrop-blur">
        <div className="max-w-md px-6 py-10 text-center">
          <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
            Not Found
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
            This page does not exist
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            The requested route could not be found. Return to the soundboard to
            keep working with your local boards.
          </p>
          <Link
            className="mt-6 inline-flex rounded-full bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-[var(--color-paper)] transition-transform duration-200 hover:-translate-y-0.5"
            href="/"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
