/**
 * Formats seconds into human-readable HH:MM:SS or MM:SS
 */
export function formatSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Compares estimated time with actual recorded time
 */
export function calculateEstimateDelta(
  actualSeconds: number,
  estimatedMinutes: number
): {
  diffMinutes: number;
  actualMinutes: number;
  isOver: boolean;
  deltaLabel: string;
} {
  const actualMinutes = Math.round(actualSeconds / 60);
  const diffMinutes = actualMinutes - estimatedMinutes;
  const isOver = diffMinutes > 0;

  let deltaLabel = "On target";
  if (diffMinutes > 0) {
    deltaLabel = `+${diffMinutes}m over estimate`;
  } else if (diffMinutes < 0) {
    deltaLabel = `${Math.abs(diffMinutes)}m under estimate`;
  }

  return {
    diffMinutes,
    actualMinutes,
    isOver,
    deltaLabel,
  };
}
