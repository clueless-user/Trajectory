// Deterministic development/demo seed. Populates every table with a fixed,
// identity-stable dataset (fixed UUIDs + seeded PRNG) so screenshots, tests
// and demos are reproducible. Guarded: refuses to run once real tasks exist.
// Dates are relative to today (LOCAL day keys; UTC ISO instants for
// timestamps), so the demo always looks fresh.
import { getDatabase } from "../database";
import { dayFromTodayLocal } from "../../domain/time/date";

// Deterministic PRNG (mulberry32) so the dataset is identical on every
// machine and every run.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = (() => {
  let current = mulberry32(42);
  return {
    next: () => current(),
    reset: () => {
      current = mulberry32(42);
    },
  };
})();
const pick = <T,>(items: T[]): T => items[Math.floor(rand.next() * items.length)];
const between = (min: number, max: number) => min + Math.floor(rand.next() * (max - min + 1));

function dayOffset(offset: number): string {
  return dayFromTodayLocal(offset);
}

// UTC ISO instant at a fixed wall-clock hour on an offset day — keeps
// seeded sessions/reviews inside predictable hour buckets.
function isoAt(offsetDays: number, hour: number, minute = 0): string {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

// Fixed UUIDs: the dataset is identity-stable across machines and runs.
const GOALS = {
  inference: "dea10001-0000-4000-8000-000000000001",
  econometrics: "dea10001-0000-4000-8000-000000000002",
  dagStudy: "dea10001-0000-4000-8000-000000000003",
  physical: "dea10001-0000-4000-8000-000000000004",
};
const PROJECTS = {
  kvCache: "dea10002-0000-4000-8000-000000000001",
  memProfile: "dea10002-0000-4000-8000-000000000002",
  litReview: "dea10002-0000-4000-8000-000000000003",
  dagProject: "dea10002-0000-4000-8000-000000000004",
};
const TASKS = {
  kvHarness: "dea10003-0000-4000-8000-000000000001",
  kernelProfile: "dea10003-0000-4000-8000-000000000002",
  posteriorPapers: "dea10003-0000-4000-8000-000000000003",
  dagHarness: "dea10003-0000-4000-8000-000000000004",
  readingList: "dea10003-0000-4000-8000-000000000005",
  blogPost: "dea10003-0000-4000-8000-000000000006",
  ciReview: "dea10003-0000-4000-8000-000000000007",
  ciFix: "dea10003-0000-4000-8000-000000000008",
  specDraft: "dea10003-0000-4000-8000-000000000009",
  baselineRun: "dea10003-0000-4000-8000-00000000000a",
};
const RABBIT_HOLES = {
  captured: "dea10004-0000-4000-8000-000000000001",
  converted: "dea10004-0000-4000-8000-000000000002",
};

const AREA = {
  ai: "11111111-1111-4111-8111-111111111111",
  research: "22222222-2222-4222-8222-222222222222",
  health: "33333333-3333-4333-8333-333333333333",
};
const HABIT = {
  deepWork: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  exercise: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  meditation: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  reading: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
};

interface DevSeedSummary {
  goals: number;
  projects: number;
  tasks: number;
  habitLogs: number;
  workSessions: number;
  dailyStates: number;
  reviews: number;
  rabbitHoles: number;
}

export async function isTaskTableEmpty(): Promise<boolean> {
  const db = getDatabase();
  const rows = await db.select<{ count: number }>("SELECT COUNT(*) as count FROM tasks;");
  return (rows[0]?.count ?? 0) === 0;
}

/**
 * Loads the deterministic development/demo dataset. Clearly marked as demo
 * data and refused when real tasks already exist — never mixes with user data.
 */
export async function seedDevelopmentData(): Promise<DevSeedSummary> {
  const db = getDatabase();

  // Same seed on every run: identical dataset on any machine, any run count.
  rand.reset();

  if (!(await isTaskTableEmpty())) {
    throw new Error(
      "Development seed refused: tasks already exist. The seed never mixes demo data with real data."
    );
  }

  const now = new Date().toISOString();
  const summary: DevSeedSummary = {
    goals: 0,
    projects: 0,
    tasks: 0,
    habitLogs: 0,
    workSessions: 0,
    dailyStates: 0,
    reviews: 0,
    rabbitHoles: 0,
  };

  // --- Goals ---
  const goals = [
    { id: GOALS.inference, area_id: AREA.ai, title: "Ship LLM inference platform", target_date: dayOffset(90) },
    { id: GOALS.econometrics, area_id: AREA.research, title: "Publish Bayesian econometrics paper", target_date: dayOffset(120) },
    { id: GOALS.dagStudy, area_id: AREA.research, title: "Run synthetic DAG benchmark study", target_date: dayOffset(60) },
    { id: GOALS.physical, area_id: AREA.health, title: "Maintain physical baseline", target_date: null },
  ];
  for (const g of goals) {
    await db.execute(
      "INSERT INTO goals (id, area_id, title, description, target_date, status, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?);",
      [g.id, g.area_id, g.title, null, g.target_date, goals.indexOf(g), now, now]
    );
    summary.goals++;
  }

  // --- Projects ---
  const projects = [
    { id: PROJECTS.kvCache, goal_id: GOALS.inference, area_id: AREA.ai, title: "KV Cache Benchmark" },
    { id: PROJECTS.memProfile, goal_id: GOALS.inference, area_id: AREA.ai, title: "Memory Profiling" },
    { id: PROJECTS.litReview, goal_id: GOALS.econometrics, area_id: AREA.research, title: "Literature Review" },
    { id: PROJECTS.dagProject, goal_id: GOALS.dagStudy, area_id: AREA.research, title: "Synthetic DAG Project" },
  ];
  for (const p of projects) {
    await db.execute(
      "INSERT INTO projects (id, goal_id, area_id, title, description, status, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, 'active', ?, ?, ?);",
      [p.id, p.goal_id, p.area_id, p.title, projects.indexOf(p), now, now]
    );
    summary.projects++;
  }

  // --- Tasks ---
  // Today's plan: 435 planned minutes against the 420 default capacity so the
  // workload bar reads overloaded and compression has something to defer.
  const tasks = [
    { id: TASKS.ciReview, project_id: PROJECTS.kvCache, title: "Morning review of benchmark CI failures", importance: "critical", demand: "medium", est: 30, status: "completed", actual: 35, sched: dayOffset(0), due: null, order: 0 },
    { id: TASKS.kvHarness, project_id: PROJECTS.kvCache, title: "Finalize KV cache eviction benchmark harness", importance: "critical", demand: "deep", est: 90, status: "in_progress", actual: 0, sched: dayOffset(0), due: dayOffset(2), order: 1 },
    { id: TASKS.kernelProfile, project_id: PROJECTS.memProfile, title: "Profile attention kernel memory bandwidth", importance: "important", demand: "deep", est: 60, status: "planned", actual: 0, sched: dayOffset(0), due: null, order: 2 },
    { id: TASKS.posteriorPapers, project_id: PROJECTS.litReview, title: "Summarize three recent papers on posterior sampling", importance: "important", demand: "medium", est: 45, status: "planned", actual: 0, sched: dayOffset(0), due: null, order: 3 },
    { id: TASKS.dagHarness, project_id: PROJECTS.dagProject, title: "Implement synthetic DAG generator baseline harness", importance: "important", demand: "medium", est: 120, status: "planned", actual: 0, sched: dayOffset(0), due: dayOffset(7), order: 4 },
    { id: TASKS.readingList, project_id: null, title: "Reorganize the reading list by cognitive demand", importance: "optional", demand: "shallow", est: 30, status: "planned", actual: 0, sched: dayOffset(0), due: null, order: 5 },
    { id: TASKS.blogPost, project_id: PROJECTS.kvCache, title: "Draft blog post on inference caching tradeoffs", importance: "optional", demand: "medium", est: 90, status: "planned", actual: 0, sched: dayOffset(0), due: null, order: 6 },
  ];
  // History: finished work on earlier days (completed_at set, actual close to estimate).
  tasks.push(
    { id: TASKS.ciFix, project_id: PROJECTS.kvCache, title: "Fix flaky eviction-rate assertion in CI", importance: "important", demand: "medium", est: 45, status: "completed", actual: 55, sched: dayOffset(-1), due: null, order: 0 },
    { id: TASKS.specDraft, project_id: PROJECTS.litReview, title: "Draft model specification outline", importance: "important", demand: "deep", est: 90, status: "completed", actual: 80, sched: dayOffset(-2), due: null, order: 0 },
    { id: TASKS.baselineRun, project_id: PROJECTS.dagProject, title: "Run first baseline sweep on generated DAGs", importance: "optional", demand: "medium", est: 60, status: "cancelled", actual: 0, sched: dayOffset(-3), due: null, order: 0 },
  );

  for (const t of tasks) {
    await db.execute(
      `INSERT INTO tasks (id, project_id, title, description, importance, cognitive_demand, status,
       estimated_minutes, actual_minutes, scheduled_date, due_date, completed_at, order_index, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);`,
      [
        t.id,
        t.project_id,
        t.title,
        t.importance,
        t.demand,
        t.status,
        t.est,
        t.actual,
        t.sched,
        t.due,
        t.status === "completed" ? isoAt(typeof t.sched === "string" && t.sched < dayOffset(0) ? -1 : 0, 17) : null,
        t.order,
        now,
        now,
      ]
    );
    summary.tasks++;
  }

  // --- Habit logs: 14 days of history ending yesterday (today is left open) ---
  const habitPlan: Array<{ id: string; normal: number; minimum: number; weights: HabitOutcome[] }> = [
    { id: HABIT.deepWork, normal: 180, minimum: 30, weights: ["normal", "normal", "normal", "minimum", "normal", "none", "normal"] },
    { id: HABIT.exercise, normal: 45, minimum: 10, weights: ["minimum", "normal", "none", "minimum", "normal", "minimum", "none"] },
    { id: HABIT.meditation, normal: 60, minimum: 5, weights: ["minimum", "minimum", "minimum", "normal", "none", "minimum", "minimum"] },
    { id: HABIT.reading, normal: 45, minimum: 15, weights: ["normal", "none", "minimum", "minimum", "minimum", "normal", "none"] },
  ];
  type HabitOutcome = "normal" | "minimum" | "none";

  for (let offset = -14; offset <= -1; offset++) {
    const date = dayOffset(offset);
    for (const habit of habitPlan) {
      const outcome = pick(habit.weights);
      if (outcome === "none") continue;
      const value = outcome === "normal" ? habit.normal + between(0, 20) : habit.minimum;
      const status = outcome === "normal" ? (value > habit.normal * 1.5 ? "exceeded" : "normal") : "minimum";
      await db.execute(
        "INSERT INTO habit_logs (id, habit_id, date, value, target_met_status, notes, logged_at) VALUES (?, ?, ?, ?, ?, NULL, ?);",
        [crypto.randomUUID(), habit.id, date, value, status, isoAt(offset, 21)]
      );
      summary.habitLogs++;
    }

    // Daily states with realistic variance.
    await db.execute(
      "INSERT INTO daily_states (id, date, energy, clarity, stress, social_battery, notes, logged_at) VALUES (?, ?, ?, ?, ?, ?, 'development seed', ?);",
      [crypto.randomUUID(), date, between(4, 9), between(4, 9), between(2, 6), between(3, 8), isoAt(offset, 21, 30)]
    );
    summary.dailyStates++;

    // Work sessions: one or two finished sessions on recent days.
    const sessionCount = between(1, 2);
    const workTasks = tasks.filter((t) => t.status !== "cancelled");
    for (let s = 0; s < sessionCount; s++) {
      const startHour = between(9, 15);
      const durationMinutes = between(25, 110);
      await db.execute(
        `INSERT INTO work_sessions (id, task_id, start_time, end_time, duration_seconds, interruption_count, completed_state, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'finished', NULL, ?);`,
        [
          crypto.randomUUID(),
          pick(workTasks).id,
          isoAt(offset, startHour),
          isoAt(offset, startHour, durationMinutes),
          durationMinutes * 60,
          rand.next() < 0.3 ? between(1, 2) : 0,
          now,
        ]
      );
      summary.workSessions++;
    }
  }

  // --- Daily reviews for two evenings ago and yesterday (today left open) ---
  const reviews = [
    { date: dayOffset(-2), done: 3, minutes: 165, drains: "Endless benchmark reruns without a hypothesis", boosts: "Two uninterrupted hours on the eviction harness", objective: "Finish the KV cache eviction benchmark harness", notes: "Spec draft went faster once the noise sources were pinned down." },
    { date: dayOffset(-1), done: 2, minutes: 95, drains: "Slack threads during the profiling block", boosts: "Morning CI triage closed out quickly", objective: "Profile attention kernel memory bandwidth", notes: null },
  ];
  for (const r of reviews) {
    await db.execute(
      `INSERT INTO daily_reviews (id, date, completed_task_count, total_work_minutes, energy_drains, energy_boosts, tomorrow_objective, reflection_notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [crypto.randomUUID(), r.date, r.done, r.minutes, r.drains, r.boosts, r.objective, r.notes, now]
    );
    summary.reviews++;
  }

  // --- Rabbit holes: one open capture, one already converted into a task ---
  await db.execute(
    "INSERT INTO rabbit_holes (id, active_task_id, active_project_id, raw_text, status, converted_id, created_at, converted_at) VALUES (?, ?, ?, ?, 'captured', NULL, ?, NULL);",
    [RABBIT_HOLES.captured, TASKS.kvHarness, PROJECTS.kvCache, "Why does cuBLAS pick different split-k heuristics for batch=1 vs batch=8?", now]
  );
  summary.rabbitHoles++;
  await db.execute(
    "INSERT INTO rabbit_holes (id, active_task_id, active_project_id, raw_text, status, converted_id, created_at, converted_at) VALUES (?, ?, ?, ?, 'converted_task', ?, ?, ?);",
    [RABBIT_HOLES.converted, TASKS.kvHarness, PROJECTS.kvCache, "WAL mode might speed up trajectory's own reads — benchmark it", TASKS.readingList, isoAt(-1, 11), isoAt(-1, 15)]
  );
  summary.rabbitHoles++;

  // --- Brain dump, clearly marked as demo data ---
  await db.execute(
    "INSERT INTO brain_dumps (id, content, created_at, updated_at) VALUES (?, ?, ?, ?);",
    [
      crypto.randomUUID(),
      [
        "=== DEVELOPMENT SEED DATA — safe to wipe ===",
        "",
        "Eviction policy question: does LRU actually beat clock-sweep once the",
        "working set exceeds the cache by 4x? Needs a benchmark matrix.",
        "",
        "- ask Prof. Rao about posterior samplers that handle missing covariates",
        "- the DAG baseline harness should emit adjacency matrices in the same",
        "  format the R reference implementation uses",
        "- idea: cache-aware batching for the inference gateway?",
      ].join("\n"),
      now,
      now,
    ]
  );

  return summary;
}
