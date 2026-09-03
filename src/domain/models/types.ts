import { z } from "zod";

// --- Enums & Literals ---
export const ImportanceSchema = z.enum(["critical", "important", "optional"]);
export type Importance = z.infer<typeof ImportanceSchema>;

export const CognitiveDemandSchema = z.enum(["deep", "medium", "shallow"]);
export type CognitiveDemand = z.infer<typeof CognitiveDemandSchema>;

export const TaskStatusSchema = z.enum([
  "inbox",
  "planned",
  "in_progress",
  "completed",
  "cancelled",
  "deferred",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const ExecutionModeSchema = z.enum([
  "deep_work",
  "admin",
  "learning",
  "physical",
  "shutdown",
]);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

export const HabitTargetStatusSchema = z.enum([
  "none",
  "minimum",
  "normal",
  "exceeded",
]);
export type HabitTargetStatus = z.infer<typeof HabitTargetStatusSchema>;

export const RabbitHoleStatusSchema = z.enum([
  "captured",
  "converted_task",
  "converted_project",
  "converted_idea",
  "archived",
]);
export type RabbitHoleStatus = z.infer<typeof RabbitHoleStatusSchema>;

// --- Domain Models ---

// 1. Life Area
export const AreaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  color: z.string().default("#3b82f6"),
  order_index: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Area = z.infer<typeof AreaSchema>;

// 2. Goal
export const GoalSchema = z.object({
  id: z.string().uuid(),
  area_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  target_date: z.string().nullable().optional(),
  status: z.enum(["active", "achieved", "paused", "abandoned"]).default("active"),
  order_index: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Goal = z.infer<typeof GoalSchema>;

// 3. Project
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  goal_id: z.string().uuid().nullable().optional(),
  area_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "completed", "on_hold", "archived"]).default("active"),
  order_index: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

// 4. Task
export const TaskSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  importance: ImportanceSchema.default("important"),
  cognitive_demand: CognitiveDemandSchema.default("medium"),
  status: TaskStatusSchema.default("inbox"),
  estimated_minutes: z.number().int().min(0).default(30),
  actual_minutes: z.number().int().min(0).default(0),
  scheduled_date: z.string().nullable().optional(), // YYYY-MM-DD
  due_date: z.string().nullable().optional(),       // ISO timestamp
  completed_at: z.string().nullable().optional(),   // ISO timestamp
  order_index: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

// 5. Action (Subtask / Checkpoint)
export const ActionSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  title: z.string().min(1),
  is_completed: z.boolean().default(false),
  order_index: z.number().int().default(0),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
});
export type Action = z.infer<typeof ActionSchema>;

// 6. Habit
export const HabitSchema = z.object({
  id: z.string().uuid(),
  area_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  unit: z.string().default("minutes"),
  normal_target: z.number().min(0),
  minimum_target: z.number().min(0),
  order_index: z.number().int().default(0),
  is_archived: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Habit = z.infer<typeof HabitSchema>;

// 7. Habit Log
export const HabitLogSchema = z.object({
  id: z.string().uuid(),
  habit_id: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  value: z.number().min(0).default(0),
  target_met_status: HabitTargetStatusSchema,
  notes: z.string().nullable().optional(),
  logged_at: z.string(),
});
export type HabitLog = z.infer<typeof HabitLogSchema>;

// 8. Work Session
export const WorkSessionSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid().nullable().optional(),
  start_time: z.string(), // ISO
  end_time: z.string(),   // ISO
  duration_seconds: z.number().int().min(0),
  interruption_count: z.number().int().min(0).default(0),
  completed_state: z.enum(["finished", "interrupted", "paused"]),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
});
export type WorkSession = z.infer<typeof WorkSessionSchema>;

// 9. Daily State
export const DailyStateSchema = z.object({
  id: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  energy: z.number().int().min(1).max(10).default(5),
  clarity: z.number().int().min(1).max(10).default(5),
  stress: z.number().int().min(1).max(10).default(5),
  social_battery: z.number().int().min(1).max(10).default(5),
  notes: z.string().nullable().optional(),
  logged_at: z.string(),
});
export type DailyState = z.infer<typeof DailyStateSchema>;

// 10. Daily Review
export const DailyReviewSchema = z.object({
  id: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  completed_task_count: z.number().int().default(0),
  total_work_minutes: z.number().int().default(0),
  energy_drains: z.string().nullable().optional(),
  energy_boosts: z.string().nullable().optional(),
  tomorrow_objective: z.string().nullable().optional(),
  reflection_notes: z.string().nullable().optional(),
  created_at: z.string(),
});
export type DailyReview = z.infer<typeof DailyReviewSchema>;

// 11. Rabbit Hole
export const RabbitHoleSchema = z.object({
  id: z.string().uuid(),
  active_task_id: z.string().uuid().nullable().optional(),
  active_project_id: z.string().uuid().nullable().optional(),
  raw_text: z.string().min(1),
  status: RabbitHoleStatusSchema.default("captured"),
  converted_id: z.string().nullable().optional(),
  created_at: z.string(),
  converted_at: z.string().nullable().optional(),
});
export type RabbitHole = z.infer<typeof RabbitHoleSchema>;

// 12. Brain Dump
export const BrainDumpSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BrainDump = z.infer<typeof BrainDumpSchema>;
