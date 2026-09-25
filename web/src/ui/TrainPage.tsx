import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useHandCamera } from '../hand/useHandCamera';
import {
  getTrainingSession,
  subscribeSession,
  subscribeTips,
  type SessionSnapshot,
} from '../machine';
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

function emptySnapshot(): SessionSnapshot {
  return {
    score: 100,
    faultLog: [],
    completedSteps: [],
    requiredSteps: [],
    passed: false,
    finished: false,
    partStates: {},
    steps: [],
    activeCleanIds: [],
  };
}

function useSessionSnapshot(sessionTick: number): SessionSnapshot {
  // Include session identity — a fresh TrainingSession starts at revision 0,
  // which must not look identical to "no session" or the rail stays empty.
  const storeKey = useSyncExternalStore(
    subscribeSession,
    () => {
      const s = getTrainingSession();
      return s ? `s:${s.getRevision()}` : 'none';
    },
    () => 'none',
  );
  void storeKey;
  void sessionTick;
  return getTrainingSession()?.snapshot() ?? emptySnapshot();
}

export function TrainPage({ onBack }: TrainPageProps) {
  const [calibrateToken, setCalibrateToken] = useState(0);
  const [restartToken, setRestartToken] = useState(0);
  const [sessionTick, setSessionTick] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const { phase, error, presence, videoRef, retry } = useHandCamera(true);
  const status = statusLabel(phase, presence);
  const showOverlay = phase === 'denied' || phase === 'error';
  const snap = useSessionSnapshot(sessionTick);

  useEffect(() => {
    return subscribeTips((msg) => {
      setTip(msg);
    });
  }, [setTip]);

  useEffect(() => {
    if (!tip) return;
    const t = window.setTimeout(() => setTip(null), 3200);
    return () => window.clearTimeout(t);
  }, [tip, setTip]);

  const onSessionReady = useCallback(() => {
    // Ensure rail re-reads snapshot even if revision stays 0 after replace.
    setSessionTick((n) => n + 1);
  }, [setSessionTick]);

  const restart = () => {
    setRestartToken((n) => n + 1);
    setCalibrateToken((n) => n + 1);
    setTip(null);
  };

  const markClean = (cleanId: string) => {
    getTrainingSession()?.completeClean(cleanId);
  };

  const showEnd = snap.finished || snap.passed;
  const activeCleans =
    getTrainingSession()?.def.cleanSpots.filter((s) =>
      snap.activeCleanIds.includes(s.cleanId),
    ) ?? [];

  return (
    <div className="train-page">
      <header className="train-chrome">
        <div className="brand">LHS-VSTS</div>
        <div className="meta">
          <span className={`dot ${status.tone}`} />
          <span>{status.text}</span>
          <span className="score-chip">得分 {snap.score}</span>
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

      <div className="train-body">
        <aside className="step-rail" aria-label="训练步骤">
          <h2 className="step-rail-title">SOP 步骤</h2>
          <ol className="step-list">
            {snap.steps.map((row) => (
              <li key={row.stepId} className={`step-row ${row.status}`}>
                <span className="step-label">{row.label}</span>
                {row.status === 'locked' && row.lockReason ? (
                  <span className="step-lock">{row.lockReason}</span>
                ) : null}
              </li>
            ))}
          </ol>
          {activeCleans.length > 0 ? (
            <div className="clean-fallback">
              <h3>清洁（UI 兜底）</h3>
              {activeCleans.map((c) => (
                <button
                  key={c.cleanId}
                  type="button"
                  className="clean-btn"
                  onClick={() => markClean(c.cleanId)}
                >
                  标记已清洁 · {c.displayName}
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <main className="viewport">
          <TrainingScene
            calibrateToken={calibrateToken}
            restartToken={restartToken}
            onSessionReady={onSessionReady}
          />

          <video
            ref={videoRef}
            className="cam-preview"
            muted
            playsInline
            autoPlay
            aria-label="摄像头预览（镜像）"
          />

          {tip ? (
            <div className="tip-toast" role="status">
              {tip}
            </div>
          ) : null}

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

          {showEnd ? (
            <div className="end-screen" role="dialog" aria-labelledby="end-title">
              <h2 id="end-title">{snap.passed ? '合格' : '训练结束'}</h2>
              <p className="end-score">得分：{snap.score}</p>
              <p className="end-meta">
                已完成 {snap.completedSteps.length} / {snap.requiredSteps.length} 步
              </p>
              {snap.faultLog.length > 0 ? (
                <div className="fault-block">
                  <h3>错因记录</h3>
                  <ul>
                    {snap.faultLog.map((f, i) => (
                      <li key={`${f.key}-${i}`}>
                        −{f.amount} · {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="end-meta">无扣分记录</p>
              )}
              <div className="end-actions">
                <button type="button" className="primary-btn" onClick={restart}>
                  再训一次
                </button>
                <button type="button" className="recal-btn" onClick={onBack}>
                  返回引导
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
