/** Score record persisted by the backend (no student identity). */
export interface ScoreFault {
  key: string;
  reason: string;
  amount: number;
}

export interface ScoreRecord {
  id: string;
  machineId: string;
  score: number;
  passed: boolean;
  faults: ScoreFault[];
  finishedAt: string;
}

export interface SubmitScoreInput {
  machineId: string;
  score: number;
  passed: boolean;
  faults: ScoreFault[];
}

export async function fetchCurrentMachine(): Promise<unknown> {
  const res = await fetch("/api/machines/current");
  if (!res.ok) {
    throw new Error(`GET /api/machines/current failed: ${res.status}`);
  }
  return res.json();
}

export async function saveCurrentMachine(def: unknown): Promise<unknown> {
  const res = await fetch("/api/machines/current", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(def),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT /api/machines/current failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchScores(): Promise<ScoreRecord[]> {
  const res = await fetch("/api/scores");
  if (!res.ok) {
    throw new Error(`GET /api/scores failed: ${res.status}`);
  }
  return res.json() as Promise<ScoreRecord[]>;
}

export async function submitScore(input: SubmitScoreInput): Promise<ScoreRecord> {
  const res = await fetch("/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/scores failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<ScoreRecord>;
}
