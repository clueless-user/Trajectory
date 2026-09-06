import { RabbitHole } from "../models/types";
import { RabbitHoleFacts } from "./types";
import { localDateOf } from "./stats";

/**
 * Rabbit-hole capture behaviour for a week. Counts come from the real status
 * column — the CaptureBacklog UI writes converted/archived statuses, so the
 * numbers are actual resolutions, never estimates.
 */
export function rabbitHoleFacts(
  holes: RabbitHole[],
  weekStart: string,
  weekEnd: string
): RabbitHoleFacts {
  const inWeek = holes.filter((h) => {
    const day = localDateOf(h.created_at);
    return day >= weekStart && day <= weekEnd;
  });
  return {
    captured: inWeek.length,
    converted: inWeek.filter((h) => h.status === "converted_task").length,
    archived: inWeek.filter((h) => h.status === "archived").length,
  };
}
