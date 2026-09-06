import { useEffect } from "react";
import { useUIStore } from "../stores/useUIStore";
import { useSessionStore } from "../stores/useSessionStore";

export function useKeyboardShortcuts() {
  const {
    isRabbitHoleModalOpen,
    isNewTaskModalOpen,
    isCompressionModalOpen,
    isCommandPaletteOpen,
    setRabbitHoleModalOpen,
    setNewTaskModalOpen,
    setCompressionModalOpen,
    setCommandPaletteOpen,
    setActiveView,
  } = useUIStore();

  const { activeSession, pauseSession, resumeSession } = useSessionStore();

  useEffect(() => {
    // Leading-keystroke-loss guard: when a user starts typing with no input
    // focused (e.g. beginning a task title straight away on the Today screen),
    // single-letter hotkeys would fire mid-word — "Finish…" opened the New Task
    // modal on the "n" and its autofocused input silently captured the rest
    // ("ish the NOW execution console" is that exact artifact in real data).
    // A hotkey now fires only on an ISOLATED keypress (no other keydown within
    // 500ms): a deliberate command, never part of a typing burst. Ctrl+K is
    // exempt (modifier chord, cannot be typing). Residual limitation: the
    // burst's characters themselves still go nowhere when no input is focused.
    let lastKeydownAt = 0;
    const TYPING_BURST_MS = 500;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Command palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
        return;
      }

      const now = Date.now();
      const isBurst = now - lastKeydownAt < TYPING_BURST_MS;
      lastKeydownAt = now;

      // Check if user is currently typing in an input/textarea
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isInputFocused) {
        return;
      }

      // 2. Global Hotkeys (when not editing text) — isolated presses only.
      if (isBurst) {
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setNewTaskModalOpen(true);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setRabbitHoleModalOpen(true);
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        setActiveView("brain_dump");
      } else if (e.code === "Space") {
        if (activeSession) {
          e.preventDefault();
          if (activeSession.isRunning) {
            pauseSession();
          } else {
            resumeSession();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isCommandPaletteOpen,
    isRabbitHoleModalOpen,
    isNewTaskModalOpen,
    isCompressionModalOpen,
    activeSession,
    setCommandPaletteOpen,
    setNewTaskModalOpen,
    setRabbitHoleModalOpen,
    setCompressionModalOpen,
    setActiveView,
    pauseSession,
    resumeSession,
  ]);
}
