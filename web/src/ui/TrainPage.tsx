import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useHandCamera } from '../hand/useHandCamera';
import { partInventory } from '../interaction/partInventory';
import {
  APPLIANCE_WASH_DURATION_MS,
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

const EMPTY_SNAP: SessionSnapshot = {
  score: 100,
  faultLog: [],
  completedSteps: [],
  requiredSteps: [],
  passed: false,
  finished: false,
  partStates: {},
  steps: [],
  activeCleanIds: [],
  applianceWashPending: false,
};

/** One immutable snapshot per session revision (useSyncExternalStore contract). */
let snapCache: { key: string; snap: SessionSnapshot } | null = null;

function readSessionSnapshot(): SessionSnapshot {
  const s = getTrainingSession();
  if (!s) {
    snapCache = null;
    return EMPTY_SNAP;
  }
  const key = `${s.getSessionId()}:${s.getRevision()}`;
  if (snapCache?.key === key) return snapCache.snap;
  const snap = s.snapshot();
  snapCache = { key, snap };
  return snap;
}

function useSessionSnapshot(sessionTick: number): SessionSnapshot {
  // sessionTick: TrainingScene calls onSessionReady after creating a rev-0 session.
  void sessionTick;
  return useSyncExternalStore(subscribeSession, readSessionSnapshot, () => EMPTY_SNAP);
}

export function TrainPage({ onBack }: TrainPageProps) {
  const [calibrateToken, setCalibrateToken] = useState(0);
  const [restartToken, setRestartToken] = useState(0);
  const [sessionTick, setSessionTick] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [washPlaying, setWashPlaying] = useState(false);
  const {
    phase,
    error,
    presence,
    videoRef,
    retry,
    recalibrateDepth,
    capture,
  } = useHandCamera(true);
  const captureFileRef = useRef<HTMLInputElement | null>(null);
  const status = statusLabel(phase, presence);
  const showOverlay = phase === 'denied' || phase === 'error';
  const snap = useSessionSnapshot(sessionTick);
  const inventoryIds = useSyncExternalStore(
    (cb) => partInventory.subscribe(cb),
    () => partInventory.list().join('|'),
    () => '',
  );
  const inventory = inventoryIds ? inventoryIds.split('|') : [];
  const session = getTrainingSession();
  const partName = (id: string) =>
    session?.def.parts.find((p) => p.partId === id)?.displayName ?? id;

  const tryUiInstall = (partId: string) => {
    const mgr = getTrainingSession();
    if (!mgr) return;
    if (!mgr.canInstall(partId)) {
      mgr.tip(mgr.installBlockReason(partId) ?? '暂时无法回装');
      return;
    }
    if (mgr.tryInstall(partId)) {
      partInventory.dequeue(partId);
    }
  };

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
    recalibrateDepth();
    partInventory.clear();
    setRestartToken((n) => n + 1);
    setCalibrateToken((n) => n + 1);
    setTip(null);
    setWashPlaying(false);
  };

  const showEnd = snap.finished || snap.passed;
  const showWash = washPlaying || snap.applianceWashPending;

  useEffect(() => {
    if (!snap.applianceWashPending || showEnd) {
      setWashPlaying(false);
      return;
    }
    setWashPlaying(true);
    const t = window.setTimeout(() => {
      getTrainingSession()?.completeAllCleans();
    }, APPLIANCE_WASH_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [snap.applianceWashPending, showEnd]);

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
          onClick={() => {
            recalibrateDepth();
            setCalibrateToken((n) => n + 1);
          }}
          disabled={phase !== 'tracking' || capture.replaying}
        >
          重新标定
        </button>
        {capture.recording ? (
          <button
            type="button"
            className="recal-btn capture-active"
            onClick={() => capture.stopAndDownload()}
          >
            停止并下载 ({capture.frameCount})
          </button>
        ) : (
          <button
            type="button"
            className="recal-btn"
            onClick={() => capture.startRecording()}
            disabled={phase !== 'tracking' || capture.replaying}
          >
            录制手部日志
          </button>
        )}
        <button
          type="button"
          className="recal-btn"
          onClick={() => captureFileRef.current?.click()}
          disabled={capture.recording}
        >
          {capture.replaying ? '重放中…' : '重放日志'}
        </button>
        {capture.replaying ? (
          <button type="button" className="recal-btn" onClick={() => capture.stopReplay()}>
            停止重放
          </button>
        ) : null}
        <input
          ref={captureFileRef}
          type="file"
          accept="application/json,.json"
          className="capture-file-input"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void capture.loadAndReplay(file);
          }}
        />
        <button type="button" className="recal-btn" onClick={onBack}>
          返回引导
        </button>
      </header>

      <div className="train-body">
        <aside className="step-rail" aria-label="训练步骤">
          <h2 className="step-rail-title">物品栏 · FIFO</h2>
          <ol className="inv-list" aria-label="已拆下零件">
            {inventory.length === 0 ? (
              <li className="inv-empty">空 · 取下后左右甩手松手入队</li>
            ) : (
              inventory.map((id, i) => {
                const ready = session?.canInstall(id) ?? false;
                return (
                  <li key={`${id}-${i}`} className={`inv-row ${ready ? 'ready' : ''}`}>
                    <span className="inv-idx">{i + 1}</span>
                    <span className="inv-name">{partName(id)}</span>
                    <button
                      type="button"
                      className="inv-install-btn"
                      disabled={!ready}
                      title={
                        ready
                          ? '回装到机身'
                          : (session?.installBlockReason(id) ?? '顺序未到')
                      }
                      onClick={() => tryUiInstall(id)}
                    >
                      {ready ? '回装' : '锁定'}
                    </button>
                  </li>
                );
              })
            )}
          </ol>
          <h2 className="step-rail-title">SOP 步骤</h2>
          <ol className="step-list">
            {snap.steps.length === 0 ? (
              <li className="inv-empty">步骤加载中…若一直为空请点「重新标定」</li>
            ) : (
              snap.steps.map((row) => (
                <li key={row.stepId} className={`step-row ${row.status}`}>
                  <span className="step-label">{row.label}</span>
                  {row.status === 'locked' && row.lockReason ? (
                    <span className="step-lock">{row.lockReason}</span>
                  ) : null}
                </li>
              ))
            )}
          </ol>
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

          {showWash && !showEnd ? (
            <div className="wash-overlay" role="status" aria-live="polite">
              <div className="wash-drum" aria-hidden>
                <div className="wash-drum-inner">
                  <span className="wash-bubble b1" />
                  <span className="wash-bubble b2" />
                  <span className="wash-bubble b3" />
                  <span className="wash-bubble b4" />
                </div>
              </div>
              <p className="wash-title">家电清洗中…</p>
              <p className="wash-sub">清洗完成后将进入回装步骤</p>
            </div>
          ) : null}

          {showOverlay ? (
            <div className="cam-overlay" role="alertdialog" aria-labelledby="cam-fail-title">
              <h2 id="cam-fail-title">无法启动摄像头追踪</h2>
              <p>{error?.message ?? '未知错误'}</p>
              <ul className="cam-overlay-tips">
                <li>请坐正，双手举到胸前入画，手心大致朝向屏幕（默认按约 1 米桌距建模）。</li>
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
              拆下后甩手入物品栏。回装：左侧列表点「回装」，或对准机身绿色闪烁框捏合（须按 SOP 顺序，前置未完成会提示锁定）。
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
