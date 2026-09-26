import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { GuidePage } from '../src/ui/GuidePage';
import { MEDIAPIPE_WASM_CDN, MEDIAPIPE_VERSION } from '../src/hand/mediapipeLoader';

test('guide page shows mouse demo copy and brand', () => {
  render(<GuidePage onStart={() => undefined} />);
  expect(screen.getByText('LHS-VSTS')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '鼠标操作' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '进入训练' })).toBeInTheDocument();
});

test('guide start button invokes callback', () => {
  let started = false;
  render(<GuidePage onStart={() => { started = true; }} />);
  fireEvent.click(screen.getByRole('button', { name: '进入训练' }));
  expect(started).toBe(true);
});

test('mediapipe CDN path is version-pinned', () => {
  expect(MEDIAPIPE_WASM_CDN).toContain('tasks-vision');
  expect(MEDIAPIPE_WASM_CDN).toContain(MEDIAPIPE_VERSION);
  expect(MEDIAPIPE_WASM_CDN).not.toContain('@latest');
});
