from dataclasses import dataclass
from typing import List, Dict, Tuple, Any, Optional
import random
from collections import defaultdict
from typing import List, Tuple

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

def _count_subject_on_day(tt, day: str, subj_short: str) -> int:
    c = 0
    for p in PERIODS:
        cell = tt[day].get(p)
        if cell and cell.get("type") == "LECTURE" and cell.get("subjectShort") == subj_short:
            c += 1
    return c

def _teacher_load_on_day(tt, day: str, teacher: str) -> int:
    c = 0
    for p in PERIODS:
        cell = tt[day].get(p)
        if not cell:
            continue
        if cell.get("type") == "LECTURE" and cell.get("teacher") == teacher:
            c += 1
        if cell.get("type") == "LAB_BLOCK":
            for row in cell.get("batches", []):
                if row.get("teacher") == teacher:
                    c += 1
    return c

def _adjacent_same_subject(tt, day: str, p: int, subj_short: str) -> bool:
    for neighbor in (p - 1, p + 1):
        if neighbor in tt[day]:
            cell = tt[day].get(neighbor)
            if cell and cell.get("type") == "LECTURE" and cell.get("subjectShort") == subj_short:
                return True
    return False

def _choose_best_slot_for_lecture(
    tt,
    teacher_busy_global: set,
    room_busy_global: set,
    subj_short: str,
    teacher: str,
    room: str,
    subj_day_counts: Dict[str, Dict[str, int]],
) -> Optional[Tuple[str, int]]:
    """
    Returns (day, period) for best slot; None if impossible.
    Lower score = better.
    """
    candidates: List[Tuple[float, str, int]] = []

    # iterate all free slots and score them
    for day in DAYS:
        for p in PERIODS:
            if tt[day][p] is not None:
                continue

            # hard constraints (global)
            if (day, p, teacher) in teacher_busy_global:
                continue
            if (day, p, room) in room_busy_global:
                continue

            score = 0.0
            # ✅ Prefer early periods strongly (fills 1-4 first)
# p=1 lowest penalty, p=8 highest penalty
            early_penalty = {1: 0, 2: 0.2, 3: 0.4, 4: 0.6, 5: 2.0, 6: 2.4, 7: 2.8, 8: 3.2}
            score += early_penalty.get(p, 3.0)


            # Spread subject across days (strong)
            score += 5 * subj_day_counts[subj_short].get(day, 0)

            # Avoid adjacent same subject
            if _adjacent_same_subject(tt, day, p, subj_short):
                score += 3

            # Mildly balance teacher daily load
            score += 0.5 * _teacher_load_on_day(tt, day, teacher)

            # Small random jitter to avoid identical weekly patterns
            score += random.random() * 0.05

            candidates.append((score, day, p))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0])
    return (candidates[0][1], candidates[0][2])
def build_lecture_candidates(tt) -> List[Tuple[str, int]]:
    """
    Returns lecture slots in a "early-first but randomized" order:
    - First try periods 1-4 (randomized)
    - Then try periods 5-8 (randomized)
    - Days are also randomized inside a balanced pattern
    """
    day_order = ["Monday", "Wednesday", "Friday", "Tuesday", "Thursday"]
    # randomize day order slightly so it doesn't look same every run
    day_order = random.sample(day_order, k=len(day_order))

    early = [1, 2, 3, 4]
    late = [5, 6, 7, 8]

    random.shuffle(early)
    random.shuffle(late)

    candidates: List[Tuple[str, int]] = []

    # early slots first across days
    for d in day_order:
        for p in early:
            if tt[d][p] is None:
                candidates.append((d, p))

    # then late slots
    for d in day_order:
        for p in late:
            if tt[d][p] is None:
                candidates.append((d, p))

    return candidates

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
        # -----------------------------
    # Lectures: randomized + balanced distribution
    # -----------------------------
    # Track how many times each subject already placed per day
    subj_day_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    # Build list of individual lecture sessions
    sessions: List[Tuple[str, str, str]] = []
    for subj in subjects:
        for _ in range(int(subj.lectures_per_week)):
            sessions.append((subj.subject_short, subj.teacher_name, subj.room_code))

    # Shuffle so the order doesn't look the same every time
    random.shuffle(sessions)

    for subj_short, teacher_name, room_code in sessions:
        slot = _choose_best_slot_for_lecture(
            tt,
            teacher_busy_global,
            room_busy_global,
            subj_short,
            teacher_name,
            room_code,
            subj_day_counts,
        )
        if slot is None:
            raise ValueError(f"Could not place all lectures (stuck) for {subj_short} in {branch_name}.")

        day, p = slot

        tt[day][p] = {
            "type": "LECTURE",
            "subjectShort": subj_short,
            "teacher": teacher_name,
            "room": room_code,
        }
        teacher_busy_global.add((day, p, teacher_name))
        room_busy_global.add((day, p, room_code))
        subj_day_counts[subj_short][day] += 1

           

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
