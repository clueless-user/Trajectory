-- Migration 001: Initial Schema for Trajectory

CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_date TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'achieved', 'paused', 'abandoned')) DEFAULT 'active',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_area ON goals(area_id);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
    area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'on_hold', 'archived')) DEFAULT 'active',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_goal ON projects(goal_id);
CREATE INDEX IF NOT EXISTS idx_projects_area ON projects(area_id);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    importance TEXT NOT NULL CHECK(importance IN ('critical', 'important', 'optional')) DEFAULT 'important',
    cognitive_demand TEXT NOT NULL CHECK(cognitive_demand IN ('deep', 'medium', 'shallow')) DEFAULT 'medium',
    status TEXT NOT NULL CHECK(status IN ('inbox', 'planned', 'in_progress', 'completed', 'cancelled', 'deferred')) DEFAULT 'inbox',
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    actual_minutes INTEGER NOT NULL DEFAULT 0,
    scheduled_date TEXT,
    due_date TEXT,
    completed_at TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_status_date ON tasks(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_actions_task ON actions(task_id);

CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'minutes',
    normal_target REAL NOT NULL,
    minimum_target REAL NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 0,
    target_met_status TEXT NOT NULL CHECK(target_met_status IN ('none', 'minimum', 'normal', 'exceeded')),
    notes TEXT,
    logged_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_logs_unique_day ON habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);

CREATE TABLE IF NOT EXISTS work_sessions (
    id TEXT PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    interruption_count INTEGER NOT NULL DEFAULT 0,
    completed_state TEXT NOT NULL CHECK(completed_state IN ('finished', 'interrupted', 'paused')),
    notes TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_sessions_task ON work_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_start ON work_sessions(start_time);

CREATE TABLE IF NOT EXISTS daily_states (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    energy INTEGER CHECK(energy BETWEEN 1 AND 10),
    clarity INTEGER CHECK(clarity BETWEEN 1 AND 10),
    stress INTEGER CHECK(stress BETWEEN 1 AND 10),
    social_battery INTEGER CHECK(social_battery BETWEEN 1 AND 10),
    notes TEXT,
    logged_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_states_date ON daily_states(date);

CREATE TABLE IF NOT EXISTS daily_reviews (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    completed_task_count INTEGER NOT NULL DEFAULT 0,
    total_work_minutes INTEGER NOT NULL DEFAULT 0,
    energy_drains TEXT,
    energy_boosts TEXT,
    tomorrow_objective TEXT,
    reflection_notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rabbit_holes (
    id TEXT PRIMARY KEY,
    active_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    active_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    raw_text TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('captured', 'converted_task', 'converted_project', 'converted_idea', 'archived')) DEFAULT 'captured',
    converted_id TEXT,
    created_at TEXT NOT NULL,
    converted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rabbit_holes_status ON rabbit_holes(status);

CREATE TABLE IF NOT EXISTS brain_dumps (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
