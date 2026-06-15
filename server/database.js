import fs from 'node:fs'
import Database from 'better-sqlite3'

export function openTrackerDatabase({ dbDir, backupDir, logDir, dbPath }) {
  fs.mkdirSync(dbDir, { recursive: true })
  fs.mkdirSync(backupDir, { recursive: true })
  fs.mkdirSync(logDir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      entries_json TEXT NOT NULL,
      session_json TEXT,
      theme TEXT NOT NULL DEFAULT 'light',
      diapers_json TEXT NOT NULL DEFAULT '[]',
      medicines_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_state (
      entry_id TEXT PRIMARY KEY,
      due_at TEXT NOT NULL,
      sent_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deleted_items (
      item_id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      deleted_at TEXT NOT NULL
    );
  `)

  const hasDiapersColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'diapers_json'").get().count > 0
  if (!hasDiapersColumn) db.exec("ALTER TABLE app_state ADD COLUMN diapers_json TEXT NOT NULL DEFAULT '[]'")
  const hasMedicinesColumn = db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('app_state') WHERE name = 'medicines_json'").get().count > 0
  if (!hasMedicinesColumn) db.exec("ALTER TABLE app_state ADD COLUMN medicines_json TEXT NOT NULL DEFAULT '[]'")

  return db
}

export function prepareTrackerStatements(db) {
  return {
    selectState: db.prepare('SELECT entries_json, diapers_json, medicines_json, session_json, theme, updated_at FROM app_state WHERE id = 1'),
    upsertState: db.prepare(`
      INSERT INTO app_state (id, entries_json, diapers_json, medicines_json, session_json, theme, updated_at)
      VALUES (1, @entries_json, @diapers_json, @medicines_json, @session_json, @theme, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        entries_json = excluded.entries_json,
        diapers_json = excluded.diapers_json,
        medicines_json = excluded.medicines_json,
        session_json = excluded.session_json,
        theme = excluded.theme,
        updated_at = excluded.updated_at
    `),
    getNotificationState: db.prepare('SELECT entry_id, due_at, sent_at, updated_at FROM notification_state WHERE entry_id = ?'),
    upsertNotificationState: db.prepare(`
      INSERT INTO notification_state (entry_id, due_at, sent_at, updated_at)
      VALUES (@entry_id, @due_at, @sent_at, @updated_at)
      ON CONFLICT(entry_id) DO UPDATE SET
        due_at = excluded.due_at,
        sent_at = COALESCE(notification_state.sent_at, excluded.sent_at),
        updated_at = excluded.updated_at
    `),
    selectSetting: db.prepare('SELECT value FROM app_settings WHERE key = ?'),
    upsertSetting: db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `),
    selectDeletedItems: db.prepare('SELECT item_id, collection FROM deleted_items'),
    upsertDeletedItem: db.prepare(`
      INSERT INTO deleted_items (item_id, collection, deleted_at)
      VALUES (@item_id, @collection, @deleted_at)
      ON CONFLICT(item_id) DO UPDATE SET
        collection = excluded.collection,
        deleted_at = excluded.deleted_at
    `),
  }
}
