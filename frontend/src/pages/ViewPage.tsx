import React, { useEffect, useMemo, useState } from "react";
import TimetableGrid, { type BranchTimetable } from "../components/TimetableGrid";
import { Tabs } from "../components/Tabs";
import MasterTimetableView from "../components/MasterTimetableView";

type MoveResult = { ok: true } | { ok: false; reason: string };

type PeriodLabel = { p: number; label: string; time: string };
type Meta = {
  days: string[];
  lunchAfterPeriod: number;
  periodLabels: PeriodLabel[];
};

const FALLBACK_META: Meta = {
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  lunchAfterPeriod: 4,
  periodLabels: [
    { p: 1, label: "1", time: "8:30-9:30" },
    { p: 2, label: "2", time: "9:30-10:30" },
    { p: 3, label: "3", time: "10:30-11:30" },
    { p: 4, label: "4", time: "11:30-12:30" },
    { p: 5, label: "5", time: "1:15-2:15" },
    { p: 6, label: "6", time: "2:15-3:15" },
    { p: 7, label: "7", time: "3:15-4:15" },
    { p: 8, label: "8", time: "4:15-5:15" },
  ],
};

function slotKey(branch: string, day: string, p: number) {
  return `${branch}__${day}__${p}`;
}

function getCellAt(tt: any, day: string, p: number) {
  const cell = tt?.[day]?.[p] ?? null;
  if (!cell) return null;

  if (cell.type === "MERGED") {
    const into = cell.into;
    return tt?.[day]?.[into] ?? null;
  }
  return cell;
}

function collectOccupancies(branches: any[], DAYS: string[], PERIODS: number[]) {
  const occ: Record<string, any[]> = {};

  for (const b of branches) {
    const branchName = b.branch;
    const tt = b.timetable;

    for (const day of DAYS) {
      for (const p of PERIODS) {
        const cell = getCellAt(tt, day, p);
        if (!cell) continue;

        const k = `${day}__${p}`;
        occ[k] ??= [];

        if (cell.type === "LECTURE") {
          occ[k].push({
            branch: branchName,
            type: "LECTURE",
            teacher: cell.teacher,
            room: cell.room,
            name: cell.subjectShort,
          });
        }

        if (cell.type === "LAB_BLOCK") {
          for (const row of cell.batches || []) {
            occ[k].push({
              branch: branchName,
              type: "LAB",
              teacher: row.teacher,
              room: row.roomFull,
              name: row.labShort,
              batch: row.batch,
            });
          }
        }
      }
    }
  }
  return occ;
}

function findClashReason(args: {
  branches: any[];
  teacher: string;
  room: string;
  day: string;
  p: number;
  DAYS: string[];
  PERIODS: number[];
}) {
  const { branches, teacher, room, day, p, DAYS, PERIODS } = args;

  const occ = collectOccupancies(branches, DAYS, PERIODS);
  const k = `${day}__${p}`;
  const entries = occ[k] ?? [];

  for (const e of entries) {
    if (teacher && e.teacher === teacher) {
      return `Teacher clash: "${teacher}" is already busy on ${day} period ${p} (${e.type} in ${e.branch}${
        e.batch ? ` ${e.batch}` : ""
      } • ${e.name}).`;
    }
    if (room && e.room === room) {
      return `Room clash: "${room}" is already occupied on ${day} period ${p} (${e.type} in ${e.branch}${
        e.batch ? ` ${e.batch}` : ""
      } • ${e.name}).`;
    }
  }

  return null;
}

export default function ViewPage({
  data,
  onBack,
}: {
  data: any;
  onBack: () => void;
}) {
  const meta: Meta = data?.meta || FALLBACK_META;
  const DAYS = meta.days;
  const PERIODS = meta.periodLabels.map((x) => x.p);
  const lunchAfter = meta.lunchAfterPeriod;

  const [tab, setTab] = useState<"Student View" | "Teacher View" | "Lab View" | "Master View">("Student View");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");

  const [manualEnabled, setManualEnabled] = useState(false);

  const [branchesState, setBranchesState] = useState<BranchTimetable[]>(() => {
    const saved = localStorage.getItem("tt_saved_branches");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return data.branches || [];
  });

  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setBranchesState(data.branches || []);
    setDirty(false);
    setSelectedTeacher("");
    setSelectedRoom("");
    setManualEnabled(false);
  }, [data?.branches]);

  const { teacherView, roomView } = useMemo(
    () => buildViewsFromBranches(branchesState, DAYS, PERIODS),
    [branchesState, DAYS.join("|"), PERIODS.join("|")]
  );

  const teachers = useMemo(() => Object.keys(teacherView).sort(), [teacherView]);
  const rooms = useMemo(() => Object.keys(roomView).sort(), [roomView]);

  function moveCell(
    branchName: string,
    kind: "LECTURE" | "LAB" | "LAB_ROW",
    fromDay: string,
    fromP: number,
    toDay: string,
    toP: number,
    batch?: string
  ): MoveResult {
    let result: MoveResult = { ok: true };

    setBranchesState((prev) => {
      const branch = prev.find((x) => x.branch === branchName);
      if (!branch) {
        result = { ok: false, reason: "Branch not found." };
        return prev;
      }

      const tt = structuredClone(branch.timetable);
      const fromCell = tt[fromDay]?.[fromP] ?? null;
      if (!fromCell) {
        result = { ok: false, reason: "Nothing to move from that slot." };
        return prev;
      }

      const simulateBranches = (nextTT: any) => prev.map((b) => (b.branch === branchName ? { ...b, timetable: nextTT } : b));

      // -----------------------
      // 1) MOVE LECTURE
      // -----------------------
      if (kind === "LECTURE") {
        const toCell = tt[toDay]?.[toP] ?? null;

        if (fromCell.type !== "LECTURE") {
          result = { ok: false, reason: "Only lectures can be moved here." };
          return prev;
        }
        if (toCell && (toCell.type === "LAB_BLOCK" || toCell.type === "MERGED")) {
          result = { ok: false, reason: "You cannot drop a lecture onto a lab block." };
          return prev;
        }
        if (toCell && toCell.type !== "LECTURE") {
          result = { ok: false, reason: "You can only swap with another lecture, or move into empty." };
          return prev;
        }

        const simTT = structuredClone(tt);
        const movingLecture = fromCell;
        const targetLecture = toCell;

        simTT[fromDay][fromP] = null;
        simTT[toDay][toP] = null;

        const clash1 = findClashReason({
          branches: simulateBranches(simTT),
          teacher: movingLecture.teacher,
          room: movingLecture.room,
          day: toDay,
          p: toP,
          DAYS,
          PERIODS,
        });
        if (clash1) {
          result = { ok: false, reason: clash1 };
          return prev;
        }

        if (targetLecture) {
          const clash2 = findClashReason({
            branches: simulateBranches(simTT),
            teacher: targetLecture.teacher,
            room: targetLecture.room,
            day: fromDay,
            p: fromP,
            DAYS,
            PERIODS,
          });
          if (clash2) {
            result = { ok: false, reason: clash2 };
            return prev;
          }
        }

        tt[fromDay][fromP] = targetLecture ?? null;
        tt[toDay][toP] = movingLecture;

        setDirty(true);
        result = { ok: true };
        return prev.map((b) => (b.branch === branchName ? { ...b, timetable: tt } : b));
      }

      // -----------------------
      // 2) MOVE INDIVIDUAL LAB ROW (BATCH)
      // -----------------------
      if (kind === "LAB_ROW") {
        if (!batch) {
          result = { ok: false, reason: "Missing batch information." };
          return prev;
        }

        // ✅ dynamic start rule: must be a valid lab start (odd and not crossing lunch)
        const isValidLabStart = (p: number) => {
          const isOdd = p % 2 === 1;
          const existsNext = PERIODS.includes(p + 1);
          const crossesLunch = p === lunchAfter; // start right before lunch crosses lunch boundary
          return isOdd && existsNext && !crossesLunch;
        };

        if (!isValidLabStart(fromP) || !isValidLabStart(toP)) {
          result = { ok: false, reason: "Invalid lab start slot for 2-hour lab." };
          return prev;
        }

        const fromBlock = tt[fromDay]?.[fromP];
        if (!fromBlock || fromBlock.type !== "LAB_BLOCK") {
          result = { ok: false, reason: "Source is not a lab block." };
          return prev;
        }

        const row = fromBlock.batches.find((b: any) => b.batch === batch);
        if (!row) {
          result = { ok: false, reason: "Lab batch not found in source." };
          return prev;
        }

        const toCell1 = tt[toDay]?.[toP] ?? null;
        const toCell2 = tt[toDay]?.[toP + 1] ?? null;

        const empty2hOK = toCell1 === null && toCell2 === null;
        const existingLabOK =
          toCell1?.type === "LAB_BLOCK" && (toCell2 === null || (toCell2.type === "MERGED" && toCell2.into === toP));

        if (!(empty2hOK || existingLabOK)) {
          result = { ok: false, reason: "Invalid target for lab row. Drop on an empty 2-hour slot or an existing lab slot." };
          return prev;
        }

        const simTT = structuredClone(tt);
        const simFrom = simTT[fromDay][fromP];

        if (!simFrom || simFrom.type !== "LAB_BLOCK") {
          result = { ok: false, reason: "Internal error: source lab block missing." };
          return prev;
        }

        simFrom.batches = simFrom.batches.filter((b: any) => b.batch !== batch);

        if (simFrom.batches.length === 0) {
          simTT[fromDay][fromP] = null;
          simTT[fromDay][fromP + 1] = null;
        } else {
          simTT[fromDay][fromP] = simFrom;
          simTT[fromDay][fromP + 1] = { type: "MERGED", into: fromP };
        }

        for (const hour of [toP, toP + 1]) {
          const clash = findClashReason({
            branches: simulateBranches(simTT),
            teacher: row.teacher,
            room: "", // ignore lab room constraint for now
            day: toDay,
            p: hour,
            DAYS,
            PERIODS,
          });
          if (clash) {
            result = { ok: false, reason: clash };
            return prev;
          }
        }

        // APPLY MOVE
        fromBlock.batches = fromBlock.batches.filter((b: any) => b.batch !== batch);

        if (fromBlock.batches.length === 0) {
          tt[fromDay][fromP] = null;
          tt[fromDay][fromP + 1] = null;
        } else {
          tt[fromDay][fromP] = fromBlock;
          tt[fromDay][fromP + 1] = { type: "MERGED", into: fromP };
        }

        if (empty2hOK) {
          tt[toDay][toP] = { type: "LAB_BLOCK", start: toP, end: toP + 1, batches: [row] };
          tt[toDay][toP + 1] = { type: "MERGED", into: toP };
        } else {
          const dest = tt[toDay][toP] as any;

          if (dest.batches.some((b: any) => b.batch === batch)) {
            result = { ok: false, reason: `Batch ${batch} already exists in that lab slot.` };
            return prev;
          }

          dest.batches.push(row);
          tt[toDay][toP] = dest;
          tt[toDay][toP + 1] = { type: "MERGED", into: toP };
        }

        setDirty(true);
        result = { ok: true };
        return prev.map((b) => (b.branch === branchName ? { ...b, timetable: tt } : b));
      }

      // -----------------------
      // 3) MOVE FULL LAB BLOCK (optional)
      // -----------------------
      if (kind === "LAB") {
        if (fromCell.type !== "LAB_BLOCK") {
          result = { ok: false, reason: "You can only drag the main lab block (not the merged hour)." };
          return prev;
        }

        const isValidLabStart = (p: number) => {
          const isOdd = p % 2 === 1;
          const existsNext = PERIODS.includes(p + 1);
          const crossesLunch = p === lunchAfter;
          return isOdd && existsNext && !crossesLunch;
        };

        if (!isValidLabStart(fromP) || !isValidLabStart(toP)) {
          result = { ok: false, reason: "Invalid lab start slot for 2-hour lab." };
          return prev;
        }

        const fromMerged = tt[fromDay]?.[fromP + 1] ?? null;
        if (!fromMerged || fromMerged.type !== "MERGED") {
          result = { ok: false, reason: "Lab block is missing its merged hour (data inconsistent)." };
          return prev;
        }

        const toCell1 = tt[toDay]?.[toP] ?? null;
        const toCell2 = tt[toDay]?.[toP + 1] ?? null;
        if (toCell1 || toCell2) {
          result = { ok: false, reason: "Need two empty periods to place a lab block." };
          return prev;
        }

        const simTT = structuredClone(tt);
        simTT[fromDay][fromP] = null;
        simTT[fromDay][fromP + 1] = null;

        for (const hour of [toP, toP + 1]) {
          for (const row of fromCell.batches || []) {
            const clash = findClashReason({
              branches: simulateBranches(simTT),
              teacher: row.teacher,
              room: row.roomFull,
              day: toDay,
              p: hour,
              DAYS,
              PERIODS,
            });
            if (clash) {
              result = { ok: false, reason: clash };
              return prev;
            }
          }
        }

        tt[fromDay][fromP] = null;
        tt[fromDay][fromP + 1] = null;

        tt[toDay][toP] = { ...fromCell, start: toP, end: toP + 1 };
        tt[toDay][toP + 1] = { type: "MERGED", into: toP };

        setDirty(true);
        result = { ok: true };
        return prev.map((b) => (b.branch === branchName ? { ...b, timetable: tt } : b));
      }

      result = { ok: false, reason: "Unknown move type." };
      return prev;
    });

    return result;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <button onClick={onBack} className="px-3 py-2 border border-black text-sm">
          {"<- Back"}
        </button>

        <Tabs
          tabs={["Student View", "Teacher View", "Lab View", "Master View"]}
          active={tab}
          onChange={(t) => setTab(t as any)}
        />
      </div>

      {(tab === "Student View" || tab === "Master View") && (
        <div className="flex items-center gap-3">
          <button onClick={() => setManualEnabled((v) => !v)} className="px-3 py-2 border border-black text-sm">
            {manualEnabled ? "Disable Manual Changes" : "Enable Manual Changes"}
          </button>

          <button
            disabled={!dirty}
            onClick={() => {
              localStorage.setItem("tt_saved_branches", JSON.stringify(branchesState));
              setDirty(false);
            }}
            className={`px-3 py-2 border border-black text-sm ${!dirty ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            Save Changes
          </button>

          <button className="px-3 py-2 border border-black text-sm no-print" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      )}

      {tab === "Student View" && (
        <div className="space-y-6">
          {branchesState.map((b) => (
            <TimetableGrid
              key={b.branch}
              titleRight={`CLASS: ${b.branch}`}
              subtitleLeft={`ACADEMIC YEAR 2026-27   W.E.F 15/07/2026`}
              timetable={b.timetable}
              meta={meta} // ✅ IMPORTANT: pass dynamic meta
              editable={manualEnabled}
              onMoveCell={(args) =>
                moveCell(
                  b.branch,
                  args.kind,
                  args.fromDay,
                  args.fromP,
                  args.toDay,
                  args.toP,
                  "batch" in args ? (args as any).batch : undefined
                )
              }
            />
          ))}
        </div>
      )}

      {tab === "Teacher View" && (
        <div className="space-y-3">
          <div className="flex gap-3 items-center">
            <div className="font-bold">Teacher:</div>
            <select className="border p-2 text-sm" value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
              <option value="">Select</option>
              {teachers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {selectedTeacher && (
            <TeacherOrRoomGrid
              title={`TEACHER: ${selectedTeacher}`}
              grid={teacherView[selectedTeacher]}
              rightLabel="Class/Batch/Lab"
              formatEntry={(e: any) => `${e.branch} - ${e.batch ?? ""}${e.batch ? " - " : ""}${e.name} (${e.room})`}
              meta={meta}
            />
          )}
        </div>
      )}

      {tab === "Lab View" && (
        <div className="space-y-3">
          <div className="flex gap-3 items-center">
            <div className="font-bold">Lab Room:</div>
            <select className="border p-2 text-sm" value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}>
              <option value="">Select</option>
              {rooms.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {selectedRoom && (
            <TeacherOrRoomGrid
              title={`LAB ROOM: ${selectedRoom}`}
              grid={roomView[selectedRoom]}
              rightLabel="Class/Batch/Lab"
              formatEntry={(e: any) => `${e.branch} - ${e.batch ?? ""}${e.batch ? " - " : ""}${e.name} (${e.teacher})`}
              meta={meta}
            />
          )}
        </div>
      )}

      {tab === "Master View" && (
        <MasterTimetableView
          branches={branchesState}
          editable={manualEnabled}
          onMove={(args) => {
            const res = moveCell(args.branch, args.kind, args.fromDay, args.fromP, args.toDay, args.toP, args.batch);
            if (!res.ok) alert(res.reason);
          }}
        />
      )}
    </div>
  );
}

function TeacherOrRoomGrid({ title, grid, rightLabel, formatEntry, meta }: any) {
  const DAYS: string[] = meta?.days ?? FALLBACK_META.days;
  const PERIODS: number[] = (meta?.periodLabels ?? FALLBACK_META.periodLabels).map((x: any) => x.p);
  const lunchAfter: number = meta?.lunchAfterPeriod ?? FALLBACK_META.lunchAfterPeriod;
  const before = PERIODS.filter((p) => p <= lunchAfter);
  const after = PERIODS.filter((p) => p > lunchAfter);

  const periodLabelMap: Record<number, string> = {};
  for (const pl of meta?.periodLabels ?? FALLBACK_META.periodLabels) {
    periodLabelMap[pl.p] = pl.time;
  }

  const gridTemplateColumns = `80px repeat(${before.length}, 1fr) 90px repeat(${after.length}, 1fr)`;

  return (
    <div className="paper p-4">
      <div className="text-center text-lg font-extrabold">{title}</div>

      <div className="mt-3 grid-border">
        <div className="grid" style={{ gridTemplateColumns }}>
          <div className="grid-border p-2 text-sm font-bold text-center">Day</div>

          {before.map((p) => (
            <div key={p} className="grid-border p-2 text-sm font-bold text-center">
              <div>{p}</div>
              <div className="text-[11px] font-semibold opacity-80">{periodLabelMap[p] || ""}</div>
            </div>
          ))}

          <div className="grid-border p-2 text-sm font-bold text-center">LUNCH</div>

          {after.map((p) => (
            <div key={p} className="grid-border p-2 text-sm font-bold text-center">
              <div>{p}</div>
              <div className="text-[11px] font-semibold opacity-80">{periodLabelMap[p] || ""}</div>
            </div>
          ))}
        </div>

        {DAYS.map((day) => (
          <div key={day} className="grid" style={{ gridTemplateColumns }}>
            <div className="grid-border p-2 text-sm font-bold text-center">{day.slice(0, 2)}</div>

            {before.map((p) => (
              <SmallCell key={p} entries={grid?.[day]?.[p] ?? []} formatEntry={formatEntry} />
            ))}

            <div className="grid-border p-2 text-xs text-center">Lunch</div>

            {after.map((p) => (
              <SmallCell key={p} entries={grid?.[day]?.[p] ?? []} formatEntry={formatEntry} />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-2 text-xs opacity-70">Shows: {rightLabel}</div>
    </div>
  );
}

function SmallCell({ entries, formatEntry }: any) {
  if (!entries.length) return <div className="grid-border p-2 min-h-[54px]" />;
  return (
    <div className="grid-border p-1 min-h-[54px] text-[11px]">
      {entries.slice(0, 4).map((e: any, i: number) => (
        <div key={i} className="border-b border-black last:border-b-0 px-1 py-0.5">
          {formatEntry(e)}
        </div>
      ))}
      {entries.length > 4 && <div className="px-1 py-0.5 opacity-70">+{entries.length - 4} more</div>}
    </div>
  );
}

function buildViewsFromBranches(branches: BranchTimetable[], DAYS: string[], PERIODS: number[]) {
  const teacherView: any = {};
  const roomView: any = {};

  for (const b of branches) {
    const branchName = b.branch;
    const tt = b.timetable;

    for (const day of DAYS) {
      for (const p of PERIODS) {
        const cell = tt?.[day]?.[p];
        if (!cell) continue;

        if ((cell as any).type === "LAB_BLOCK") {
          for (const row of (cell as any).batches) {
            const t = row.teacher;
            const r = row.roomFull;

            teacherView[t] ??= initGrid();
            roomView[r] ??= initGrid();

            teacherView[t][day][p].push({
              branch: branchName,
              type: "LAB",
              batch: row.batch,
              name: row.labShort,
              room: row.roomFull,
            });

            roomView[r][day][p].push({
              branch: branchName,
              type: "LAB",
              batch: row.batch,
              name: row.labShort,
              teacher: t,
            });
          }
        }

        if ((cell as any).type === "LECTURE") {
          const t = (cell as any).teacher;
          const r = (cell as any).room;

          teacherView[t] ??= initGrid();
          roomView[r] ??= initGrid();

          teacherView[t][day][p].push({
            branch: branchName,
            type: "LECTURE",
            name: (cell as any).subjectShort,
            room: r,
          });

          roomView[r][day][p].push({
            branch: branchName,
            type: "LECTURE",
            name: (cell as any).subjectShort,
            teacher: t,
          });
        }
      }
    }
  }

  return { teacherView, roomView };

  function initGrid() {
    const g: any = {};
    for (const d of DAYS) {
      g[d] = {};
      for (const pp of PERIODS) g[d][pp] = [];
    }
    return g;
  }
}
