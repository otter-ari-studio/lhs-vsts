import { expect, test } from "@rstest/core";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  HAND_LANDMARKER_MODEL,
  MEDIAPIPE_VERSION,
  MEDIAPIPE_WASM_LOCAL,
} from "../src/hand/mediapipeLoader";
import { GuidePage } from "../src/ui/GuidePage";

test("guide page shows mouse demo copy and brand", () => {
  render(<GuidePage onStart={() => undefined} onAdmin={() => undefined} />);
  expect(screen.getByText("LHS-VSTS")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "鼠标操作" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "进入训练" })).toBeInTheDocument();
});

test("guide start button invokes callback", () => {
  let started = false;
  render(
    <GuidePage
      onStart={() => {
        started = true;
      }}
      onAdmin={() => undefined}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "进入训练" }));
  expect(started).toBe(true);
});

test("mediapipe runtime assets are same-origin", () => {
  expect(MEDIAPIPE_VERSION).toBe("1.0.1");
  expect(MEDIAPIPE_WASM_LOCAL).toBe("/mediapipe");
  expect(HAND_LANDMARKER_MODEL).toBe("/models/hand_landmarker.task");
  expect(MEDIAPIPE_WASM_LOCAL).not.toMatch(/^https?:\/\//);
  expect(HAND_LANDMARKER_MODEL).not.toMatch(/^https?:\/\//);
});
