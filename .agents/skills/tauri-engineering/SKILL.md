---
name: tauri-engineering
description: Implements and reviews native desktop functionality using Tauri 2. Use whenever modifying src-tauri, native APIs, plugins, persistence, notifications, tray behavior, or desktop packaging.
---

# Tauri Engineering Rules

Use Tauri 2 APIs and official plugins whenever possible.

Frontend:
React + TypeScript

Native:
Rust + Tauri 2

## Persistence

Use SQLite through tauri-plugin-sql.

Database access should be isolated from React components.

Use migrations for schema changes.

Never modify the database schema without adding a migration.

## Filesystem

Use the official Tauri filesystem plugin for application data.

Respect Tauri capability permissions.

Do not request broad filesystem permissions.

Use application-specific directories.

## Notifications

Use Tauri's notification plugin.

Notifications should be:
- sparse
- actionable
- context-aware

Never implement repetitive reminder spam.

## Desktop Behaviour

The application should support:

- native window
- system tray
- startup behaviour where appropriate
- native notifications
- keyboard shortcuts
- persistent local state

## Security

Follow least privilege.

Every Tauri plugin capability must be explicitly justified.

Do not expose unnecessary Rust commands to the frontend.

Validate arguments crossing the frontend/native boundary.

## Development

Use:

npm/pnpm scripts → Tauri CLI → Rust

Verify both:

1. frontend type/build correctness
2. Tauri compilation correctness

When debugging native behaviour, inspect Rust logs rather than guessing from frontend symptoms.