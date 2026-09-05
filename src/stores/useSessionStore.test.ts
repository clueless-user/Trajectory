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
    useSessionStore.setState({ activeSession: null, interruptedSessions: [] });
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

  it("derives elapsed time from the wall clock without interval ticks", async () => {
    await seedAndStart();

    advanceSeconds(90);
    useSessionStore.getState().syncElapsed();
    expect(useSessionStore.getState().activeSession?.elapsedSeconds).toBe(90);

    // Even without syncElapsed being called, finishing settles the true time.
    advanceSeconds(30);
    await useSessionStore.getState().finishSession(false);

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows[0].duration_seconds).toBe(120);
  });

  it("does not accumulate elapsed time while paused", async () => {
    await seedAndStart();

    advanceSeconds(60);
    useSessionStore.getState().syncElapsed();
    useSessionStore.getState().pauseSession();

    // Wall clock keeps moving during the pause; elapsed must not.
    advanceSeconds(300);
    useSessionStore.getState().syncElapsed();
    expect(useSessionStore.getState().activeSession?.elapsedSeconds).toBe(60);
    expect(useSessionStore.getState().activeSession?.isRunning).toBe(false);

    useSessionStore.getState().resumeSession();
    advanceSeconds(10);
    useSessionStore.getState().syncElapsed();
    expect(useSessionStore.getState().activeSession?.elapsedSeconds).toBe(70);
  });

  it("survives multiple pause/resume cycles with only running time counted", async () => {
    await seedAndStart();

    advanceSeconds(300);
    useSessionStore.getState().syncElapsed();
    useSessionStore.getState().pauseSession();
    advanceSeconds(500); // paused gap
    useSessionStore.getState().resumeSession();
    advanceSeconds(120);
    useSessionStore.getState().syncElapsed();
    useSessionStore.getState().pauseSession();
    advanceSeconds(800); // paused gap
    useSessionStore.getState().resumeSession();
    advanceSeconds(60);
    useSessionStore.getState().syncElapsed();

    expect(useSessionStore.getState().activeSession?.elapsedSeconds).toBe(480);

    await useSessionStore.getState().finishSession(false);

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows.length).toBe(1);
    expect(rows[0].duration_seconds).toBe(480);
    expect(rows[0].completed_state).toBe("finished");
  });

  it("keeps truthful duration when timers are throttled (sync runs late)", async () => {
    await seedAndStart();

    // No syncElapsed for a long stretch — as if the window was backgrounded.
    advanceSeconds(1000);
    await useSessionStore.getState().finishSession(false);

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows[0].duration_seconds).toBe(1000);
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
    useSessionStore.getState().syncElapsed();
    useSessionStore.getState().pauseSession();
    advanceSeconds(900); // 15 paused minutes of wall-clock
    useSessionStore.getState().resumeSession();
    advanceSeconds(60);
    useSessionStore.getState().syncElapsed();

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
    advanceSeconds(120);

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

    advanceSeconds(600); // 10 minutes
    await useSessionStore.getState().finishSession(false);

    const stored = await taskRepo.getTaskById(task.id);
    expect(stored?.actual_minutes).toBe(15);
    expect(stored?.status).toBe("in_progress");
  });

  it("reflects accrued actual minutes in the task store immediately after finishing", async () => {
    await seedAndStart();

    advanceSeconds(600);
    await useSessionStore.getState().finishSession(false);

    const inStore = useTaskStore.getState().tasks[0];
    expect(inStore.actual_minutes).toBe(10);
  });

  it("completes the task when finishing with completeTask=true", async () => {
    const task = await seedAndStart();

    advanceSeconds(300);
    await useSessionStore.getState().finishSession(true);

    const stored = await taskRepo.getTaskById(task.id);
    expect(stored?.status).toBe("completed");
    expect(stored?.completed_at).toBeTruthy(); // set from the real clock in useTaskStore
    expect(useTaskStore.getState().activeTaskId).toBeNull();
  });

  it("leaves a truthful paused row behind when the app dies mid-session", async () => {
    await seedAndStart();
    advanceSeconds(120);

    // Simulate an unclean exit: no finish, no cancel — just reset in-memory state.
    useSessionStore.setState({ activeSession: null });

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows.length).toBe(1);
    expect(rows[0].completed_state).toBe("paused");
    expect(rows[0].duration_seconds).toBe(0); // never promoted to finished
  });

  describe("crash recovery", () => {
    it("surfaces paused rows at boot and keeps them as truthful interrupted records", async () => {
      await seedAndStart();
      advanceSeconds(120);
      useSessionStore.setState({ activeSession: null }); // simulate the crash

      await useSessionStore.getState().loadInterruptedSessions();
      const found = useSessionStore.getState().interruptedSessions;
      expect(found.length).toBe(1);
      expect(found[0].completed_state).toBe("paused");

      advanceSeconds(60);
      await useSessionStore.getState().keepInterruptedRecord(found[0].id);

      expect(useSessionStore.getState().interruptedSessions.length).toBe(0);
      const rows = await sessionRepo.getRecentSessions(10);
      expect(rows[0].completed_state).toBe("interrupted");
      expect(rows[0].end_time).toBe("2026-09-04T09:03:00.000Z"); // recovery moment
      expect(rows[0].duration_seconds).toBe(0); // true worked time unknown — not invented
      expect(rows[0].start_time).toBe("2026-09-04T09:00:00.000Z");
    });

    it("discards an interrupted row entirely on request", async () => {
      await seedAndStart();
      useSessionStore.setState({ activeSession: null });

      await useSessionStore.getState().loadInterruptedSessions();
      const id = useSessionStore.getState().interruptedSessions[0].id;
      await useSessionStore.getState().discardInterruptedSession(id);

      expect(useSessionStore.getState().interruptedSessions.length).toBe(0);
      expect((await sessionRepo.getRecentSessions(10)).length).toBe(0);
    });

    it("resumes an interrupted session in place without creating a duplicate", async () => {
      const task = await seedAndStart();
      advanceSeconds(120);
      useSessionStore.setState({ activeSession: null }); // the "crash"

      await useSessionStore.getState().loadInterruptedSessions();
      const row = useSessionStore.getState().interruptedSessions[0];
      const rowCountBefore = (await sessionRepo.getRecentSessions(10)).length;

      advanceSeconds(600); // time passed while interrupted
      await useSessionStore.getState().resumeInterruptedSession(row.id);

      const session = useSessionStore.getState().activeSession;
      expect(session?.sessionId).toBe(row.id); // same row adopted
      expect(session?.taskId).toBe(task.id);
      expect(session?.isRunning).toBe(true);
      expect(useSessionStore.getState().interruptedSessions.length).toBe(0);

      const rows = await sessionRepo.getRecentSessions(10);
      expect(rows.length).toBe(rowCountBefore); // no duplicate session

      // Timer runs from the adoption point; finish records from there.
      advanceSeconds(60);
      await useSessionStore.getState().finishSession(false);
      const finished = (await sessionRepo.getRecentSessions(10))[0];
      expect(finished.id).toBe(row.id);
      expect(finished.duration_seconds).toBe(60);
    });

    it("refuses adoption while a session is already live", async () => {
      await seedAndStart();
      const orphanRowId = "99999999-9999-4999-8999-999999999999";
      useSessionStore.setState({
        interruptedSessions: [
          {
            id: orphanRowId,
            task_id: null,
            start_time: "2026-09-04T08:00:00.000Z",
            end_time: "2026-09-04T08:00:00.000Z",
            duration_seconds: 0,
            interruption_count: 0,
            completed_state: "paused",
            notes: null,
            created_at: "2026-09-04T08:00:00.000Z",
          },
        ],
      });

      await useSessionStore.getState().resumeInterruptedSession(orphanRowId);

      // The live session was untouched; the orphan was not adopted.
      expect(useSessionStore.getState().activeSession?.sessionId).not.toBe(orphanRowId);
      expect(useSessionStore.getState().interruptedSessions.length).toBe(1);
    });

    it("does not treat finished sessions as interrupted", async () => {
      await seedAndStart();
      await useSessionStore.getState().finishSession(false);

      await useSessionStore.getState().loadInterruptedSessions();
      expect(useSessionStore.getState().interruptedSessions.length).toBe(0);
    });
  });
});
