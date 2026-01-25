PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
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
