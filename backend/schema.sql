PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  short TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS lab_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  short TEXT NOT NULL
);

-- branch-specific lab configuration (teacher + room per lab per branch)
CREATE TABLE IF NOT EXISTS branch_labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL,
  lab_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  UNIQUE(branch_id, lab_id),
  FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY(lab_id) REFERENCES labs(id) ON DELETE CASCADE,
  FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY(room_id) REFERENCES lab_rooms(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS lecture_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  short TEXT NOT NULL
);

-- subject configuration per branch: weekly lectures + teacher + lecture room
CREATE TABLE IF NOT EXISTS branch_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  lecture_room_id INTEGER NOT NULL,
  lectures_per_week INTEGER NOT NULL DEFAULT 3,
  UNIQUE(branch_id, subject_id),
  FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY(lecture_room_id) REFERENCES lecture_rooms(id) ON DELETE CASCADE
);

-- NEW: batch-wise lab configuration (teacher + room per lab per branch per batch)
CREATE TABLE IF NOT EXISTS branch_lab_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL,
  lab_id INTEGER NOT NULL,
  batch TEXT NOT NULL,              -- e.g. "B1", "B2", ...
  teacher_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  UNIQUE(branch_id, lab_id, batch),
  FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY(lab_id) REFERENCES labs(id) ON DELETE CASCADE,
  FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY(room_id) REFERENCES lab_rooms(id) ON DELETE CASCADE
);
-- Global timetable settings (single row with id=1)
CREATE TABLE IF NOT EXISTS timetable_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  working_days_count INTEGER NOT NULL DEFAULT 5, -- 5 => Mon-Fri
  start_time TEXT NOT NULL DEFAULT '08:30',      -- HH:MM
  end_time TEXT NOT NULL DEFAULT '17:15',        -- HH:MM
  lunch_start TEXT NOT NULL DEFAULT '12:30',     -- HH:MM
  lunch_end TEXT NOT NULL DEFAULT '13:15',       -- HH:MM
  period_minutes INTEGER NOT NULL DEFAULT 60
);

INSERT OR IGNORE INTO timetable_settings (id) VALUES (1);

