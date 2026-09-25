import { useEffect, useState } from 'react';
import './App.css';
import { GuidePage } from './ui/GuidePage';
import { TrainPage } from './ui/TrainPage';
import type { AppPage } from './ui/types';

function pageFromHash(): AppPage {
  if (typeof window === 'undefined') return 'guide';
  return window.location.hash === '#train' ? 'train' : 'guide';
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
    window.location.hash = next === 'train' ? 'train' : '';
  };

  if (page === 'train') {
    return <TrainPage onBack={() => go('guide')} />;
  }

  return <GuidePage onStart={() => go('train')} />;
};

export default App;
