import { expect, test } from "@rstest/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import {
  HAND_LANDMARKER_MODEL,
  MEDIAPIPE_VERSION,
  MEDIAPIPE_WASM_LOCAL,
} from "../src/hand/mediapipeLoader";
import { GuidePage } from "../src/ui/GuidePage";

function renderGuide() {
  const router = createMemoryRouter([{ path: "/", element: <GuidePage /> }, { path: "/train", element: <div>train</div> }], {
    initialEntries: ["/"],
  });
  return { router, ...render(<RouterProvider router={router} />) };
}

test("guide page shows mouse demo copy and brand", () => {
  renderGuide();
  expect(screen.getByText("LHS-VSTS")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "鼠标操作" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "进入训练" })).toBeInTheDocument();
});

test("guide start link navigates to train", () => {
  const { router } = renderGuide();
  fireEvent.click(screen.getByRole("link", { name: "进入训练" }));
  expect(router.state.location.pathname).toBe("/train");
});

test("mediapipe runtime assets are same-origin", () => {
  expect(MEDIAPIPE_VERSION).toBe("1.0.1");
  expect(MEDIAPIPE_WASM_LOCAL).toBe("/mediapipe");
  expect(HAND_LANDMARKER_MODEL).toBe("/models/hand_landmarker.task");
  expect(MEDIAPIPE_WASM_LOCAL).not.toMatch(/^https?:\/\//);
  expect(HAND_LANDMARKER_MODEL).not.toMatch(/^https?:\/\//);
});
