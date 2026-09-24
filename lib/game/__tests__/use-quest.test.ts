// @vitest-environment jsdom

import { createElement } from "react";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadQuest, type QuestProgressView } from "../client";
import { getQuest } from "../content/quests";
import { createQueryClient } from "../queries";
import {
  QUEST_POLL_INTERVAL_MS,
  hasExternalObjectives,
  useQuest,
} from "../use-quest";

vi.mock("../client", () => ({ loadQuest: vi.fn() }));
const mockLoadQuest = vi.mocked(loadQuest);

const questState = (unlockedSteps: string[]): QuestProgressView => ({
  slug: "unknown-signal",
  status: "in-progress",
  missing: {},
  completions: 0,
  progress: { step: 1, answers: {}, unlockedSteps, completions: 0 },
});

// Renders only what the query holds, like a quest screen would.
const QuestProbe = ({ poll }: { poll: boolean }) => {
  const { data } = useQuest("unknown-signal", { poll });
  return createElement(
    "p",
    { "data-testid": "unlocked" },
    data ? data.progress?.unlockedSteps.join(",") || "none" : "loading",
  );
};

const mount = (poll = true) => {
  const client = createQueryClient();
  const view = render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(QuestProbe, { poll }),
    ),
  );
  return { client, ...view };
};

const unlocked = () => screen.getByTestId("unlocked").textContent;
const tick = (ms = QUEST_POLL_INTERVAL_MS) =>
  act(() => vi.advanceTimersByTimeAsync(ms));
// A fetch settles a scheduler round or two after the timer that started
// it; waitFor keeps nudging the fake clock until the render catches up.
const shows = (text: string) => vi.waitFor(() => expect(unlocked()).toBe(text));

beforeEach(() => {
  vi.useFakeTimers();
  mockLoadQuest.mockReset();
});
afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe("useQuest", () => {
  it("fetches through TanStack Query and rerenders when server state changes", async () => {
    mockLoadQuest.mockResolvedValue(questState([]));
    mount();
    await shows("none");
    expect(mockLoadQuest).toHaveBeenCalledWith("unknown-signal");

    // The terminal gets pressed somewhere else; the next poll sees it.
    mockLoadQuest.mockResolvedValue(questState(["registration"]));
    await tick();
    await shows("registration");
  });

  it("does not poll when not asked to", async () => {
    mockLoadQuest.mockResolvedValue(questState([]));
    mount(false);
    await tick(0);
    await tick(QUEST_POLL_INTERVAL_MS * 4);
    expect(mockLoadQuest).toHaveBeenCalledTimes(1);
  });

  it("stops polling once the screen unmounts", async () => {
    mockLoadQuest.mockResolvedValue(questState([]));
    const { unmount } = mount();
    await tick(0);
    await tick();
    const calls = mockLoadQuest.mock.calls.length;
    expect(calls).toBeGreaterThan(1);
    unmount();
    await tick(QUEST_POLL_INTERVAL_MS * 4);
    expect(mockLoadQuest).toHaveBeenCalledTimes(calls);
  });

  it("keeps showing the last good state when a poll fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockLoadQuest.mockResolvedValue(questState(["registration"]));
    mount();
    await shows("registration");

    mockLoadQuest.mockRejectedValue(new Error("network down"));
    const calls = mockLoadQuest.mock.calls.length;
    await tick(QUEST_POLL_INTERVAL_MS * 3);
    expect(mockLoadQuest.mock.calls.length).toBeGreaterThan(calls);
    expect(unlocked()).toBe("registration");
  });

  it("pauses while the tab is hidden and refetches on return", async () => {
    mockLoadQuest.mockResolvedValue(questState([]));
    mount();
    await tick(0);

    act(() => focusManager.setFocused(false));
    const calls = mockLoadQuest.mock.calls.length;
    await tick(QUEST_POLL_INTERVAL_MS * 4);
    expect(mockLoadQuest).toHaveBeenCalledTimes(calls);

    mockLoadQuest.mockResolvedValue(questState(["registration"]));
    act(() => focusManager.setFocused(true));
    await shows("registration");
  });
});

describe("hasExternalObjectives", () => {
  it("is true only for a quest with a world-triggered step", () => {
    const quest = getQuest("unknown-signal")!;
    expect(hasExternalObjectives(quest)).toBe(false);
    const gated = {
      ...quest,
      steps: quest.steps.map((step, index) =>
        index === 1
          ? {
              ...step,
              trigger: {
                type: "TERMINAL_PRESSED" as const,
                terminalId: "signal-terminal",
              },
            }
          : step,
      ),
    };
    expect(hasExternalObjectives(gated)).toBe(true);
  });
});
