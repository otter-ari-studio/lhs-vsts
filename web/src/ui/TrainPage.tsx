import { useState } from 'react';
import { useHandCamera } from '../hand/useHandCamera';
import { TrainingScene } from '../scene/TrainingScene';

interface TrainPageProps {
  onBack: () => void;
}

function statusLabel(
  phase: ReturnType<typeof useHandCamera>['phase'],
  presence: ReturnType<typeof useHandCamera>['presence'],
): { text: string; tone: 'ok' | 'wait' | 'bad' } {
  if (phase === 'requesting') {
    return { text: '正在请求摄像头权限…', tone: 'wait' };
  }
  if (phase === 'loading_model') {
    return { text: '正在加载手部模型…', tone: 'wait' };
  }
  if (phase === 'denied') {
    return { text: '摄像头权限被拒绝', tone: 'bad' };
  }
  if (phase === 'error') {
    return { text: '摄像头或模型加载失败', tone: 'bad' };
  }
  if (phase === 'tracking') {
    if (presence === 'both') {
      return { text: '双手追踪中', tone: 'ok' };
    }
    if (presence === 'partial') {
      return { text: '仅一只手入画 · 请双手举到胸前', tone: 'wait' };
    }
    return { text: '双手入画 · 坐正面对顶摄', tone: 'wait' };
  }
  return { text: '准备中…', tone: 'wait' };
}

export function TrainPage({ onBack }: TrainPageProps) {
  const [calibrateToken, setCalibrateToken] = useState(0);
  const { phase, error, presence, videoRef, retry } = useHandCamera(true);
  const status = statusLabel(phase, presence);
  const showOverlay = phase === 'denied' || phase === 'error';

  return (
    <div className="train-page">
      <header className="train-chrome">
        <div className="brand">LHS-VSTS</div>
        <div className="meta">
          <span className={`dot ${status.tone}`} />
          <span>{status.text}</span>
        </div>
        <button
          type="button"
          className="recal-btn"
          onClick={() => setCalibrateToken((n) => n + 1)}
          disabled={phase !== 'tracking'}
        >
          重新标定
        </button>
        <button type="button" className="recal-btn" onClick={onBack}>
          返回引导
        </button>
      </header>

      <main className="viewport">
        <TrainingScene calibrateToken={calibrateToken} />

        {/* Mirrored preview — world coords match this mirror (axisMap invertX). */}
        <video
          ref={videoRef}
          className="cam-preview"
          muted
          playsInline
          autoPlay
          aria-label="摄像头预览（镜像）"
        />

        {showOverlay ? (
          <div className="cam-overlay" role="alertdialog" aria-labelledby="cam-fail-title">
            <h2 id="cam-fail-title">无法启动摄像头追踪</h2>
            <p>{error?.message ?? '未知错误'}</p>
            <ul className="cam-overlay-tips">
              <li>请坐正，双手举到胸前入画，手心大致朝向屏幕。</li>
              <li>本机请使用 localhost；部署须 HTTPS。</li>
              <li>若曾拒绝权限，请在地址栏重新允许摄像头。</li>
            </ul>
            <button type="button" className="primary-btn" onClick={retry}>
              重试
            </button>
          </div>
        ) : null}

        {phase === 'tracking' && presence === 'none' ? (
          <div className="cam-hint" role="status">
            双手入画：坐正，双手举到胸前，手心朝向屏幕，然后保持片刻完成标定。
          </div>
        ) : null}
      </main>
    </div>
  );
}
