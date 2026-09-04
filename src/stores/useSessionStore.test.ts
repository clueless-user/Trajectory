import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useSessionStore, setNowForTesting } from "./useSessionStore";
import { useTaskStore } from "./useTaskStore";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { TaskRepository } from "../repositories/taskRepository";
import { WorkSessionRepository } from "../repositories/workSessionRepository";
import { Task } from "../domain/models/types";

const taskRepo = new TaskRepository();
const sessionRepo = new WorkSessionRepository();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    project_id: null,
    title: "Benchmark the KV cache",
    description: null,
    importance: "critical",
    cognitive_demand: "deep",
    status: "planned",
    estimated_minutes: 60,
    actual_minutes: 0,
    scheduled_date: "2026-09-04",
    due_date: null,
    completed_at: null,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// Deterministic clock: tests advance time explicitly, never wall-clock waiting.
let fakeNowMs: number;
function advanceSeconds(seconds: number) {
  fakeNowMs += seconds * 1000;
}

describe("useSessionStore — deep work session lifecycle", () => {
  beforeEach(() => {
    fakeNowMs = Date.parse("2026-09-04T09:00:00Z");
    setNowForTesting(() => new Date(fakeNowMs));
  });

  afterEach(async () => {
    useSessionStore.setState({ activeSession: null });
    useTaskStore.setState({ tasks: [], activeTaskId: null });
  });

  async function freshDb() {
    setDatabase(await createInMemoryDatabase());
  }

  async function seedAndStart(taskOverrides: Partial<Task> = {}) {
    await freshDb();
    // Persist the task for real — startSession mutates it through the repo.
    const task = await taskRepo.createTask(makeTask(taskOverrides));
    useTaskStore.setState({ tasks: [task], activeTaskId: task.id });
    await useSessionStore.getState().startSession(task);
    return task;
  }

  it("persists a crash-safety row at start and transitions the task to in_progress", async () => {
    const task = await seedAndStart();

    const session = useSessionStore.getState().activeSession;
    expect(session).not.toBeNull();
    expect(session?.taskId).toBe(task.id);
    expect(session?.elapsedSeconds).toBe(0);
    expect(session?.isRunning).toBe(true);

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(session?.sessionId);
    expect(rows[0].task_id).toBe(task.id);
    expect(rows[0].completed_state).toBe("paused");
    expect(rows[0].duration_seconds).toBe(0);

    expect(useTaskStore.getState().tasks[0].status).toBe("in_progress");
  });

  it("ignores a second start while a session is already active", async () => {
    const first = await seedAndStart();
    const second = makeTask({ title: "Other task" });

    await useSessionStore.getState().startSession(second);

    const session = useSessionStore.getState().activeSession;
    expect(session?.taskId).toBe(first.id);

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows.length).toBe(1);
  });

  it("does not accumulate elapsed time while paused", async () => {
    await seedAndStart();

    useSessionStore.getState().pauseSession();
    for (let i = 0; i < 30; i++) useSessionStore.getState().tick(1);
    expect(useSessionStore.getState().activeSession?.elapsedSeconds).toBe(0);
    expect(useSessionStore.getState().activeSession?.isRunning).toBe(false);

    useSessionStore.getState().resumeSession();
    useSessionStore.getState().tick(10);
    expect(useSessionStore.getState().activeSession?.elapsedSeconds).toBe(10);
  });

  it("survives multiple pause/resume cycles with only running time counted", async () => {
    await seedAndStart();

    useSessionStore.getState().tick(300);
    useSessionStore.getState().pauseSession();
    useSessionStore.getState().resumeSession();
    useSessionStore.getState().tick(120);
    useSessionStore.getState().pauseSession();
    useSessionStore.getState().resumeSession();
    useSessionStore.getState().tick(60);

    expect(useSessionStore.getState().activeSession?.elapsedSeconds).toBe(480);

    advanceSeconds(480);
    await useSessionStore.getState().finishSession(false);

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows.length).toBe(1);
    expect(rows[0].duration_seconds).toBe(480);
    expect(rows[0].completed_state).toBe("finished");
  });

  it("finishes immediately with zero duration when nothing elapsed", async () => {
    await seedAndStart();
    await useSessionStore.getState().finishSession(false);

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows.length).toBe(1);
    expect(rows[0].duration_seconds).toBe(0);
    expect(rows[0].completed_state).toBe("finished");
    expect(useSessionStore.getState().activeSession).toBeNull();
  });

  it("writes end_time from the injectable clock and excludes paused gaps from duration", async () => {
    await seedAndStart();

    advanceSeconds(600); // 10 minutes of work
    useSessionStore.getState().tick(600);
    useSessionStore.getState().pauseSession();
    advanceSeconds(900); // 15 paused minutes of wall-clock
    useSessionStore.getState().resumeSession();
    useSessionStore.getState().tick(60);
    advanceSeconds(60);

    await useSessionStore.getState().finishSession(false);

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows[0].start_time).toBe("2026-09-04T09:00:00.000Z");
    expect(rows[0].end_time).toBe("2026-09-04T09:26:00.000Z"); // wall clock includes the pause
    expect(rows[0].duration_seconds).toBe(660); // duration counts only running time
  });

  it("counts interruptions and appends formatted notes", async () => {
    await seedAndStart();

    useSessionStore.getState().recordInterruption("Slack ping");
    useSessionStore.getState().recordInterruption("Phone call");

    const session = useSessionStore.getState().activeSession;
    expect(session?.interruptionCount).toBe(2);
    expect(session?.notes).toContain("[Interruption 1]: Slack ping");
    expect(session?.notes).toContain("[Interruption 2]: Phone call");

    await useSessionStore.getState().finishSession(false);
    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows[0].interruption_count).toBe(2);
    expect(rows[0].notes).toContain("[Interruption 2]: Phone call");
  });

  it("updates scratchpad notes onto the persisted session", async () => {
    await seedAndStart();

    useSessionStore.getState().updateNotes("Found the allocation hotspot");
    await useSessionStore.getState().finishSession(false);

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows[0].notes).toBe("Found the allocation hotspot");
  });

  it("cancelling removes the crash-safety row and persists nothing", async () => {
    const task = await seedAndStart();
    useSessionStore.getState().tick(120);

    await useSessionStore.getState().cancelSession();

    expect(useSessionStore.getState().activeSession).toBeNull();
    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows.length).toBe(0);

    // Cancellation discards the session but leaves the task as it was.
    const stored = await taskRepo.getTaskById(task.id);
    expect(stored?.status).toBe("in_progress");
    expect(stored?.actual_minutes).toBe(0);
  });

  it("accrues rounded actual minutes onto the task when finishing", async () => {
    const task = await seedAndStart({ actual_minutes: 5 });

    useSessionStore.getState().tick(600); // 10 minutes
    advanceSeconds(600);
    await useSessionStore.getState().finishSession(false);

    const stored = await taskRepo.getTaskById(task.id);
    expect(stored?.actual_minutes).toBe(15);
    expect(stored?.status).toBe("in_progress");
  });

  it("reflects accrued actual minutes in the task store immediately after finishing", async () => {
    await seedAndStart();

    useSessionStore.getState().tick(600);
    advanceSeconds(600);
    await useSessionStore.getState().finishSession(false);

    const inStore = useTaskStore.getState().tasks[0];
    expect(inStore.actual_minutes).toBe(10);
  });

  it("completes the task when finishing with completeTask=true", async () => {
    const task = await seedAndStart();

    useSessionStore.getState().tick(300);
    advanceSeconds(300);
    await useSessionStore.getState().finishSession(true);

    const stored = await taskRepo.getTaskById(task.id);
    expect(stored?.status).toBe("completed");
    expect(stored?.completed_at).toBeTruthy(); // set from the real clock in useTaskStore
    expect(useTaskStore.getState().activeTaskId).toBeNull();
  });

  it("leaves a truthful paused row behind when the app dies mid-session", async () => {
    await seedAndStart();
    useSessionStore.getState().tick(120);

    // Simulate an unclean exit: no finish, no cancel — just reset in-memory state.
    useSessionStore.setState({ activeSession: null });

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows.length).toBe(1);
    expect(rows[0].completed_state).toBe("paused");
    expect(rows[0].duration_seconds).toBe(0); // never promoted to finished
  });
});
