import { expect, rs, test } from "@rstest/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { AdminPage } from "../src/ui/AdminPage";

function renderAdmin(initialEntries: string[] = ["/admin"]) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <div>guide</div> },
      { path: "/admin", element: <AdminPage /> },
    ],
    { initialEntries },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

const machineFixture = {
  machineId: "range_hood_generic",
  displayName: "通用油烟机",
  unit: "meter",
  scoring: {
    baseScore: 100,
    deductIllegalOrder: 5,
    deductClipPry: 10,
    deductNutWrongDirection: 5,
    deductToleranceFail: 5,
  },
  assemblyDefaults: {
    positionToleranceMeters: 0.015,
    angleToleranceDegrees: 5,
    snapRangeMeters: 0.08,
  },
  parts: [
    {
      partId: "oil_box",
      displayName: "集油盒",
      kind: "grabbable",
      anchor: { position: [0, 0, 0] },
      visual: { adapter: "kitbash", kitbashKey: "oil_box" },
      removePrereqs: [],
      installPrereqs: ["install_filter_top"],
      tips: { installLocked: "先装滤网", removeLocked: "拆锁" },
    },
    {
      partId: "shell_main",
      displayName: "主外壳",
      kind: "fixed_shell",
      anchor: { position: [0, 0, 0] },
      visual: { adapter: "gltf", gltfUrl: "/x.glb" },
      removePrereqs: [],
      installPrereqs: [],
      tips: {},
    },
  ],
  cleanSpots: [
    {
      cleanId: "oil_box",
      displayName: "清洁集油盒",
      partId: "oil_box",
      position: [0, 0, 0],
      space: "part_local",
      radiusMeters: 0.1,
      dwellMs: 1500,
      stepId: "clean_oil_box",
    },
  ],
};

const scoreFixture = [
  {
    id: "score-1",
    machineId: "range_hood_generic",
    score: 88,
    passed: false,
    faults: [{ key: "illegal", reason: "顺序错误", amount: 5 }],
    finishedAt: "2026-09-26T00:00:00.000Z",
  },
  {
    id: "score-2",
    machineId: "range_hood_generic",
    score: 100,
    passed: true,
    faults: [],
    finishedAt: "2026-09-26T01:00:00.000Z",
  },
];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestBodyText(body: BodyInit | null | undefined): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof Blob) {
    throw new Error("Blob body is not supported in this test mock");
  }
  return JSON.stringify(body);
}

function mockAdminApis(options?: { putError?: boolean; emptyScores?: boolean }) {
  return rs
    .spyOn(globalThis, "fetch")
    .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/machines/current") && method === "GET") {
        return Promise.resolve(new Response(JSON.stringify(machineFixture), { status: 200 }));
      }
      if (url.includes("/api/scores") && method === "GET") {
        const body = options?.emptyScores ? [] : scoreFixture;
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }
      if (url.includes("/api/machines/current") && method === "PUT") {
        if (options?.putError) {
          return Promise.resolve(new Response("bad", { status: 400 }));
        }
        const body = JSON.parse(requestBodyText(init?.body ?? null));
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }
      return Promise.resolve(new Response("unexpected", { status: 500 }));
    });
}

test("AdminPage lists scores and saves machine edits", async () => {
  const fetchMock = mockAdminApis();
  const { router } = renderAdmin();

  await waitFor(() => {
    expect(screen.getByDisplayValue("通用油烟机")).toBeInTheDocument();
  });

  expect(screen.getByText(/得分 88/)).toBeInTheDocument();
  expect(screen.getByText(/顺序错误/)).toBeInTheDocument();
  expect(screen.getByText("合格")).toBeInTheDocument();
  expect(screen.getByText("未合格")).toBeInTheDocument();
  expect(screen.getByText(/无错因/)).toBeInTheDocument();
  expect(screen.queryByText(/学员/)).not.toBeInTheDocument();

  fireEvent.change(screen.getByDisplayValue("通用油烟机"), {
    target: { value: "改名机型" },
  });

  const scoringSection = screen.getByRole("region", { name: "扣分常量" });
  const illegalField = within(scoringSection).getByText("非法顺序").parentElement!;
  fireEvent.change(within(illegalField).getByRole("spinbutton"), {
    target: { value: "7" },
  });

  fireEvent.click(screen.getByText(/集油盒/));
  const partBlock = screen.getByText(/集油盒/).closest("details") as HTMLElement;

  fireEvent.change(within(partBlock).getByDisplayValue("集油盒"), {
    target: { value: "油盒" },
  });

  const removeLabel = within(partBlock).getByText(/removePrereqs/).parentElement!;
  fireEvent.change(within(removeLabel).getByRole("textbox"), {
    target: { value: "remove_x, remove_y" },
  });

  const installLabel = within(partBlock).getByText(/installPrereqs/).parentElement!;
  fireEvent.change(within(installLabel).getByRole("textbox"), {
    target: { value: "install_filter_top, clean_oil_box" },
  });

  const tipLabel = within(partBlock).getByText(/回装锁定提示/).parentElement!;
  fireEvent.change(within(tipLabel).getByRole("textbox"), {
    target: { value: "" },
  });
  fireEvent.change(within(tipLabel).getByRole("textbox"), {
    target: { value: "新提示" },
  });

  const removeTip = within(partBlock).getByText(/拆卸锁定提示/).parentElement!;
  fireEvent.change(within(removeTip).getByRole("textbox"), {
    target: { value: "拆提示" },
  });

  fireEvent.change(within(partBlock).getByDisplayValue("oil_box"), {
    target: { value: "filter_top" },
  });

  const cleans = screen.getByRole("region", { name: "清洁点" });
  fireEvent.change(within(cleans).getByDisplayValue("清洁集油盒"), {
    target: { value: "深度清洁" },
  });
  fireEvent.change(within(cleans).getByDisplayValue("0.1"), {
    target: { value: "0.2" },
  });
  fireEvent.change(within(cleans).getByDisplayValue("1500"), {
    target: { value: "2000" },
  });

  fireEvent.click(screen.getByRole("button", { name: "保存机型" }));

  await waitFor(() => {
    expect(screen.getByText("已保存机型定义")).toBeInTheDocument();
  });

  const putCall = fetchMock.mock.calls.find((c) => {
    const url = requestUrl(c[0] as RequestInfo | URL);
    const method = (c[1]?.method ?? "GET").toUpperCase();
    return url.includes("/api/machines/current") && method === "PUT";
  });
  expect(putCall).toBeTruthy();
  const saved = JSON.parse(requestBodyText(putCall?.[1]?.body ?? null));
  expect(saved.displayName).toBe("改名机型");
  expect(saved.scoring.deductIllegalOrder).toBe(7);
  expect(saved.parts[0].tips.installLocked).toBe("新提示");
  expect(saved.cleanSpots[0].dwellMs).toBe(2000);

  fireEvent.click(screen.getByRole("button", { name: "刷新列表" }));
  await waitFor(() => {
    expect(screen.getByText(/得分 88/)).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "返回引导" }));
  expect(router.state.location.pathname).toBe("/");

  fetchMock.mockRestore();
});

test("AdminPage shows load error", async () => {
  const failLoad = rs
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("fail", { status: 503 }));
  renderAdmin();
  await waitFor(() => {
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  failLoad.mockRestore();
});

test("AdminPage shows save error", async () => {
  const putFail = mockAdminApis({ putError: true });
  renderAdmin();
  await waitFor(() => {
    expect(screen.getByDisplayValue("通用油烟机")).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("button", { name: "保存机型" }));
  await waitFor(() => {
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  putFail.mockRestore();
});

test("AdminPage shows empty scores message", async () => {
  const fetchMock = mockAdminApis({ emptyScores: true });
  renderAdmin();
  await waitFor(() => {
    expect(screen.getByText("暂无成绩")).toBeInTheDocument();
  });
  fetchMock.mockRestore();
});
