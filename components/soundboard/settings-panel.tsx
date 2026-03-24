type SettingsPanelProps = {
  allowConcurrentPlayback: boolean;
  onToggle(value: boolean): void;
};

export function SettingsPanel({
  allowConcurrentPlayback,
  onToggle,
}: SettingsPanelProps) {
  return (
    <div className="rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.65)] px-4 py-3">
      <label className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
        <input
          checked={allowConcurrentPlayback}
          className="h-4 w-4 accent-[var(--color-accent)]"
          onChange={(event) => onToggle(event.target.checked)}
          type="checkbox"
        />
        <span>Allow concurrent playback</span>
      </label>
    </div>
  );
}
