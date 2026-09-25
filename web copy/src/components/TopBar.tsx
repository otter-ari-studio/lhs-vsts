interface TopBarProps {
  statusLabel: string;
  statusKind: 'ok' | 'wait' | 'bad';
  handCount: number;
  onRecalibrate: () => void;
}

export function TopBar({
  statusLabel,
  statusKind,
  handCount,
  onRecalibrate,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand">LHS-VSTS</div>
      <div className="meta">
        <span className={`dot ${statusKind}`} />
        <span>
          {statusLabel} · 本帧手数 {handCount}
        </span>
      </div>
      <button type="button" className="recal-btn" onClick={onRecalibrate}>
        Recalibrate
      </button>
    </header>
  );
}
