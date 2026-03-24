const samplePads = [
  { label: "Airhorn", tone: "from-[#d95b43] to-[#ec8a53]" },
  { label: "Laugh", tone: "from-[#34645e] to-[#4fa08e]" },
  { label: "Clap", tone: "from-[#4a507a] to-[#7b7fe6]" },
  { label: "Boo", tone: "from-[#6b3c57] to-[#b15a88]" },
  { label: "Win", tone: "from-[#7a612d] to-[#d4a84d]" },
  { label: "Drum Roll", tone: "from-[#484848] to-[#8f8f8f]" },
];

const boards = ["Stream", "Game", "Meme"];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(217,91,67,0.12),_transparent_28%),linear-gradient(180deg,_#f6f1e7_0%,_#efe5d4_100%)] px-4 py-4 text-[var(--color-ink)] md:px-6 md:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 overflow-hidden rounded-[28px] border border-[var(--color-line)] bg-[rgba(251,248,242,0.86)] shadow-[var(--shadow-shell)] backdrop-blur md:min-h-[calc(100vh-3rem)] md:grid-cols-[280px_minmax(0,1fr)] md:gap-0">
        <aside className="flex flex-col justify-between border-b border-[var(--color-line)] bg-[rgba(245,238,226,0.95)] p-5 md:border-b-0 md:border-r md:p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-mono)] text-[0.7rem] uppercase tracking-[0.3em] text-[var(--color-muted)]">
                Soundboard
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                  Boards
                </h1>
                <p className="max-w-[18rem] text-sm leading-6 text-[var(--color-muted)]">
                  Keep your stream cues separated by scene, tone, or bit.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {boards.map((board, index) => {
                const active = index === 0;

                return (
                  <button
                    key={board}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-transform duration-200 hover:-translate-y-0.5 ${
                      active
                        ? "border-[rgba(217,91,67,0.35)] bg-[rgba(217,91,67,0.1)] text-[var(--color-ink)]"
                        : "border-transparent bg-transparent text-[var(--color-muted)] hover:border-[var(--color-line)] hover:bg-[rgba(255,255,255,0.6)]"
                    }`}
                    type="button"
                  >
                    <span className="text-base font-medium">{board}</span>
                    <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em]">
                      {active ? "Live" : "Idle"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-[var(--color-paper)] transition-transform duration-200 hover:-translate-y-0.5"
            type="button"
          >
            Create Board
          </button>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex flex-col gap-4 border-b border-[var(--color-line)] px-5 py-5 md:flex-row md:items-end md:justify-between md:px-8 md:py-7">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                Active Board
              </p>
              <div className="space-y-1">
                <h2 className="text-4xl font-semibold tracking-[-0.05em]">
                  Stream
                </h2>
                <p className="max-w-xl text-sm leading-6 text-[var(--color-muted)] md:text-base">
                  A two-column sound desk with fast switching on the left and big
                  playable pads on the right.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.65)] px-3 py-2 text-sm text-[var(--color-muted)]">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                Concurrent Playback On
              </div>
              <button
                className="inline-flex items-center justify-center rounded-full border border-[var(--color-line)] px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:bg-[rgba(255,255,255,0.7)]"
                type="button"
              >
                Add Sound
              </button>
            </div>
          </header>

          <div className="grid flex-1 gap-6 px-5 py-5 md:grid-cols-[minmax(0,1fr)_280px] md:px-8 md:py-7">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {samplePads.map((pad) => (
                <button
                  key={pad.label}
                  className={`group aspect-square rounded-[26px] bg-gradient-to-br ${pad.tone} p-4 text-left text-white shadow-[0_20px_40px_rgba(34,24,16,0.12)] transition-transform duration-200 hover:-translate-y-1`}
                  type="button"
                >
                  <div className="flex h-full flex-col justify-between">
                    <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-white/72">
                      Play
                    </span>
                    <span className="text-lg font-semibold tracking-[-0.03em]">
                      {pad.label}
                    </span>
                  </div>
                </button>
              ))}

              <button
                className="aspect-square rounded-[26px] border border-dashed border-[rgba(23,20,18,0.16)] bg-[rgba(255,255,255,0.45)] p-4 text-left transition-colors duration-200 hover:bg-[rgba(255,255,255,0.72)]"
                type="button"
              >
                <div className="flex h-full flex-col justify-between">
                  <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">
                    New Pad
                  </span>
                  <span className="text-lg font-semibold tracking-[-0.03em]">
                    Add Sound
                  </span>
                </div>
              </button>
            </div>

            <aside className="rounded-[28px] border border-[var(--color-line)] bg-[rgba(255,255,255,0.56)] p-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                    Inspector
                  </p>
                  <h3 className="text-2xl font-semibold tracking-[-0.04em]">
                    Pad Editor
                  </h3>
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    The next task replaces this placeholder with upload, color,
                    rename, reorder, and delete controls.
                  </p>
                </div>

                <div className="space-y-3 border-t border-[var(--color-line)] pt-4 text-sm text-[var(--color-muted)]">
                  <div className="flex items-center justify-between">
                    <span>Name</span>
                    <span className="text-[var(--color-ink)]">Airhorn</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Color</span>
                    <span className="text-[var(--color-ink)]">Amber Red</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <span className="text-[var(--color-ink)]">Scaffold</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
