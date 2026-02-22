from dataclasses import dataclass
from typing import List, Dict, Tuple, Any, Optional
import random
import math
from collections import defaultdict

# Default fallbacks (same behavior as before)
DEFAULT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
DEFAULT_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]
DEFAULT_LAB_STARTS = [1, 3, 5, 7]
BATCHES = ["B1", "B2", "B3", "B4"]


@dataclass
class LabConfig:
  lab_id: int
  lab_short: str
  teacher_name: str
  room_full: str
  room_short: str
  # per_batch: { "B1": {"teacher": "...", "roomFull": "...", "roomShort": "...", "teacherShort": "..."}, ... }
  per_batch: Optional[Dict[str, Dict[str, str]]] = None


@dataclass
class SubjectConfig:
  subject_id: int
  subject_short: str
  subject_name: str  # ✅ ADDED (needed for footer "SHORT : Full Name")
  teacher_name: str
  room_code: str
  lectures_per_week: int


# ----------------------------
# Schedule helpers (dynamic days/periods/lunch)
# ----------------------------
def _hm_to_min(hm: str) -> int:
  h, m = hm.split(":")
  return int(h) * 60 + int(m)


def _min_to_hm(x: int) -> str:
  h = x // 60
  m = x % 60
  return f"{h:02d}:{m:02d}"


def build_schedule(settings: dict) -> dict:
  """
  Builds timetable schedule config from settings.
  Defaults match your current UI:
  - Mon-Fri
  - Start 08:30
  - Lunch 12:30-13:15
  - End 17:15
  - Period length 60 minutes
  """
  working_days_count = int(settings.get("workingDaysCount", 5))
  start_time = settings.get("startTime", "08:30")
  end_time = settings.get("endTime", "17:15")
  lunch_start = settings.get("lunchStart", "12:30")
  lunch_end = settings.get("lunchEnd", "13:15")
  period_minutes = int(settings.get("periodMinutes", 60))

  all_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  days = all_days[:max(1, min(working_days_count, 7))]

  s = _hm_to_min(start_time)
  e = _hm_to_min(end_time)
  ls = _hm_to_min(lunch_start)
  le = _hm_to_min(lunch_end)

  if not (s < ls < le < e):
    raise ValueError("Invalid timings: must satisfy start < lunchStart < lunchEnd < end")

  if (ls - s) % period_minutes != 0 or (e - le) % period_minutes != 0:
    raise ValueError("Timings must align with periodMinutes (default 60).")

  before = (ls - s) // period_minutes
  after = (e - le) // period_minutes

  if before < 1 or after < 1:
    raise ValueError("Need at least 1 period before and after lunch.")

  total = before + after
  periods = list(range(1, total + 1))
  lunch_after_period = before

  period_labels = []
  cur = s
  for i in range(1, before + 1):
    nxt = cur + period_minutes
    period_labels.append({"p": i, "label": str(i), "time": f"{_min_to_hm(cur)}-{_min_to_hm(nxt)}"})
    cur = nxt

  cur = le
  for i in range(before + 1, total + 1):
    nxt = cur + period_minutes
    period_labels.append({"p": i, "label": str(i), "time": f"{_min_to_hm(cur)}-{_min_to_hm(nxt)}"})
    cur = nxt

  lab_starts = []
  for p in periods:
    if p + 1 not in periods:
      continue
    if p == lunch_after_period:
      continue
    if p % 2 == 1:
      lab_starts.append(p)

  return {
    "days": days,
    "periods": periods,
    "lab_starts": lab_starts,
    "lunchAfterPeriod": lunch_after_period,
    "periodMinutes": period_minutes,
    "startTime": start_time,
    "endTime": end_time,
    "lunchStart": lunch_start,
    "lunchEnd": lunch_end,
    "periodLabels": period_labels,
  }


def _defaults_schedule() -> dict:
  return {
    "days": DEFAULT_DAYS,
    "periods": DEFAULT_PERIODS,
    "lab_starts": DEFAULT_LAB_STARTS,
    "lunchAfterPeriod": 4,
    "periodMinutes": 60,
    "startTime": "08:30",
    "endTime": "17:15",
    "lunchStart": "12:30",
    "lunchEnd": "13:15",
    "periodLabels": [
      {"p": 1, "label": "1", "time": "08:30-09:30"},
      {"p": 2, "label": "2", "time": "09:30-10:30"},
      {"p": 3, "label": "3", "time": "10:30-11:30"},
      {"p": 4, "label": "4", "time": "11:30-12:30"},
      {"p": 5, "label": "5", "time": "13:15-14:15"},
      {"p": 6, "label": "6", "time": "14:15-15:15"},
      {"p": 7, "label": "7", "time": "15:15-16:15"},
      {"p": 8, "label": "8", "time": "16:15-17:15"},
    ],
  }


# ----------------------------
# Existing logic (now schedule-aware)
# ----------------------------
def make_batches(class_strength: int, batch_size: int = 20) -> List[str]:
  if class_strength <= 0:
    return ["B1", "B2", "B3", "B4"]
  n = max(1, math.ceil(class_strength / max(1, batch_size)))
  return [f"B{i}" for i in range(1, n + 1)]


def build_balanced_lab_slots(days: List[str], lab_starts: List[int]) -> List[Tuple[str, int]]:
  slots: List[Tuple[str, int]] = []
  for start in lab_starts:
    for day in days:
      slots.append((day, start))
  return slots


def empty_grid(days: List[str], periods: List[int]) -> Dict[str, Dict[int, Any]]:
  return {d: {p: None for p in periods} for d in days}


def generate_labs_only_timetable(
  branch_name: str,
  labs: List[LabConfig],
  teacher_busy_global: Optional[set] = None,
  batches: Optional[List[str]] = None,
  schedule: Optional[dict] = None
) -> Dict[str, Any]:

  schedule = schedule or _defaults_schedule()
  days = schedule["days"]
  periods = schedule["periods"]
  lab_starts = schedule["lab_starts"]

  if teacher_busy_global is None:
    teacher_busy_global = set()

  batches = batches or BATCHES
  nb = len(batches)

  timetable = empty_grid(days, periods)

  if not labs:
    return {"branch": branch_name, "timetable": timetable, "meta": schedule}

  m = len(labs)
  total_blocks_needed = max(m, nb)

  all_slots = build_balanced_lab_slots(days, lab_starts)
  random.shuffle(all_slots)

  placed_blocks = 0
  slot_idx = 0

  while placed_blocks < total_blocks_needed and slot_idx < len(all_slots):
    day, start = all_slots[slot_idx]
    slot_idx += 1
    end = start + 1

    if end not in periods:
      continue

    batch_rows = []
    teachers_in_block = set()

    for b_index, batch in enumerate(batches):
      if m < nb:
        pos = (placed_blocks + b_index) % nb
        lab = labs[pos] if pos < m else None
      else:
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
        # NOTE: teacherShort is injected later in app.py (_inject_teacher_shorts),
        # but if you ever want per_batch teacherShort, app.py already stores it in per_batch_map.
      })

      if teacher:
        teachers_in_block.add(teacher)

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

  return {"branch": branch_name, "timetable": timetable, "meta": schedule}


def _teacher_load_on_day(tt, day: str, teacher: str, periods: List[int]) -> int:
  c = 0
  for p in periods:
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
  days: List[str],
  periods: List[int],
) -> Optional[Tuple[str, int]]:
  candidates: List[Tuple[float, str, int]] = []

  def early_penalty(p: int) -> float:
    if p <= 4:
      return 0.2 * (p - 1)
    return 0.6 + 0.4 * (p - 4)

  for day in days:
    for p in periods:
      if tt[day][p] is not None:
        continue

      if (day, p, teacher) in teacher_busy_global:
        continue
      if (day, p, room) in room_busy_global:
        continue

      score = 0.0
      score += early_penalty(p)
      score += 5 * subj_day_counts[subj_short].get(day, 0)

      if _adjacent_same_subject(tt, day, p, subj_short):
        score += 3

      score += 0.5 * _teacher_load_on_day(tt, day, teacher, periods)
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
  batches: Optional[List[str]] = None,
  schedule: Optional[dict] = None
) -> Dict[str, Any]:

  schedule = schedule or _defaults_schedule()
  days = schedule["days"]
  periods = schedule["periods"]

  if teacher_busy_global is None:
    teacher_busy_global = set()
  if room_busy_global is None:
    room_busy_global = set()

  if not labs:
    out = {"branch": branch_name, "timetable": empty_grid(days, periods), "meta": schedule}
  else:
    out = generate_labs_only_timetable(branch_name, labs, teacher_busy_global, batches=batches, schedule=schedule)

  tt = out["timetable"]

  # mark room busy for labs too
  for day in days:
    for p in periods:
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

  # ✅ include subject_name in sessions
  sessions: List[Tuple[str, str, str, str]] = []
  for subj in subjects:
    for _ in range(int(subj.lectures_per_week)):
      sessions.append((subj.subject_short, subj.subject_name, subj.teacher_name, subj.room_code))

  random.shuffle(sessions)

  for subj_short, subj_name, teacher_name, room_code in sessions:
    slot = _choose_best_slot_for_lecture(
      tt, teacher_busy_global, room_busy_global,
      subj_short, teacher_name, room_code,
      subj_day_counts,
      days=days,
      periods=periods
    )
    if slot is None:
      raise ValueError(f"Could not place all lectures (stuck) for {subj_short} in {branch_name}.")

    day, p = slot

    tt[day][p] = {
      "type": "LECTURE",
      "subjectShort": subj_short,
      "subjectName": subj_name,  # ✅ ADDED (for footer)
      "teacher": teacher_name,
      "room": room_code,
    }
    teacher_busy_global.add((day, p, teacher_name))
    room_busy_global.add((day, p, room_code))
    subj_day_counts[subj_short][day] += 1

  return out


def build_teacher_view(branch_output: Dict[str, Any]) -> Dict[str, Any]:
  meta = branch_output.get("meta") or _defaults_schedule()
  days = meta["days"]
  periods = meta["periods"]

  teacher_view: Dict[str, Dict[str, Dict[int, List[Dict[str, Any]]]]] = {}
  branch = branch_output["branch"]
  tt = branch_output["timetable"]

  for day in days:
    for p in periods:
      cell = tt[day][p]
      if not cell:
        continue

      if cell.get("type") == "LAB_BLOCK":
        for row in cell["batches"]:
          t = row["teacher"]
          if not t:
            continue
          teacher_view.setdefault(t, {d: {pp: [] for pp in periods} for d in days})
          teacher_view[t][day][p].append({
            "branch": branch,
            "type": "LAB",
            "batch": row["batch"],
            "name": row["labShort"],
            "room": row["roomFull"],
          })

      elif cell.get("type") == "LECTURE":
        t = cell["teacher"]
        teacher_view.setdefault(t, {d: {pp: [] for pp in periods} for d in days})
        teacher_view[t][day][p].append({
          "branch": branch,
          "type": "LECTURE",
          "name": cell["subjectShort"],
          "room": cell["room"],
        })

  return {"teachers": teacher_view, "meta": meta}


def build_room_view(branch_output: Dict[str, Any]) -> Dict[str, Any]:
  meta = branch_output.get("meta") or _defaults_schedule()
  days = meta["days"]
  periods = meta["periods"]

  room_view: Dict[str, Dict[str, Dict[int, List[Dict[str, Any]]]]] = {}
  branch = branch_output["branch"]
  tt = branch_output["timetable"]

  for day in days:
    for p in periods:
      cell = tt[day][p]
      if not cell:
        continue

      if cell.get("type") == "LAB_BLOCK":
        for row in cell["batches"]:
          r = row["roomFull"]
          if not r:
            continue
          room_view.setdefault(r, {d: {pp: [] for pp in periods} for d in days})
          room_view[r][day][p].append({
            "branch": branch,
            "type": "LAB",
            "batch": row["batch"],
            "name": row["labShort"],
            "teacher": row["teacher"],
          })

      elif cell.get("type") == "LECTURE":
        r = cell["room"]
        room_view.setdefault(r, {d: {pp: [] for pp in periods} for d in days})
        room_view[r][day][p].append({
          "branch": branch,
          "type": "LECTURE",
          "name": cell["subjectShort"],
          "teacher": cell["teacher"],
        })

  return {"rooms": room_view, "meta": meta}
