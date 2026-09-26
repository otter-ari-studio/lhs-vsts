import { Link } from "react-router-dom";

export function GuidePage() {
  return (
    <div className="guide-page">
      <header className="guide-hero">
        <p className="guide-brand">LHS-VSTS</p>
        <h1 className="guide-title">大家电拆洗训练</h1>
        <p className="guide-lead">
          纯浏览器 3D 演示：用鼠标拖动旋转视角，点击与拖拽完成 SOP 拆洗回装。
        </p>
        <div className="guide-actions">
          <Link to="/train" className="primary-btn">
            进入训练
          </Link>
          <Link to="/admin" className="recal-btn">
            管理页
          </Link>
        </div>
      </header>

      <div className="guide-grid">
        <section className="guide-block" aria-labelledby="mouse-heading">
          <span className="guide-index" aria-hidden="true">
            01
          </span>
          <h2 id="mouse-heading">鼠标操作</h2>
          <ul>
            <li>拖动画布空白处：旋转 / 缩放查看机身。</li>
            <li>点击高亮零件：打开卡扣、拧下螺母、取下部件。</li>
            <li>按住拖拽零件：移到左侧松手进入物品栏；回装时拖回安装位松手。</li>
          </ul>
        </section>

        <section className="guide-block" aria-labelledby="flow-heading">
          <span className="guide-index" aria-hidden="true">
            02
          </span>
          <h2 id="flow-heading">训练流程</h2>
          <ul>
            <li>按左侧 SOP 步骤顺序操作；当前目标会高亮提示。</li>
            <li>拆完后自动进入清洗，再按顺序回装。</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
