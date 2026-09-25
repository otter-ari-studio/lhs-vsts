import { useEffect, useState } from 'react';
import './App.css';
import { TopBar } from './components/TopBar';
import { handDataHub } from './hand/HandDataHub';
import { connectHandSocket, type SocketStatus } from './net/handSocket';
import { TrainingScene } from './scene/TrainingScene';

function statusUi(status: SocketStatus): {
  label: string;
  kind: 'ok' | 'wait' | 'bad';
} {
  if (status === 'open') return { label: '已连接', kind: 'ok' };
  if (status === 'connecting') return { label: '连接中…', kind: 'wait' };
  if (status === 'error') return { label: '连接错误', kind: 'bad' };
  return { label: '已断开（重连中）', kind: 'bad' };
}

const App = () => {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [handCount, setHandCount] = useState(0);
  const [calibrateToken, setCalibrateToken] = useState(0);

  useEffect(() => {
    return connectHandSocket({
      onStatus: setStatus,
      onHandCount: setHandCount,
    });
  }, []);

  const ui = statusUi(status);

  return (
    <div className="app-shell">
      <TopBar
        statusLabel={ui.label}
        statusKind={ui.kind}
        handCount={handCount}
        onRecalibrate={() => {
          handDataHub.clearAll();
          setCalibrateToken((n) => n + 1);
        }}
      />
      <main className="viewport">
        <TrainingScene calibrateToken={calibrateToken} />
      </main>
    </div>
  );
};

export default App;
