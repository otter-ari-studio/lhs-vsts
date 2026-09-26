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

export interface SubmitScoreBody {
  machineId: string;
  score: number;
  passed: boolean;
  faults: ScoreFault[];
}
