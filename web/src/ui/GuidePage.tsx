interface GuidePageProps {
  onStart: () => void;
}

export function GuidePage({ onStart }: GuidePageProps) {
  return (
    <div className="guide-page">
      <header className="guide-header">
        <p className="guide-brand">LHS-VSTS</p>
        <h1 className="guide-title">大家电拆洗训练</h1>
        <p className="guide-lead">
          纯浏览器动捕，无需安装 Python。请使用笔记本顶摄，端坐面对屏幕。
        </p>
      </header>

      <section className="guide-card" aria-labelledby="cam-heading">
        <h2 id="cam-heading">摄像头权限</h2>
        <ul>
          <li>浏览器会请求摄像头权限；请选择「允许」。</li>
          <li>需要安全上下文：本机用 <code>localhost</code>，部署须 HTTPS。</li>
          <li>拒绝权限后无法追踪双手；可在地址栏重新授权。</li>
        </ul>
      </section>

      <section className="guide-card" aria-labelledby="pose-heading">
        <h2 id="pose-heading">顶摄端坐姿势</h2>
        <ul>
          <li>坐正，双手举到胸前入画，手心大致朝向屏幕。</li>
          <li>进入训练后显示双手骨架并自动标定；姿势变了可点「重新标定」。</li>
        </ul>
      </section>

      <div className="guide-actions">
        <button type="button" className="primary-btn" onClick={onStart}>
          进入训练
        </button>
      </div>
    </div>
  );
}
