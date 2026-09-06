import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useUIStore } from "../stores/useUIStore";
import { useSessionStore } from "../stores/useSessionStore";

const Harness: React.FC = () => {
  useKeyboardShortcuts();
  return null;
};

function key(keyStr: string, init: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(window, { key: keyStr, bubbles: true, ...init });
}

describe("useKeyboardShortcuts leading-keystroke guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUIStore.setState({
      activeView: "today",
      isRabbitHoleModalOpen: false,
      isNewTaskModalOpen: false,
      isCompressionModalOpen: false,
      isCommandPaletteOpen: false,
    });
    useSessionStore.setState({ activeSession: null, interruptedSessions: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the New Task modal on an isolated 'n'", () => {
    render(<Harness />);
    vi.advanceTimersByTime(1000); // idle before the press
    key("n");
    expect(useUIStore.getState().isNewTaskModalOpen).toBe(true);
  });

  it("does NOT fire hotkeys mid-typing-burst (leading-keystroke loss, V-1b)", () => {
    render(<Harness />);
    // Reproduces the real data artifact: user types "Finish…" with no input
    // focused. "n" is the third keystroke — it must not open a modal whose
    // autofocused input would swallow the rest of the sentence.
    key("f");
    vi.advanceTimersByTime(60);
    key("i");
    vi.advanceTimersByTime(60);
    key("n");
    expect(useUIStore.getState().isNewTaskModalOpen).toBe(false);
    expect(useUIStore.getState().isRabbitHoleModalOpen).toBe(false);
    expect(useUIStore.getState().activeView).toBe("today");
  });

  it("still fires a hotkey after the burst settles", () => {
    render(<Harness />);
    key("f");
    vi.advanceTimersByTime(60);
    key("i");
    vi.advanceTimersByTime(600); // typing paused well beyond the burst window
    key("n");
    expect(useUIStore.getState().isNewTaskModalOpen).toBe(true);
  });

  it("never suppresses Ctrl+K, even mid-burst", () => {
    render(<Harness />);
    key("f");
    vi.advanceTimersByTime(30);
    key("k", { ctrlKey: true });
    expect(useUIStore.getState().isCommandPaletteOpen).toBe(true);
  });
});
