// @vitest-environment jsdom

import { StrictMode, createElement } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AudioProvider, AudioToggle } from "@/app/audio-provider";

vi.mock("@/lib/game/audio/howler-player", () => ({
  createHowlerPlayer: () => ({
    play: vi.fn(),
    setVolume: vi.fn(),
    unlock: async () => true,
  }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

it("restores saved mute after hydration without a server/browser markup mismatch", async () => {
  const app = createElement(
    StrictMode,
    null,
    createElement(AudioProvider, null, createElement(AudioToggle)),
  );
  const container = document.createElement("div");
  window.localStorage.clear();
  container.innerHTML = renderToString(app);
  document.body.appendChild(container);
  window.localStorage.setItem("camquest:muted", "1");
  const onRecoverableError = vi.fn();
  await act(async () => {
    render(app, { container, hydrate: true, onRecoverableError });
  });
  expect(
    screen
      .getByRole("button", { name: "Unmute sound" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(onRecoverableError).not.toHaveBeenCalled();
});
