import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { TopBar } from '../src/components/TopBar';

test('renders training chrome', () => {
  render(
    <TopBar
      statusLabel="连接中…"
      statusKind="wait"
      handCount={0}
      onRecalibrate={() => undefined}
    />,
  );
  expect(screen.getByText('LHS-VSTS')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Recalibrate' })).toBeInTheDocument();
});
