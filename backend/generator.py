from dataclasses import dataclass
from typing import List, Dict, Tuple, Any, Optional
import random
import math
from collections import defaultdict

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]
LAB_STARTS = [1, 3, 5, 7]  # 2-hour blocks: (1-2), (3-4), (5-6), (7-8)
BATCHES = ["B1", "B2", "B3", "B4"]


@dataclass
class LabConfig:
  lab_id: int
  lab_short: str
  teacher_name: str
  room_full: str
  room_short: str
  # per_batch: { "B1": {"teacher": "...", "roomFull": "...", "roomShort": "..."}, ... }
  per_batch: Optional[Dict[str, Dict[str, str]]] = None


@dataclass
class SubjectConfig:
  subject_id: int
  subject_short: str
  teacher_name: str
  room_code: str
  lectures_per_week: int


def make_batches(class_strength: int, batch_size: int = 20) -> List[str]:
  if class_strength <= 0:
    return ["B1", "B2", "B3", "B4"]
  n = max(1, math.ceil(class_strength / max(1, batch_size)))
  return [f"B{i}" for i in range(1, n + 1)]


def build_balanced_lab_slots() -> List[Tuple[str, int]]:
  slots: List[Tuple[str, int]] = []
  for start in LAB_STARTS:
    for day in DAYS:
      slots.append((day, start))
  return slots


def empty_grid() -> Dict[str, Dict[int, Any]]:
  return {d: {p: None for p in PERIODS} for d in DAYS}


def generate_labs_only_timetable(
  branch_name: str,
  labs: List[LabConfig],
  teacher_busy_global: Optional[set] = None,
  batches: Optional[List[str]] = None
) -> Dict[str, Any]:

  if teacher_busy_global is None:
    teacher_busy_global = set()

  batches = batches or BATCHES
  nb = len(batches)

  timetable = empty_grid()

  if not labs:
    return {"branch": branch_name, "timetable": timetable}

  m = len(labs)

  # ✅ KEY FIX:
  # If m < nb, you MUST schedule nb blocks, not m blocks,
  # otherwise every batch will lose one lab due to "FREE" slots.
  total_blocks_needed = max(m, nb)

  all_slots = build_balanced_lab_slots()
  random.shuffle(all_slots)

  placed_blocks = 0
  slot_idx = 0

  while placed_blocks < total_blocks_needed and slot_idx < len(all_slots):
    day, start = all_slots[slot_idx]
    slot_idx += 1
    end = start + 1

    batch_rows = []
    teachers_in_block = set()

    # ✅ Rotation + FREE logic that guarantees:
    # - each batch attends every lab at least once
    # - FREE still appears when labs < batches
    #
    # Case A: m < nb => use nb positions (some positions are FREE)
    # Case B: m >= nb => no FREE needed, rotate through m labs
    for b_index, batch in enumerate(batches):
      if m < nb:
        # positions 0..nb-1, labs occupy 0..m-1, rest FREE
        pos = (placed_blocks + b_index) % nb
        if pos < m:
          lab = labs[pos]
        else:
          lab = None
      else:
        # m >= nb: everyone gets a lab each block, rotate across m labs
        lab_idx = (placed_blocks + b_index) % m
        lab = labs[lab_idx]

      if lab is None:
        batch_rows.append({
          "batch": batch,
          "labShort": "FREE",
          "teacher": "",
          "roomShort": "",
          "roomFull": "",
        })
        continue

      override = (lab.per_batch or {}).get(batch)
      teacher = override["teacher"] if override else lab.teacher_name
      room_full = override["roomFull"] if override else lab.room_full
      room_short = override["roomShort"] if override else lab.room_short

      batch_rows.append({
        "batch": batch,
        "labShort": lab.lab_short,
        "teacher": teacher,
        "roomShort": room_short,
        "roomFull": room_full,
      })

      if teacher:
        teachers_in_block.add(teacher)

    # ✅ Teacher clash check (both hours)
    clash = any(
      (day, start, t) in teacher_busy_global or (day, end, t) in teacher_busy_global
      for t in teachers_in_block
    )
    if clash:
      continue

    block = {"type": "LAB_BLOCK", "start": start, "end": end, "batches": batch_rows}
    timetable[day][start] = block
    timetable[day][end] = {"type": "MERGED", "into": start}

    for t in teachers_in_block:
      teacher_busy_global.add((day, start, t))
      teacher_busy_global.add((day, end, t))

    placed_blocks += 1

  if placed_blocks < total_blocks_needed:
    raise ValueError(
      f"Could not place all lab blocks for {branch_name} due to teacher clashes. "
      f"Placed {placed_blocks}/{total_blocks_needed}."
    )

  return {"branch": branch_name, "timetable": timetable}


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
  candidates: List[Tuple[float, str, int]] = []

  for day in DAYS:
    for p in PERIODS:
      if tt[day][p] is not None:
        continue

      if (day, p, teacher) in teacher_busy_global:
        continue
      if (day, p, room) in room_busy_global:
        continue

      score = 0.0
      early_penalty = {1: 0, 2: 0.2, 3: 0.4, 4: 0.6, 5: 2.0, 6: 2.4, 7: 2.8, 8: 3.2}
      score += early_penalty.get(p, 3.0)

      score += 5 * subj_day_counts[subj_short].get(day, 0)

      if _adjacent_same_subject(tt, day, p, subj_short):
        score += 3

      score += 0.5 * _teacher_load_on_day(tt, day, teacher)

      score += random.random() * 0.05

      candidates.append((score, day, p))

  if not candidates:
    return None

  candidates.sort(key=lambda x: x[0])
  return (candidates[0][1], candidates[0][2])


def generate_full_timetable(
  branch_name: str,
  labs: List[LabConfig],
  subjects: List[SubjectConfig],
  teacher_busy_global: Optional[set] = None,
  room_busy_global: Optional[set] = None,
  batches: Optional[List[str]] = None
) -> Dict[str, Any]:

  if teacher_busy_global is None:
    teacher_busy_global = set()
  if room_busy_global is None:
    room_busy_global = set()

  if not labs:
    out = {"branch": branch_name, "timetable": empty_grid()}
  else:
    out = generate_labs_only_timetable(branch_name, labs, teacher_busy_global, batches=batches)

  tt = out["timetable"]

  # mark room busy for labs too
  for day in DAYS:
    for p in PERIODS:
      cell = tt[day][p]
      if cell and cell.get("type") == "LAB_BLOCK":
        start = int(cell.get("start", p))
        end = start + 1
        for row in cell["batches"]:
          t = row["teacher"]
          if t:
            teacher_busy_global.add((day, start, t))
            teacher_busy_global.add((day, end, t))
          r = row["roomFull"]
          if r:
            room_busy_global.add((day, start, r))
            room_busy_global.add((day, end, r))

  subj_day_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

  sessions: List[Tuple[str, str, str]] = []
  for subj in subjects:
    for _ in range(int(subj.lectures_per_week)):
      sessions.append((subj.subject_short, subj.teacher_name, subj.room_code))

  random.shuffle(sessions)

  for subj_short, teacher_name, room_code in sessions:
    slot = _choose_best_slot_for_lecture(
      tt, teacher_busy_global, room_busy_global,
      subj_short, teacher_name, room_code,
      subj_day_counts
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
          if not t:
            continue
          teacher_view.setdefault(t, {d: {pp: [] for pp in PERIODS} for d in DAYS})
          teacher_view[t][day][p].append({
            "branch": branch,
            "type": "LAB",
            "batch": row["batch"],
            "name": row["labShort"],
            "room": row["roomFull"],
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
          r = row["roomFull"]
          if not r:
            continue
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
