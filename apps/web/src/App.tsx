import { useEffect, useState } from 'react';
import './App.css';
import { AdminPage } from './ui/AdminPage';
import { GuidePage } from './ui/GuidePage';
import { TrainPage } from './ui/TrainPage';
import type { AppPage } from './ui/types';

function pageFromHash(): AppPage {
  if (typeof window === 'undefined') return 'guide';
  const hash = window.location.hash;
  if (hash === '#train') return 'train';
  if (hash === '#admin') return 'admin';
  return 'guide';
}

const App = () => {
  const [page, setPage] = useState<AppPage>(pageFromHash);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [setPage]);

  const go = (next: AppPage) => {
    setPage(next);
    if (next === 'train') {
      window.location.hash = 'train';
    } else if (next === 'admin') {
      window.location.hash = 'admin';
    } else {
      window.location.hash = '';
    }
  };

  if (page === 'train') {
    return <TrainPage onBack={() => go('guide')} />;
  }

  if (page === 'admin') {
    return <AdminPage onBack={() => go('guide')} />;
  }

  return (
    <GuidePage
      onStart={() => go('train')}
      onAdmin={() => go('admin')}
    />
  );
};

export default App;
