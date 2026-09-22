// @vitest-environment jsdom

import { StrictMode, createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameApp } from "@/app/game-app";
import { loadSave } from "@/lib/game/client";
import type { SaveView } from "@/lib/game/view";

vi.mock("@/lib/game/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/game/client")>()),
  loadSave: vi.fn(),
}));
vi.mock("@/app/audio-provider", () => ({
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
  AudioToggle: () => null,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("portal startup", () => {
  it("does not offer an inert Start button in the server-rendered page", () => {
    const html = renderToString(createElement(GameApp));
    const container = document.createElement("div");
    container.innerHTML = html;
    const button = container.querySelector<HTMLButtonElement>(
      '[aria-label="Start Camquest"]',
    )!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("[ LOADING GAME… ]");
    expect(button.textContent).not.toContain("[ START GAME ]");
  });

  it("enables Start after hydration and handles the first click while the save is still loading", async () => {
    vi.useFakeTimers();
    let finishLoad!: (view: SaveView) => void;
    const pendingSave = new Promise<SaveView>((resolve) => {
      finishLoad = resolve;
    });
    vi.mocked(loadSave).mockReturnValue(pendingSave);
    const container = document.createElement("div");
    container.innerHTML = renderToString(createElement(GameApp));
    document.body.appendChild(container);

    render(createElement(StrictMode, null, createElement(GameApp)), {
      container,
      hydrate: true,
    });
    const button = screen.getByRole("button", {
      name: "Start Camquest",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain("[ START GAME ]");
    fireEvent.click(button);
    expect(screen.getByRole("status").textContent).toContain(
      "Initialising player inventory",
    );

    await act(async () => {
      finishLoad({ pendingGrants: [], quests: {} } as unknown as SaveView);
      await vi.advanceTimersByTimeAsync(850);
    });
    expect(screen.getByRole("heading", { name: "Quest log" })).toBeTruthy();
    expect(window.location.pathname).toBe("/quest-log");
  });
});
