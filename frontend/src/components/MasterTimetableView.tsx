import React, { useMemo, useState } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

type LabRow = { batch: string; labShort: string; teacher: string; room: string };
type LabBlock = { type: "LAB_BLOCK"; start: number; end: number; batches: LabRow[] };
type Merged = { type: "MERGED"; into: number };
type LectureCell = { type: "LECTURE"; subjectShort: string; teacher: string; room: string };
type Cell = LabBlock | Merged | LectureCell | null;

export type BranchTimetable = {
  branch: string;
  timetable: Record<string, Record<number, Cell>>;
};

function isLecture(x: any): x is LectureCell {
  return x && x.type === "LECTURE";
}
function isLabBlock(x: any): x is LabBlock {
  return x && x.type === "LAB_BLOCK";
}
function isMerged(x: any): x is Merged {
  return x && x.type === "MERGED";
}

type MoveArgs = {
  branch: string;
  kind: "LECTURE" | "LAB" | "LAB_ROW";
  fromDay: string;
  fromP: number;
  toDay: string;
  toP: number;
  batch?: string;
};

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default function MasterTimetableView({
  branches,
  title = "MASTER TIMETABLE VIEW (All Branches)",
  editable = false,
  onMove,
}: {
  branches: BranchTimetable[];
  title?: string;
  editable?: boolean;
  onMove?: (args: MoveArgs) => void;
}) {
  const [clickedTeacher, setClickedTeacher] = useState("");

  // ✅ Teacher Color Map (Golden Angle Distribution)
  const teacherColorMap = useMemo(() => {
    const set = new Set<string>();

    for (const b of branches) {
      for (const day of DAYS) {
        for (const p of PERIODS) {
          const cell = b.timetable?.[day]?.[p];
          if (!cell) continue;

          if (isLecture(cell)) {
            if (cell.teacher) set.add(cell.teacher);
          } else if (isLabBlock(cell)) {
            for (const row of cell.batches ?? []) {
              if (row.teacher) set.add(row.teacher);
            }
          }
        }
      }
    }

    const teachers = Array.from(set).sort();
    const map = new Map<string, string>();

    teachers.forEach((t, i) => {
      const hue = (i * 137.508) % 360;
      const sat = i % 3 === 0 ? 80 : i % 3 === 1 ? 70 : 85;
      const light = i % 2 === 0 ? 88 : 78;
      map.set(t, `hsl(${hue.toFixed(2)} ${sat}% ${light}%)`);
    });

    return map;
  }, [branches]);

  const teacherBg = (teacher: string) => teacherColorMap.get(teacher) ?? "hsl(0 0% 92%)";

  // ✅ Clash map logic
  const clashMap = useMemo(() => {
    const count = new Map<string, number>();

    for (const b of branches) {
      for (const day of DAYS) {
        for (const p of PERIODS) {
          const cell = b.timetable?.[day]?.[p] ?? null;
          if (!cell) continue;

          if (isLecture(cell)) {
            const key = `${day}|${p}|${cell.teacher}`;
            count.set(key, (count.get(key) ?? 0) + 1);
          }

          if (isLabBlock(cell)) {
            for (const row of cell.batches) {
              const key1 = `${day}|${cell.start}|${row.teacher}`;
              const key2 = `${day}|${cell.end}|${row.teacher}`;
              count.set(key1, (count.get(key1) ?? 0) + 1);
              count.set(key2, (count.get(key2) ?? 0) + 1);
            }
          }
        }
      }
    }
    return count;
  }, [branches]);

  // -----------------------
  // DnD helpers
  // -----------------------
  function beginDrag(e: React.DragEvent, payload: any) {
    if (!editable) return;
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function allowDrop(e: React.DragEvent) {
    if (!editable) return;
    e.preventDefault(); // IMPORTANT
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, toDay: string, toP: number) {
    if (!editable) return;
    e.preventDefault();

    const raw = e.dataTransfer.getData("application/json");
    const payload = safeJsonParse(raw);
    if (!payload) return;

    // payload must include: branch, kind, fromDay, fromP, batch?
    if (!payload.branch || !payload.kind || !payload.fromDay || !payload.fromP) return;

    onMove?.({
      branch: payload.branch,
      kind: payload.kind,
      fromDay: payload.fromDay,
      fromP: payload.fromP,
      toDay,
      toP,
      batch: payload.batch,
    });
  }

  return (
    <div className="paper p-4">
      <div className="text-center font-extrabold text-lg">{title}</div>

      {editable && (
        <div className="text-center text-[11px] mt-1 opacity-80">
          Drag lectures, lab blocks, or a single lab-strip (batch row) to another slot.
        </div>
      )}

      <div className="mt-3 overflow-auto">
        <table className="border border-black w-full text-sm table-fixed">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-black p-2 text-left w-[110px]" rowSpan={2}>
                Branch
              </th>
              {DAYS.map((d) => (
                <th key={d} className="border border-black p-2 text-center" colSpan={8}>
                  {d}
                </th>
              ))}
            </tr>

            <tr>
              {DAYS.map((d) =>
                PERIODS.map((p) => (
                  <th key={`${d}-${p}`} className="border border-black p-1 text-center text-[11px] w-[70px]">
                    {p}
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody>
            {branches.map((b) => (
              <tr key={b.branch}>
                <td className="border border-black p-2 font-bold">{b.branch}</td>

                {DAYS.map((day) => (
                  <React.Fragment key={`${b.branch}-${day}`}>
                    {PERIODS.map((p) => {
                      const cell = b.timetable?.[day]?.[p] ?? null;

                      // skip merged hour of a lab
                      if (isMerged(cell)) return null;

                      // ✅ LAB_BLOCK (colSpan=2)
                      if (isLabBlock(cell)) {
                        const isClash = (cell.batches ?? []).some((row) => {
                          const key = `${day}|${p}|${row.teacher}`;
                          return (clashMap.get(key) ?? 0) > 1;
                        });

                        return (
                          <td
                            key={`${day}-${p}`}
                            colSpan={2}
                            className={[
                              "border border-black p-0 align-top h-[52px] overflow-hidden",
                              isClash ? "border-2 border-red-600" : "",
                              editable ? "cursor-move" : "",
                            ].join(" ")}
                            title={
                              cell.batches
                                ?.map((r) => `${r.batch} ${r.labShort} | ${r.teacher} | ${r.room}`)
                                .join("\n") ?? ""
                            }
                            draggable={editable}
                            onDragStart={(e) =>
                              beginDrag(e, {
                                branch: b.branch,
                                kind: "LAB",
                                fromDay: day,
                                fromP: p,
                              })
                            }
                            onDragOver={allowDrop}
                            onDrop={(e) => handleDrop(e, day, p)}
                          >
                            <div className="flex flex-col">
                              {(cell.batches ?? []).slice(0, 4).map((row, idx) => (
                                <div
                                  key={idx}
                                  className="h-[10px] border-b border-black last:border-b-0 flex items-center"
                                  style={{ backgroundColor: teacherBg(row.teacher) }}
                                  onClick={() => setClickedTeacher(row.teacher)}
                                  title={[row.batch, row.labShort, row.teacher, row.room].filter(Boolean).join(" | ")}
                                >
                                  {/* ✅ Drag a single batch row */}
                                  <div
                                    className={["w-full px-1 text-[8px] leading-none font-semibold truncate", editable ? "cursor-grab" : ""].join(
                                      " "
                                    )}
                                    draggable={editable}
                                    onDragStart={(e) => {
                                      // stop the parent LAB drag from overriding
                                      e.stopPropagation();
                                      beginDrag(e, {
                                        branch: b.branch,
                                        kind: "LAB_ROW",
                                        fromDay: day,
                                        fromP: p, // lab block start
                                        batch: row.batch,
                                      });
                                    }}
                                  >
                                    {row.labShort}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      }

                      // ✅ LECTURE
                      if (isLecture(cell)) {
                        const clashKey = `${day}|${p}|${cell.teacher}`;
                        const isClash = (clashMap.get(clashKey) ?? 0) > 1;

                        return (
                          <td
                            key={`${day}-${p}`}
                            className={[
                              "border border-black p-1 align-top",
                              isClash ? "border-2 border-red-600" : "",
                              editable ? "cursor-move" : "cursor-pointer",
                            ].join(" ")}
                            style={{ backgroundColor: teacherBg(cell.teacher) }}
                            onClick={() => setClickedTeacher(cell.teacher)}
                            title={`${cell.subjectShort} | ${cell.teacher} | ${cell.room}`}
                            draggable={editable}
                            onDragStart={(e) =>
                              beginDrag(e, {
                                branch: b.branch,
                                kind: "LECTURE",
                                fromDay: day,
                                fromP: p,
                              })
                            }
                            onDragOver={allowDrop}
                            onDrop={(e) => handleDrop(e, day, p)}
                          >
                            <div className="text-[11px] font-bold truncate">{cell.subjectShort}</div>
                            <div className="text-[10px] opacity-80 truncate">{cell.teacher}</div>
                          </td>
                        );
                      }

                      // ✅ Empty slot: allow dropping into it
                      return (
                        <td
                          key={`${day}-${p}`}
                          className={["border border-black p-1 h-[42px]", editable ? "bg-white" : ""].join(" ")}
                          onDragOver={allowDrop}
                          onDrop={(e) => handleDrop(e, day, p)}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 border border-black p-2 text-sm">
        <span className="font-bold">Selected Teacher:</span>{" "}
        <span className={clickedTeacher ? "" : "opacity-60"}>{clickedTeacher || "Click any colored cell"}</span>
      </div>
    </div>
  );
}
