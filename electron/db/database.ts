import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import schemaSql from '../../db/schema.sql?raw'
import { seedIfEmpty, updateSeedSinhalaNames } from './seed'

export type Db = Database.Database

export function resolveDbPath(userDataDir: string): string {
  const override = process.env.POS_DB_PATH
  if (override && override.trim().length > 0) {
    return path.resolve(override)
  }
  return path.join(userDataDir, 'pos.db')
}

export function openDatabase(dbPath: string): Db {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  db.exec(schemaSql)

  // Migration for existing tables:
  try {
    db.exec('ALTER TABLE products ADD COLUMN name_si TEXT')
  } catch {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE sale_items ADD COLUMN name_si_snapshot TEXT')
  } catch {
    // Column already exists
  }
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_products_name_si ON products(name_si) WHERE name_si IS NOT NULL')
  } catch {
    // Index exists
  }

  db.prepare(
    `INSERT INTO schema_meta (key, value) VALUES ('schema_version', '2')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run()

  seedIfEmpty(db)
  updateSeedSinhalaNames(db)
  return db
}

export function closeDatabase(db: Db | null): void {
  if (!db) return
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    // A checkpoint failure must not block shutdown.
  }
  db.close()
}
