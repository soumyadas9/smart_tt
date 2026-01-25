from db import init_db, get_conn

def upsert(conn, table, col, value):
    row = conn.execute(f"SELECT id FROM {table} WHERE {col}=?", (value,)).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(f"INSERT INTO {table} ({col}) VALUES (?)", (value,))
    return cur.lastrowid

def upsert2(conn, table, col1, val1, col2, val2):
    row = conn.execute(
        f"SELECT id FROM {table} WHERE {col1}=? AND {col2}=?",
        (val1, val2)
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        f"INSERT INTO {table} ({col1}, {col2}) VALUES (?,?)",
        (val1, val2)
    )
    return cur.lastrowid

def run_seed():
    init_db()
    with get_conn() as conn:
        # branches
        b_it1 = upsert(conn, "branches", "name", "IT1")
        b_cst2 = upsert(conn, "branches", "name", "CST2")

        # labs (name, short)
        labs = [
            ("Engineering Physics Lab", "EP Lab"),
            ("Basic Electrical Engineering Lab", "BEE Lab"),
            ("Internet & Web Programming Lab", "IWP Lab"),
            ("Engineering Graphics & Design Lab", "EGD Lab"),
            ("Electronics & Circuits Lab", "EC Lab"),
        ]
        lab_ids = []
        for name, short in labs:
            row = conn.execute("SELECT id FROM labs WHERE name=?", (name,)).fetchone()
            if row:
                lab_id = row["id"]
            else:
                lab_id = conn.execute(
                    "INSERT INTO labs (name, short) VALUES (?,?)",
                    (name, short),
                ).lastrowid
            lab_ids.append(lab_id)

        # teachers (ensure these exist)
        t_patil  = upsert(conn, "teachers", "name", "Prof. Patil")
        t_sharma = upsert(conn, "teachers", "name", "Prof. Sharma")
        t_khan   = upsert(conn, "teachers", "name", "Prof. Khan")
        t_iyer   = upsert(conn, "teachers", "name", "Prof. Iyer")
        t_mehta  = upsert(conn, "teachers", "name", "Prof. Mehta")
        teacher_ids = [t_patil, t_sharma, t_khan, t_iyer, t_mehta]

        # lab rooms
        r1 = upsert(conn, "lab_rooms", "code", "L1")
        r2 = upsert(conn, "lab_rooms", "code", "L2")
        r3 = upsert(conn, "lab_rooms", "code", "L3")
        r4 = upsert(conn, "lab_rooms", "code", "L4")
        r5 = upsert(conn, "lab_rooms", "code", "L5")
        room_ids = [r1, r2, r3, r4, r5]

        # map labs to IT1 (rotation A)
        for i, lab_id in enumerate(lab_ids):
            teacher_id = teacher_ids[i % len(teacher_ids)]
            room_id = room_ids[i % len(room_ids)]
            conn.execute(
                "INSERT OR REPLACE INTO branch_labs (branch_id, lab_id, teacher_id, room_id) VALUES (?,?,?,?)",
                (b_it1, lab_id, teacher_id, room_id),
            )

        # map labs to CST2 (rotation B, shifted so different)
        for i, lab_id in enumerate(lab_ids):
            teacher_id = teacher_ids[(i + 2) % len(teacher_ids)]
            room_id = room_ids[(i + 1) % len(room_ids)]
            conn.execute(
                "INSERT OR REPLACE INTO branch_labs (branch_id, lab_id, teacher_id, room_id) VALUES (?,?,?,?)",
                (b_cst2, lab_id, teacher_id, room_id),
            )

        # ---------- DEMO SUBJECTS ----------
        subjects = [
            ("Basic Electronics", "BEE"),
            ("Engineering Graphics & Design", "EGD"),
            ("Mathematics - I", "M-I"),
            ("Teacher Communication - I", "TC-I"),
            ("Internet & Web Programming", "IWP"),
            ("Engineering Physics", "EP"),
            ("Introduction to DC", "IDPC"),
        ]
        for name, short in subjects:
            row = conn.execute("SELECT id FROM subjects WHERE name=?", (name,)).fetchone()
            if not row:
                conn.execute("INSERT INTO subjects (name, short) VALUES (?,?)", (name, short))

        # lecture rooms
        lr101 = upsert(conn, "lecture_rooms", "code", "R101")
        lr102 = upsert(conn, "lecture_rooms", "code", "R102")

        # helper to map subjects to branches
        def map_subject(branch_id, subject_short, teacher_id, lecture_room_id, lpw):
            sid = conn.execute("SELECT id FROM subjects WHERE short=?", (subject_short,)).fetchone()["id"]
            conn.execute("""
                INSERT OR REPLACE INTO branch_subjects
                (branch_id, subject_id, teacher_id, lecture_room_id, lectures_per_week)
                VALUES (?,?,?,?,?)
            """, (branch_id, sid, teacher_id, lecture_room_id, lpw))

        # IT1 lecture mapping
        map_subject(b_it1, "M-I",  t_khan,  lr101, 3)
        map_subject(b_it1, "BEE",  t_iyer,  lr102, 2)
        map_subject(b_it1, "IWP",  t_patil, lr101, 3)
        map_subject(b_it1, "EP",   t_sharma,lr102, 2)
        map_subject(b_it1, "TC-I", t_mehta, lr101, 2)

        # CST2 lecture mapping (different so timetable differs)
        map_subject(b_cst2, "M-I",  t_khan,  lr102, 3)
        map_subject(b_cst2, "BEE",  t_iyer,  lr101, 2)
        map_subject(b_cst2, "EGD",  t_sharma,lr102, 2)
        map_subject(b_cst2, "TC-I", t_mehta, lr101, 2)
        map_subject(b_cst2, "IDPC", t_patil, lr101, 2)

        conn.commit()

    print("Seeded DB successfully (branches, labs, subjects, mappings).")

if __name__ == "__main__":
    run_seed()
