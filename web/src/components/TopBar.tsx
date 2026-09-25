interface TopBarProps {
  statusLabel: string;
  statusKind: 'ok' | 'wait' | 'bad';
  handCount: number;
  score: number;
  tip: string;
  onRecalibrate: () => void;
}

export function TopBar({
  statusLabel,
  statusKind,
  handCount,
  score,
  tip,
  onRecalibrate,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand">LHS-VSTS</div>
      <div className="meta">
        <span className={`dot ${statusKind}`} />
        <span>
          {statusLabel} · 手数 {handCount} · 分 {score}
        </span>
        {tip ? <span className="tip">{tip}</span> : null}
      </div>
      <button type="button" className="recal-btn" onClick={onRecalibrate}>
        Recalibrate
      </button>
    </header>
  );
}
