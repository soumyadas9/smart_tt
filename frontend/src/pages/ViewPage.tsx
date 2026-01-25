import React, { useEffect, useMemo, useState } from "react";
import TimetableGrid, { type BranchTimetable } from "../components/TimetableGrid";
import { Tabs } from "../components/Tabs";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function ViewPage({
  data,
  onBack,
}: {
  data: any;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"Student View" | "Teacher View" | "Lab View">("Student View");
const [selectedTeacher, setSelectedTeacher] = useState("");
const [selectedRoom, setSelectedRoom] = useState("");

// manual edit toggle
const [manualEnabled, setManualEnabled] = useState(false);

// IMPORTANT: initialize from localStorage first, else from data.branches
const [branchesState, setBranchesState] = useState<BranchTimetable[]>(() => {
  const saved = localStorage.getItem("tt_saved_branches");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  return data.branches || [];
});

// tracks if user changed anything after last save
const [dirty, setDirty] = useState(false);



  // ✅ If you regenerate and come back to this page, sync state with new data
  useEffect(() => {
  // only reset state when NEW timetable is generated
  // (i.e. when the data.branches reference changes)
  setBranchesState(data.branches || []);
  setDirty(false);
  setSelectedTeacher("");
  setSelectedRoom("");
  setManualEnabled(false);
}, [data?.branches]);


  const { teacherView, roomView } = useMemo(() => buildViewsFromBranches(branchesState), [branchesState]);


  const teachers = useMemo(() => Object.keys(teacherView).sort(), [teacherView]);
  const rooms = useMemo(() => Object.keys(roomView).sort(), [roomView]);

  // ✅ Drag-drop handler (updates branchesState)
  function moveCell(
  branchName: string,
  kind: "LECTURE" | "LAB",
  fromDay: string,
  fromP: number,
  toDay: string,
  toP: number
) {
  setBranchesState((prev) =>
    prev.map((b) => {
      if (b.branch !== branchName) return b;

      const tt = structuredClone(b.timetable);

      const fromCell = tt[fromDay]?.[fromP] ?? null;
      if (!fromCell) return b;

      // -----------------------
      // 1) MOVE LECTURE (same as your old logic)
      // -----------------------
      if (kind === "LECTURE") {
        const toCell = tt[toDay]?.[toP] ?? null;

        if (fromCell.type !== "LECTURE") return b;
        if (toCell && (toCell.type === "LAB_BLOCK" || toCell.type === "MERGED")) return b;
        if (toCell && toCell.type !== "LECTURE") return b;

        tt[fromDay][fromP] = toCell ?? null;
        tt[toDay][toP] = fromCell;

        setDirty(true);
        return { ...b, timetable: tt };
      }

      // -----------------------
      // 2) MOVE LAB BLOCK (moves LAB_BLOCK + its MERGED hour)
      // -----------------------
      if (kind === "LAB") {
        // must drag only LAB_BLOCK start slot (p=1,3,5,7)
        if (fromCell.type !== "LAB_BLOCK") return b;
        if (fromP % 2 === 0) return b;

        const fromMerged = tt[fromDay]?.[fromP + 1] ?? null;
        if (!fromMerged || fromMerged.type !== "MERGED") return b;

        // target must be start slot too
        if (toP % 2 === 0) return b;

        const toCell1 = tt[toDay]?.[toP] ?? null;
        const toCell2 = tt[toDay]?.[toP + 1] ?? null;

        // keep it safe: only drop lab into two empty periods
        if (toCell1 || toCell2) return b;

        // clear old
        tt[fromDay][fromP] = null;
        tt[fromDay][fromP + 1] = null;

        // place new (update start/end too)
        tt[toDay][toP] = { ...fromCell, start: toP, end: toP + 1 };
        tt[toDay][toP + 1] = { type: "MERGED", into: toP };

        setDirty(true);
        return { ...b, timetable: tt };
      }

      return b;
    })
  );
}


  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <button onClick={onBack} className="px-3 py-2 border border-black text-sm">
          {"<- Back"}
        </button>

        <Tabs tabs={["Student View", "Teacher View", "Lab View"]} active={tab} onChange={(t) => setTab(t as any)} />
      </div>

      {/* ✅ Manual toggle shown only in Student View (because drag-drop is inside TimetableGrid) */}
      {tab === "Student View" && (
  <div className="flex items-center gap-3">
    <button
      onClick={() => setManualEnabled((v) => !v)}
      className="px-3 py-2 border border-black text-sm"
    >
      {manualEnabled ? "Disable Manual Changes" : "Enable Manual Changes"}
    </button>

    <button
      disabled={!dirty}
      onClick={() => {
        localStorage.setItem("tt_saved_branches", JSON.stringify(branchesState));
        setDirty(false);
      }}
      className={`px-3 py-2 border border-black text-sm ${
        !dirty ? "opacity-40 cursor-not-allowed" : ""
      }`}
    >
      Save Changes
    </button>
    <button
  className="px-3 py-2 border border-black text-sm no-print"
  onClick={() => window.print()}
>
  Export PDF
</button>


    <div className="text-sm opacity-70">
      Drag & drop works for <b>LECTURES only</b> (labs stay fixed).
    </div>
  </div>
)}


      {tab === "Student View" && (
        <div className="space-y-6">
          {branchesState.map((b) => (
            <TimetableGrid
  key={b.branch}
  titleRight={`CLASS: ${b.branch}`}
  subtitleLeft={`ACADEMIC YEAR 2023-24   W.E.F 21/08/2023`}
  timetable={b.timetable}
  editable={manualEnabled}
  onMoveCell={({ kind, fromDay, fromP, toDay, toP }) =>
    moveCell(b.branch, kind, fromDay, fromP, toDay, toP)
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
            />
          )}
        </div>
      )}
    </div>
  );
}

function TeacherOrRoomGrid({ title, grid, rightLabel, formatEntry }: any) {
  return (
    <div className="paper p-4">
      <div className="text-center text-lg font-extrabold">{title}</div>

      <div className="mt-3 grid-border">
        {/* ✅ Header row WITH LUNCH (fixes your mismatch) */}
        <div className="grid" style={{ gridTemplateColumns: "80px repeat(4, 1fr) 90px repeat(4, 1fr)" }}>
          <div className="grid-border p-2 text-sm font-bold text-center">Day</div>

          {[
            { p: 1, time: "8:30-9:30" },
            { p: 2, time: "9:30-10:30" },
            { p: 3, time: "10:30-11:30" },
            { p: 4, time: "11:30-12:30" },
          ].map((x) => (
            <div key={x.p} className="grid-border p-2 text-sm font-bold text-center">
              <div>{x.p}</div>
              <div className="text-[11px] font-semibold opacity-80">{x.time}</div>
            </div>
          ))}

          <div className="grid-border p-2 text-sm font-bold text-center">LUNCH</div>

          {[
            { p: 5, time: "1:15-2:15" },
            { p: 6, time: "2:15-3:15" },
            { p: 7, time: "3:15-4:15" },
            { p: 8, time: "4:15-5:15" },
          ].map((x) => (
            <div key={x.p} className="grid-border p-2 text-sm font-bold text-center">
              <div>{x.p}</div>
              <div className="text-[11px] font-semibold opacity-80">{x.time}</div>
            </div>
          ))}
        </div>

        {DAYS.map((day) => (
          <div key={day} className="grid" style={{ gridTemplateColumns: "80px repeat(4, 1fr) 90px repeat(4, 1fr)" }}>
            <div className="grid-border p-2 text-sm font-bold text-center">{day.slice(0, 2)}</div>
            {[1, 2, 3, 4].map((p) => (
              <SmallCell key={p} entries={grid?.[day]?.[p] ?? []} formatEntry={formatEntry} />
            ))}
            <div className="grid-border p-2 text-xs text-center">Lunch</div>
            {[5, 6, 7, 8].map((p) => (
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
function buildViewsFromBranches(branches: BranchTimetable[]) {
  const teacherView: any = {};
  const roomView: any = {};

  for (const b of branches) {
    const branchName = b.branch;
    const tt = b.timetable;

    for (const day of DAYS) {
      for (const p of PERIODS) {
        const cell = tt?.[day]?.[p];
        if (!cell) continue;

        // LAB block
        if ((cell as any).type === "LAB_BLOCK") {
          for (const row of (cell as any).batches) {
            const t = row.teacher;
            const r = row.room;

            teacherView[t] ??= initGrid();
            roomView[r] ??= initGrid();

            teacherView[t][day][p].push({
              branch: branchName,
              type: "LAB",
              batch: row.batch,
              name: row.labShort,
              room: r,
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

        // LECTURE
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

