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
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Command palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
        return;
      }

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

      // 2. Global Hotkeys (when not editing text)
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
