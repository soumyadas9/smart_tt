from dataclasses import dataclass
from typing import List, Dict, Tuple, Any, Optional

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]
LAB_STARTS = [1, 3, 5, 7]  # 2-hour blocks: (1-2), (3-4), (5-6), (7-8)
BATCHES = ["B1", "B2", "B3", "B4"]

@dataclass
class LabConfig:
    lab_id: int
    lab_short: str
    teacher_name: str
    room_code: str

@dataclass
class SubjectConfig:
    subject_id: int
    subject_short: str
    teacher_name: str
    room_code: str
    lectures_per_week: int

def build_balanced_lab_slots() -> List[Tuple[str, int]]:
    # Spread labs across the week: Mon-..-Fri for slot 1, then slot 3, etc.
    slots: List[Tuple[str, int]] = []
    for start in LAB_STARTS:
        for day in DAYS:
            slots.append((day, start))
    return slots  # 20 total

def empty_grid() -> Dict[str, Dict[int, Any]]:
    return {d: {p: None for p in PERIODS} for d in DAYS}

def generate_labs_only_timetable(branch_name: str, labs: List[LabConfig]) -> Dict[str, Any]:
    if len(labs) < 4:
        raise ValueError("Need at least 4 labs to run parallel lab blocks for 4 batches.")

    m = len(labs)
    all_slots = build_balanced_lab_slots()
    if m > len(all_slots):
        raise ValueError("Too many labs for available lab blocks in the week.")

    timetable = empty_grid()
    session_slots = all_slots[:m]

    for i, (day, start) in enumerate(session_slots):
        end = start + 1
        batch_rows = []
        used = set()

        for b_index, batch in enumerate(BATCHES):
            lab = labs[(i + b_index) % m]
            if lab.lab_id in used:
                raise RuntimeError("Internal assignment collision (should not happen).")
            used.add(lab.lab_id)

            batch_rows.append({
                "batch": batch,
                "labShort": lab.lab_short,
                "teacher": lab.teacher_name,
                "room": lab.room_code,
            })

        block = {"type": "LAB_BLOCK", "start": start, "end": end, "batches": batch_rows}
        timetable[day][start] = block
        timetable[day][end] = {"type": "MERGED", "into": start}

    return {"branch": branch_name, "timetable": timetable}

def generate_full_timetable(
    branch_name: str,
    labs: List[LabConfig],
    subjects: List[SubjectConfig],
    teacher_busy_global: Optional[set] = None,
    room_busy_global: Optional[set] = None,
) -> Dict[str, Any]:
    """
    Places labs first (2h), then lectures (1h) in empty slots.
    Enforces teacher+room not double-booked using global busy sets.
    """
    teacher_busy_global = teacher_busy_global or set()
    room_busy_global = room_busy_global or set()

    # If no labs configured, start with empty grid and place only lectures
    if not labs:
     out = {"branch": branch_name, "timetable": empty_grid()}
    else:
     out = generate_labs_only_timetable(branch_name, labs)

    tt = out["timetable"]


    # Mark global busy from labs we placed
    for day in DAYS:
        for p in PERIODS:
            cell = tt[day][p]
            if cell and cell.get("type") == "LAB_BLOCK":
                for row in cell["batches"]:
                    teacher_busy_global.add((day, p, row["teacher"]))
                    room_busy_global.add((day, p, row["room"]))

    # Balanced lecture distribution across week
    day_cycle = ["Monday", "Wednesday", "Friday", "Tuesday", "Thursday"]

    for subj in subjects:
        remaining = int(subj.lectures_per_week)
        di = 0

        while remaining > 0:
            day = day_cycle[di % len(day_cycle)]
            di += 1

            placed = False
            for p in PERIODS:
                # skip occupied
                if tt[day][p] is not None:
                    continue

                # hard constraints globally
                if (day, p, subj.teacher_name) in teacher_busy_global:
                    continue
                if (day, p, subj.room_code) in room_busy_global:
                    continue

                tt[day][p] = {
                    "type": "LECTURE",
                    "subjectShort": subj.subject_short,
                    "teacher": subj.teacher_name,
                    "room": subj.room_code,
                }
                teacher_busy_global.add((day, p, subj.teacher_name))
                room_busy_global.add((day, p, subj.room_code))
                remaining -= 1
                placed = True
                break

            if not placed:
                raise ValueError(f"Could not place all lectures for {subj.subject_short} in {branch_name}.")

    return out

def build_teacher_view(branch_output: Dict[str, Any]) -> Dict[str, Any]:
    teacher_view: Dict[str, Dict[str, Dict[int, List[Dict[str, Any]]]]] = {}
    branch = branch_output["branch"]
    tt = branch_output["timetable"]

    for day in DAYS:
        for p in PERIODS:
            cell = tt[day][p]
            if not cell:
                continue

            if cell.get("type") == "LAB_BLOCK":
                for row in cell["batches"]:
                    t = row["teacher"]
                    teacher_view.setdefault(t, {d: {pp: [] for pp in PERIODS} for d in DAYS})
                    teacher_view[t][day][p].append({
                        "branch": branch,
                        "type": "LAB",
                        "batch": row["batch"],
                        "name": row["labShort"],
                        "room": row["room"],
                    })

            elif cell.get("type") == "LECTURE":
                t = cell["teacher"]
                teacher_view.setdefault(t, {d: {pp: [] for pp in PERIODS} for d in DAYS})
                teacher_view[t][day][p].append({
                    "branch": branch,
                    "type": "LECTURE",
                    "name": cell["subjectShort"],
                    "room": cell["room"],
                })

    return {"teachers": teacher_view}

def build_room_view(branch_output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Includes both lab rooms and lecture rooms under the same map key = room_code
    """
    room_view: Dict[str, Dict[str, Dict[int, List[Dict[str, Any]]]]] = {}
    branch = branch_output["branch"]
    tt = branch_output["timetable"]

    for day in DAYS:
        for p in PERIODS:
            cell = tt[day][p]
            if not cell:
                continue

            if cell.get("type") == "LAB_BLOCK":
                for row in cell["batches"]:
                    r = row["room"]
                    room_view.setdefault(r, {d: {pp: [] for pp in PERIODS} for d in DAYS})
                    room_view[r][day][p].append({
                        "branch": branch,
                        "type": "LAB",
                        "batch": row["batch"],
                        "name": row["labShort"],
                        "teacher": row["teacher"],
                    })

            elif cell.get("type") == "LECTURE":
                r = cell["room"]
                room_view.setdefault(r, {d: {pp: [] for pp in PERIODS} for d in DAYS})
                room_view[r][day][p].append({
                    "branch": branch,
                    "type": "LECTURE",
                    "name": cell["subjectShort"],
                    "teacher": cell["teacher"],
                })

    return {"rooms": room_view}
