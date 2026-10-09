import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { migrate } from './schema-v2.mjs';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function verifyPassword(password, hash) {
  const [salt, key] = hash.split(':');
  return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(password, salt, 64));
}
export function openDatabase(path = process.env.DB_PATH || './data/academytrack.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, reg_no TEXT UNIQUE COLLATE NOCASE, role TEXT NOT NULL CHECK(role IN ('student','lecturer')), approved INTEGER NOT NULL DEFAULT 0, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, lecturer_id INTEGER NOT NULL REFERENCES users(id), credits INTEGER NOT NULL DEFAULT 3);
    CREATE TABLE IF NOT EXISTS enrollments(student_id INTEGER REFERENCES users(id), course_id INTEGER REFERENCES courses(id), PRIMARY KEY(student_id,course_id));
    CREATE TABLE IF NOT EXISTS marks(student_id INTEGER REFERENCES users(id), course_id INTEGER REFERENCES courses(id), semester TEXT NOT NULL, score REAL NOT NULL CHECK(score>=0 AND score<=100), PRIMARY KEY(student_id,course_id,semester));
    CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id), course_id INTEGER NOT NULL REFERENCES courses(id), semester TEXT NOT NULL, remarks TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')), response TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    CREATE TABLE IF NOT EXISTS exams(id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, date TEXT NOT NULL, venue TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS fees(student_id INTEGER PRIMARY KEY REFERENCES users(id), total INTEGER NOT NULL, paid INTEGER NOT NULL, deadline TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
  `);
  migrate(db);
  return db;
}
export function grade(score) {
  if (score == null) return { letter: '—', points: null };
  return score >= 80 ? { letter: 'A', points: 4 } : score >= 75 ? { letter: 'B+', points: 3.5 } : score >= 65 ? { letter: 'B', points: 3 } : score >= 60 ? { letter: 'C+', points: 2.5 } : score >= 50 ? { letter: 'C', points: 2 } : score >= 40 ? { letter: 'D', points: 1 } : { letter: 'F', points: 0 };
}
