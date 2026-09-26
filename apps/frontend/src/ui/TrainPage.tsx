import {
  APPLIANCE_WASH_DURATION_MS,
  getTrainingSession,
  subscribeSession,
  subscribeTips,
  type SessionSnapshot,
} from "@lhs-vsts/machine";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { submitSessionScoreOnce } from "../api/submitSessionScore";
import { partInventory } from "../interaction/partInventory";
import { currentInstallOfferPartId } from "../interaction/partOffer";
import { selectionHub } from "../interaction/selectionHub";
import { TrainingScene } from "../scene/TrainingScene";

interface TrainPageProps {
  onBack: () => void;
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
  void sessionTick;
  return useSyncExternalStore(subscribeSession, readSessionSnapshot, () => EMPTY_SNAP);
}

export function TrainPage({ onBack }: TrainPageProps) {
  const [restartToken, setRestartToken] = useState(0);
  const [sessionTick, setSessionTick] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [washPlaying, setWashPlaying] = useState(false);
  const snap = useSessionSnapshot(sessionTick);
  const inventoryIds = useSyncExternalStore(
    (cb) => partInventory.subscribe(cb),
    () => partInventory.list().join("|"),
    () => "",
  );
  const inventory = inventoryIds ? inventoryIds.split("|") : [];
  const session = getTrainingSession();
  const partName = (id: string) =>
    session?.def.parts.find((p) => p.partId === id)?.displayName ?? id;
  const selection = useSyncExternalStore(
    (cb) => selectionHub.subscribe(cb),
    () => selectionHub.get(),
    () => null,
  );

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
    setSessionTick((n) => n + 1);
  }, [setSessionTick]);

  const restart = () => {
    partInventory.clear();
    selectionHub.clear();
    setRestartToken((n) => n + 1);
    setTip(null);
    setWashPlaying(false);
  };

  const showEnd = snap.finished || snap.passed;
  const showWash = washPlaying || snap.applianceWashPending;
  const submittedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!showEnd) return;
    const session = getTrainingSession();
    if (!session) return;
    void submitSessionScoreOnce({
      sessionId: session.getSessionId(),
      submittedRef: submittedSessionRef,
      machineId: session.def.machineId,
      score: snap.score,
      passed: snap.passed,
      faults: snap.faultLog.map((f) => ({
        key: f.key,
        reason: f.reason,
        amount: f.amount,
      })),
    }).catch((err: unknown) => {
      console.error("Failed to submit score", err);
    });
  }, [showEnd, snap.score, snap.passed, snap.faultLog]);

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
          <span className="dot ok" />
          <span>3D 演示 · 鼠标操作</span>
          <span className="score-chip">得分 {snap.score}</span>
        </div>
        <button type="button" className="recal-btn" onClick={restart}>
          重新开始
        </button>
        <button type="button" className="recal-btn" onClick={onBack}>
          返回引导
        </button>
      </header>

      <div className="train-body">
        <aside className="step-rail" aria-label="训练步骤">
          <h2 className="step-rail-title">物品栏 · FIFO</h2>
          <ol className="inv-list" aria-label="已拆下零件" data-testid="train-inventory">
            {inventory.length === 0 ? (
              <li className="inv-empty">空 · 取下后拖到左侧松手入队</li>
            ) : (
              inventory.map((id, i) => {
                const offered = currentInstallOfferPartId() === id;
                return (
                  <li key={`${id}-${i}`} className={`inv-row ${offered ? "ready" : ""}`}>
                    <span className="inv-idx">{i + 1}</span>
                    <span className="inv-name">{partName(id)}</span>
                    <span className="inv-status">{offered ? "已弹出" : "排队中"}</span>
                  </li>
                );
              })
            )}
          </ol>
          <h2 className="step-rail-title">SOP 步骤</h2>
          <ol className="step-list" data-testid="sop-steps">
            {snap.steps.length === 0 ? (
              <li className="inv-empty">步骤加载中…若一直为空请点「重新开始」</li>
            ) : (
              snap.steps.map((row) => (
                <li key={row.stepId} className={`step-row ${row.status}`}>
                  <span className="step-label">{row.label}</span>
                  {row.status === "locked" && row.lockReason ? (
                    <span className="step-lock">{row.lockReason}</span>
                  ) : null}
                </li>
              ))
            )}
          </ol>
        </aside>

        <main className="viewport" data-testid="train-viewport">
          <TrainingScene restartToken={restartToken} onSessionReady={onSessionReady} />

          <aside className="selection-card" aria-live="polite">
            {selection ? (
              <>
                <div className="selection-kicker">
                  {selection.hint.startsWith("SOP") ? "SOP 目标" : "鼠标选中"}
                </div>
                <div className="selection-name">{selection.displayName}</div>
                <div className="selection-hint">{selection.hint}</div>
              </>
            ) : (
              <>
                <div className="selection-kicker">当前目标</div>
                <div className="selection-empty">点击高亮零件操作</div>
              </>
            )}
          </aside>

          {tip ? (
            <div className="tip-toast" role="status">
              {tip}
            </div>
          ) : null}

          {showWash && !showEnd ? (
            <div className="wash-overlay" role="status" aria-live="polite">
              <div className="wash-drum" aria-hidden>
                <div className="wash-drum-inner" />
              </div>
              <p className="wash-title">家电清洗中</p>
              <p className="wash-sub">清洗完成后将进入回装步骤</p>
            </div>
          ) : null}

          <div className="cam-hint" role="status">
            拖动旋转视角 · 点击高亮零件 · 拖拽零件到左侧入栏或装回安装位
          </div>

          {showEnd ? (
            <div className="end-screen" role="dialog" aria-labelledby="end-title">
              <h2 id="end-title">{snap.passed ? "合格" : "训练结束"}</h2>
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
