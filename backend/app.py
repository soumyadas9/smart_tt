from flask import Flask, request, jsonify
from flask_cors import CORS

from db import init_db, get_conn
from generator import (
  generate_labs_only_timetable,
  generate_full_timetable,
  build_teacher_view,
  build_room_view,
  LabConfig,
  SubjectConfig,
  make_batches
)

app = Flask(__name__)
CORS(app)
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

@app.get("/")
def home():
  return {"message": "Backend running. Try /health, /branches, /labs, /teachers, /rooms"}

@app.get("/health")
def health():
  return {"ok": True}

@app.post("/init")
def init():
  init_db()
  return {"ok": True}

# ----------------------------
# Lecture Rooms
# ----------------------------
@app.get("/lecture-rooms")
def lecture_rooms():
  with get_conn() as conn:
    rows = conn.execute("SELECT id, code FROM lecture_rooms ORDER BY code").fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/lecture-rooms")
def create_lecture_room():
  data = request.json
  code = data.get("code","").strip()
  if not code:
    return {"error": "Room code required"}, 400
  with get_conn() as conn:
    conn.execute("INSERT OR IGNORE INTO lecture_rooms (code) VALUES (?)", (code,))
    conn.commit()
  return {"ok": True}

@app.delete("/lecture-rooms/<int:lecture_room_id>")
def delete_lecture_room(lecture_room_id: int):
  with get_conn() as conn:
    conn.execute("DELETE FROM lecture_rooms WHERE id=?", (lecture_room_id,))
    conn.commit()
  return {"ok": True}

# ----------------------------
# Subjects
# ----------------------------
@app.get("/subjects")
def subjects():
  with get_conn() as conn:
    rows = conn.execute("SELECT id, name, short FROM subjects ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/subjects")
def create_subject():
  data = request.json
  name = data.get("name","").strip()
  short = data.get("short","").strip()
  if not name or not short:
    return {"error": "Subject name and short required"}, 400
  with get_conn() as conn:
    conn.execute("INSERT OR IGNORE INTO subjects (name, short) VALUES (?,?)", (name, short))
    conn.commit()
  return {"ok": True}

@app.delete("/subjects/<int:subject_id>")
def delete_subject(subject_id: int):
  with get_conn() as conn:
    conn.execute("DELETE FROM subjects WHERE id=?", (subject_id,))
    conn.commit()
  return {"ok": True}

# ----------------------------
# Branch Subjects
# ----------------------------
@app.get("/branch-subjects/<int:branch_id>")
def get_branch_subjects(branch_id: int):
  with get_conn() as conn:
    rows = conn.execute("""
      SELECT bs.id, s.id AS subject_id, s.name AS subject_name, s.short AS subject_short,
             t.id AS teacher_id, t.name AS teacher_name,
             lr.id AS lecture_room_id, lr.code AS lecture_room_code,
             bs.lectures_per_week
      FROM branch_subjects bs
      JOIN subjects s ON s.id = bs.subject_id
      JOIN teachers t ON t.id = bs.teacher_id
      JOIN lecture_rooms lr ON lr.id = bs.lecture_room_id
      WHERE bs.branch_id = ?
      ORDER BY s.name
    """, (branch_id,)).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/branch-subjects")
def upsert_branch_subject():
  data = request.json
  branch_id = data.get("branchId")
  subject_id = data.get("subjectId")
  teacher_id = data.get("teacherId")
  lecture_room_id = data.get("lectureRoomId")
  lectures_per_week = int(data.get("lecturesPerWeek", 3))

  if not all([branch_id, subject_id, teacher_id, lecture_room_id]):
    return {"error": "branchId, subjectId, teacherId, lectureRoomId required"}, 400

  with get_conn() as conn:
    conn.execute("""
      INSERT OR REPLACE INTO branch_subjects
      (branch_id, subject_id, teacher_id, lecture_room_id, lectures_per_week)
      VALUES (?,?,?,?,?)
    """, (branch_id, subject_id, teacher_id, lecture_room_id, lectures_per_week))
    conn.commit()
  return {"ok": True}

@app.delete("/branch-subjects")
def delete_branch_subject():
  data = request.get_json(force=True)
  branch_id = int(data["branchId"])
  subject_id = int(data["subjectId"])
  with get_conn() as conn:
    conn.execute("DELETE FROM branch_subjects WHERE branch_id=? AND subject_id=?", (branch_id, subject_id))
    conn.commit()
  return {"ok": True}

# ----------------------------
# Branches
# ----------------------------
@app.get("/branches")
def branches():
  with get_conn() as conn:
    rows = conn.execute("SELECT id, name FROM branches ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/branches")
def create_branch():
  data = request.json
  name = data.get("name", "").strip()
  if not name:
    return {"error": "Branch name required"}, 400
  with get_conn() as conn:
    conn.execute("INSERT OR IGNORE INTO branches (name) VALUES (?)", (name,))
    conn.commit()
  return {"ok": True}

@app.delete("/branches/<int:branch_id>")
def delete_branch(branch_id: int):
  with get_conn() as conn:
    conn.execute("DELETE FROM branches WHERE id=?", (branch_id,))
    conn.commit()
  return {"ok": True}

# ----------------------------
# Labs
# ----------------------------
@app.get("/labs")
def labs():
  with get_conn() as conn:
    rows = conn.execute("SELECT id, name, short FROM labs ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/labs")
def create_lab():
  data = request.json
  name = data.get("name","").strip()
  short = data.get("short","").strip()
  if not name or not short:
    return {"error": "Lab name and short required"}, 400
  with get_conn() as conn:
    conn.execute("INSERT OR IGNORE INTO labs (name, short) VALUES (?,?)", (name, short))
    conn.commit()
  return {"ok": True}

@app.delete("/labs/<int:lab_id>")
def delete_lab(lab_id: int):
  with get_conn() as conn:
    conn.execute("DELETE FROM labs WHERE id=?", (lab_id,))
    conn.commit()
  return {"ok": True}

# ----------------------------
# Teachers
# ----------------------------
@app.get("/teachers")
def teachers():
  with get_conn() as conn:
    rows = conn.execute("SELECT id, name FROM teachers ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/teachers")
def create_teacher():
  data = request.json
  name = data.get("name","").strip()
  if not name:
    return {"error": "Teacher name required"}, 400
  with get_conn() as conn:
    conn.execute("INSERT OR IGNORE INTO teachers (name) VALUES (?)", (name,))
    conn.commit()
  return {"ok": True}

@app.delete("/teachers/<int:teacher_id>")
def delete_teacher(teacher_id: int):
  with get_conn() as conn:
    conn.execute("DELETE FROM teachers WHERE id=?", (teacher_id,))
    conn.commit()
  return {"ok": True}

# ----------------------------
# Lab Rooms
# ----------------------------
@app.get("/rooms")
def rooms():
  with get_conn() as conn:
    rows = conn.execute("SELECT id, code, short FROM lab_rooms ORDER BY code").fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/rooms")
def create_room():
  data = request.json
  code = data.get("code", "").strip()
  short = (data.get("short", "") or "").strip()

  if not code:
    return {"error": "Room code required"}, 400
  if not short:
    short = code

  with get_conn() as conn:
    conn.execute("INSERT OR IGNORE INTO lab_rooms (code, short) VALUES (?, ?)", (code, short))
    conn.commit()
  return {"ok": True}

@app.delete("/rooms/<int:room_id>")
def delete_room(room_id: int):
  with get_conn() as conn:
    conn.execute("DELETE FROM lab_rooms WHERE id=?", (room_id,))
    conn.commit()
  return {"ok": True}

# ----------------------------
# Branch Labs
# ----------------------------
@app.get("/branch-labs/<int:branch_id>")
def get_branch_labs(branch_id: int):
  with get_conn() as conn:
    rows = conn.execute("""
      SELECT bl.id, l.id AS lab_id, l.name AS lab_name, l.short AS lab_short,
             t.id AS teacher_id, t.name AS teacher_name,
             r.id AS room_id, r.code AS room_full, r.short AS room_short
      FROM branch_labs bl
      JOIN labs l ON l.id = bl.lab_id
      JOIN teachers t ON t.id = bl.teacher_id
      JOIN lab_rooms r ON r.id = bl.room_id
      WHERE bl.branch_id = ?
      ORDER BY l.name
    """, (branch_id,)).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/branch-labs")
def add_branch_lab():
  data = request.json
  branch_id = data.get("branchId")
  lab_id = data.get("labId")
  teacher_id = data.get("teacherId")
  room_id = data.get("roomId")
  if not all([branch_id, lab_id, teacher_id, room_id]):
    return {"error": "branchId, labId, teacherId, roomId required"}, 400
  with get_conn() as conn:
    conn.execute("""
      INSERT OR REPLACE INTO branch_labs (branch_id, lab_id, teacher_id, room_id)
      VALUES (?,?,?,?)
    """, (branch_id, lab_id, teacher_id, room_id))
    conn.commit()
  return {"ok": True}

@app.delete("/branch-labs")
def delete_branch_lab():
  data = request.get_json(force=True)
  branch_id = int(data["branchId"])
  lab_id = int(data["labId"])
  with get_conn() as conn:
    conn.execute("DELETE FROM branch_labs WHERE branch_id=? AND lab_id=?", (branch_id, lab_id))
    conn.commit()
  return {"ok": True}

# ----------------------------
# Generate Labs Only
# ----------------------------
@app.post("/generate/labs-only")
def generate_labs_only():
  data = request.json
  branch_ids = data.get("branchIds", [])
  if not branch_ids:
    return {"error": "branchIds required"}, 400

  outputs = []
  teachers_accum = {}
  rooms_accum = {}

  with get_conn() as conn:
    for bid in branch_ids:
      b = conn.execute("SELECT id, name FROM branches WHERE id=?", (bid,)).fetchone()
      if not b:
        return {"error": f"Branch not found: {bid}"}, 404

      rows = conn.execute("""
        SELECT l.id AS lab_id, l.short AS lab_short,
               t.name AS teacher_name,
               r.code AS room_full, r.short AS room_short
        FROM branch_labs bl
        JOIN labs l ON l.id = bl.lab_id
        JOIN teachers t ON t.id = bl.teacher_id
        JOIN lab_rooms r ON r.id = bl.room_id
        WHERE bl.branch_id = ?
        ORDER BY l.name
      """, (bid,)).fetchall()

      labs_cfg = [LabConfig(
        lab_id=r["lab_id"],
        lab_short=r["lab_short"],
        teacher_name=r["teacher_name"],
        room_full=r["room_full"],
        room_short=(r["room_short"] or r["room_full"]),
      ) for r in rows]

      branch_output = generate_labs_only_timetable(b["name"], labs_cfg)
      outputs.append(branch_output)

      tv = build_teacher_view(branch_output)["teachers"]
      rv = build_room_view(branch_output)["rooms"]

      for tname, grid in tv.items():
        teachers_accum.setdefault(tname, grid)
        for day in grid:
          for p in grid[day]:
            teachers_accum[tname][day][p] += grid[day][p]

      for rcode, grid in rv.items():
        rooms_accum.setdefault(rcode, grid)
        for day in grid:
          for p in grid[day]:
            rooms_accum[rcode][day][p] += grid[day][p]

  return jsonify({"branches": outputs, "teacherView": teachers_accum, "roomView": rooms_accum})

# ----------------------------
# Generate Full
# ----------------------------
@app.post("/generate/full")
def generate_full():
  data = request.json
  branch_ids = data.get("branchIds", [])
  class_strength = int(data.get("classStrength", 80))
  batch_size = int(data.get("batchSize", 20))
  batches = make_batches(class_strength, batch_size)

  if not branch_ids:
    return {"error": "branchIds required"}, 400

  outputs = []
  teachers_accum = {}
  rooms_accum = {}

  teacher_busy_global = set()  # (day, period, teacher_name)
  room_busy_global = set()     # (day, period, room_code)

  with get_conn() as conn:
    for bid in branch_ids:
      b = conn.execute("SELECT id, name FROM branches WHERE id=?", (bid,)).fetchone()
      if not b:
        return {"error": f"Branch not found: {bid}"}, 404

      lab_rows = conn.execute("""
        SELECT l.id AS lab_id, l.short AS lab_short,
               t.name AS teacher_name,
               r.code AS room_full, r.short AS room_short
        FROM branch_labs bl
        JOIN labs l ON l.id = bl.lab_id
        JOIN teachers t ON t.id = bl.teacher_id
        JOIN lab_rooms r ON r.id = bl.room_id
        WHERE bl.branch_id = ?
        ORDER BY l.name
      """, (bid,)).fetchall()

      labs_cfg = [LabConfig(
        lab_id=r["lab_id"],
        lab_short=r["lab_short"],
        teacher_name=r["teacher_name"],
        room_full=r["room_full"],
        room_short=(r["room_short"] or r["room_full"]),
      ) for r in lab_rows]

      subj_rows = conn.execute("""
        SELECT s.id AS subject_id, s.short AS subject_short,
               t.name AS teacher_name,
               lr.code AS room_code,
               bs.lectures_per_week
        FROM branch_subjects bs
        JOIN subjects s ON s.id = bs.subject_id
        JOIN teachers t ON t.id = bs.teacher_id
        JOIN lecture_rooms lr ON lr.id = bs.lecture_room_id
        WHERE bs.branch_id = ?
        ORDER BY s.name
      """, (bid,)).fetchall()

      subjects_cfg = [SubjectConfig(
        subject_id=r["subject_id"],
        subject_short=r["subject_short"],
        teacher_name=r["teacher_name"],
        room_code=r["room_code"],
        lectures_per_week=r["lectures_per_week"]
      ) for r in subj_rows]

      try:
        branch_output = generate_full_timetable(
          b["name"], labs_cfg, subjects_cfg,
          teacher_busy_global=teacher_busy_global,
          room_busy_global=room_busy_global,
          batches=batches
        )
      except ValueError as e:
        return jsonify({"error": str(e), "branch": b["name"]}), 400

      outputs.append(branch_output)

      tv = build_teacher_view(branch_output)["teachers"]
      rv = build_room_view(branch_output)["rooms"]

      for tname, grid in tv.items():
        teachers_accum.setdefault(tname, {d: {pp: [] for pp in range(1,9)} for d in DAYS})
        for day in grid:
          for p in grid[day]:
            teachers_accum[tname][day][p] += grid[day][p]

      for rcode, grid in rv.items():
        rooms_accum.setdefault(rcode, {d: {pp: [] for pp in range(1,9)} for d in DAYS})
        for day in grid:
          for p in grid[day]:
            rooms_accum[rcode][day][p] += grid[day][p]

  return jsonify({"branches": outputs, "teacherView": teachers_accum, "roomView": rooms_accum})

if __name__ == "__main__":
  init_db()
  app.run(port=5000, debug=True)
