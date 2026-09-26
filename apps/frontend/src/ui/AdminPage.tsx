import {
  parseMachineDef,
  type CleanSpotDef,
  type MachineDef,
  type PartDef,
} from "@lhs-vsts/machine";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchCurrentMachine,
  fetchScores,
  saveCurrentMachine,
  type ScoreRecord,
} from "../api/client";
import { listKitbashKeys } from "../visual/kitbash/KitbashAdapter";

const KITBASH_KEYS = listKitbashKeys();

export function AdminPage() {
  const navigate = useNavigate();
  const onBack = () => navigate("/");
  const [def, setDef] = useState<MachineDef | null>(null);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [raw, scoreList] = await Promise.all([fetchCurrentMachine(), fetchScores()]);
      setDef(parseMachineDef(raw));
      setScores(scoreList);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updatePart = (partId: string, patch: Partial<PartDef>) => {
    setDef((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        parts: prev.parts.map((p) => (p.partId === partId ? { ...p, ...patch } : p)),
      };
    });
  };

  const updateTips = (partId: string, field: keyof PartDef["tips"], value: string) => {
    setDef((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        parts: prev.parts.map((p) => {
          if (p.partId !== partId) return p;
          const tips = { ...p.tips };
          if (value.trim() === "") {
            delete tips[field];
          } else {
            tips[field] = value;
          }
          return { ...p, tips };
        }),
      };
    });
  };

  const updatePrereqs = (
    partId: string,
    field: "removePrereqs" | "installPrereqs",
    value: string,
  ) => {
    const list = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updatePart(partId, { [field]: list });
  };

  const updateCleanSpot = (cleanId: string, patch: Partial<CleanSpotDef>) => {
    setDef((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cleanSpots: prev.cleanSpots.map((s) => (s.cleanId === cleanId ? { ...s, ...patch } : s)),
      };
    });
  };

  const save = async () => {
    if (!def) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const saved = parseMachineDef(await saveCurrentMachine(def));
      setDef(saved);
      setStatus("已保存机型定义");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!def && !error) {
    return (
      <div className="admin-page">
        <p className="admin-loading">加载管理页…</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-brand">LHS-VSTS · 管理</p>
          <h1 className="admin-title">机型 SOP / 成绩</h1>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="primary-btn"
            disabled={saving || !def}
            onClick={() => void save()}
          >
            {saving ? "保存中…" : "保存机型"}
          </button>
          <button type="button" className="recal-btn" onClick={onBack}>
            返回引导
          </button>
        </div>
      </header>

      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? <p className="admin-status">{status}</p> : null}

      {def ? (
        <>
          <section className="admin-section" aria-labelledby="meta-heading">
            <h2 id="meta-heading">机型</h2>
            <label className="admin-field">
              <span>显示名</span>
              <input
                value={def.displayName}
                onChange={(e) => setDef({ ...def, displayName: e.target.value })}
              />
            </label>
            <p className="admin-meta">machineId: {def.machineId}</p>
          </section>

          <section className="admin-section" aria-labelledby="scoring-heading">
            <h2 id="scoring-heading">扣分常量</h2>
            <div className="admin-grid">
              {(
                [
                  ["baseScore", "基础分"],
                  ["deductIllegalOrder", "非法顺序"],
                  ["deductClipPry", "卡扣撬动"],
                  ["deductNutWrongDirection", "螺母反转"],
                  ["deductToleranceFail", "公差失败"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="admin-field">
                  <span>{label}</span>
                  <input
                    type="number"
                    value={def.scoring[key]}
                    onChange={(e) =>
                      setDef({
                        ...def,
                        scoring: {
                          ...def.scoring,
                          [key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="admin-section" aria-labelledby="parts-heading">
            <h2 id="parts-heading">零件前提 / 提示 / kitbash</h2>
            {def.parts.map((part) => (
              <details key={part.partId} className="admin-part">
                <summary>
                  {part.displayName} <span className="admin-muted">({part.partId})</span>
                </summary>
                <div className="admin-grid">
                  <label className="admin-field">
                    <span>显示名</span>
                    <input
                      value={part.displayName}
                      onChange={(e) =>
                        updatePart(part.partId, {
                          displayName: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="admin-field">
                    <span>kitbashKey</span>
                    <select
                      value={part.visual.kitbashKey ?? ""}
                      disabled={part.visual.adapter !== "kitbash"}
                      onChange={(e) =>
                        updatePart(part.partId, {
                          visual: {
                            ...part.visual,
                            kitbashKey: e.target.value,
                          },
                        })
                      }
                    >
                      {KITBASH_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>removePrereqs（逗号分隔）</span>
                    <input
                      value={part.removePrereqs.join(", ")}
                      onChange={(e) => updatePrereqs(part.partId, "removePrereqs", e.target.value)}
                    />
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>installPrereqs（逗号分隔）</span>
                    <input
                      value={part.installPrereqs.join(", ")}
                      onChange={(e) => updatePrereqs(part.partId, "installPrereqs", e.target.value)}
                    />
                  </label>
                  {(
                    [
                      ["removeLocked", "拆卸锁定提示"],
                      ["installLocked", "回装锁定提示"],
                      ["pry", "撬动提示"],
                      ["wrongDirection", "方向错误提示"],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field} className="admin-field admin-field-wide">
                      <span>{label}</span>
                      <input
                        value={part.tips[field] ?? ""}
                        onChange={(e) => updateTips(part.partId, field, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </details>
            ))}
          </section>

          <section className="admin-section" aria-labelledby="cleans-heading">
            <h2 id="cleans-heading">清洁点</h2>
            {def.cleanSpots.map((spot) => (
              <div key={spot.cleanId} className="admin-grid admin-clean">
                <label className="admin-field">
                  <span>显示名</span>
                  <input
                    value={spot.displayName}
                    onChange={(e) =>
                      updateCleanSpot(spot.cleanId, {
                        displayName: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="admin-field">
                  <span>半径 (m)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={spot.radiusMeters}
                    onChange={(e) =>
                      updateCleanSpot(spot.cleanId, {
                        radiusMeters: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="admin-field">
                  <span>停留 (ms)</span>
                  <input
                    type="number"
                    value={spot.dwellMs}
                    onChange={(e) =>
                      updateCleanSpot(spot.cleanId, {
                        dwellMs: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <p className="admin-meta">
                  {spot.cleanId} · part {spot.partId} · step {spot.stepId}
                </p>
              </div>
            ))}
          </section>
        </>
      ) : null}

      <section className="admin-section" aria-labelledby="scores-heading">
        <h2 id="scores-heading">成绩记录</h2>
        <button type="button" className="recal-btn" onClick={() => void reload()}>
          刷新列表
        </button>
        {scores.length === 0 ? (
          <p className="admin-muted">暂无成绩</p>
        ) : (
          <ul className="admin-score-list">
            {scores
              .slice()
              .reverse()
              .map((s) => (
                <li key={s.id} className="admin-score-row">
                  <div>
                    <strong>{s.passed ? "合格" : "未合格"}</strong>
                    {" · "}得分 {s.score}
                    {" · "}
                    {s.machineId}
                  </div>
                  <div className="admin-muted">{s.finishedAt}</div>
                  {s.faults.length > 0 ? (
                    <ul>
                      {s.faults.map((f, i) => (
                        <li key={`${f.key}-${i}`}>
                          −{f.amount} · {f.reason}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="admin-muted">无错因</div>
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
