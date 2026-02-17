import React, { useMemo, useState } from "react";

type PeriodLabel = { p: number; label: string; time: string };
export type Meta = {
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
  meta,
}: {
  branches: BranchTimetable[];
  title?: string;
  editable?: boolean;
  onMove?: (args: MoveArgs) => void;
  meta?: Meta;
}) {
  const m: Meta = meta || FALLBACK_META;
  const DAYS = m.days;
  const PERIODS = m.periodLabels.map((x) => x.p);
  const lunchAfter = m.lunchAfterPeriod;

  const beforeLunch = PERIODS.filter((p) => p <= lunchAfter);
  const afterLunch = PERIODS.filter((p) => p > lunchAfter);

  const [clickedTeacher, setClickedTeacher] = useState("");

  // ✅ Labs must be 2 consecutive periods and MUST NOT cross lunch boundary.
  const isValidLabStart = (p: number) => {
    const isOdd = p % 2 === 1;
    const existsNext = PERIODS.includes(p + 1);
    const crossesLunch = p === lunchAfter; // p=4 would cross lunch if lunchAfter=4
    return isOdd && existsNext && !crossesLunch;
  };

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
  }, [branches, DAYS.join("|"), PERIODS.join("|")]);

  const teacherBg = (teacher: string) => teacherColorMap.get(teacher) ?? "hsl(0 0% 92%)";

  // ✅ Clash map logic (teacher clashes per day+period)
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
  }, [branches, DAYS.join("|"), PERIODS.join("|")]);

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
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, toDay: string, toP: number, isLunchCell?: boolean) {
    if (!editable) return;
    e.preventDefault();

    if (isLunchCell) return; // never drop onto lunch column

    const raw = e.dataTransfer.getData("application/json");
    const payload = safeJsonParse(raw);
    if (!payload) return;

    if (!payload.branch || !payload.kind || !payload.fromDay || !payload.fromP) return;

    // Block dropping labs into invalid start slots (cross lunch / missing next)
    if ((payload.kind === "LAB" || payload.kind === "LAB_ROW") && !isValidLabStart(toP)) return;

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

  // each day has (periods + 1 lunch column)
  const dayColSpan = PERIODS.length + 1;

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
                <th key={d} className="border border-black p-2 text-center" colSpan={dayColSpan}>
                  {d}
                </th>
              ))}
            </tr>

            <tr>
              {DAYS.map((d) => (
                <React.Fragment key={`hdr-${d}`}>
                  {beforeLunch.map((p) => (
                    <th key={`${d}-${p}`} className="border border-black p-1 text-center text-[11px] w-[70px]">
                      {p}
                    </th>
                  ))}

                  <th className="border border-black p-1 text-center text-[11px] w-[70px]">L</th>

                  {afterLunch.map((p) => (
                    <th key={`${d}-${p}`} className="border border-black p-1 text-center text-[11px] w-[70px]">
                      {p}
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {branches.map((b) => (
              <tr key={b.branch}>
                <td className="border border-black p-2 font-bold">{b.branch}</td>

                {DAYS.map((day) => (
                  <React.Fragment key={`${b.branch}-${day}`}>
                    {/* Before lunch */}
                    {beforeLunch.map((p) => {
                      const cell = b.timetable?.[day]?.[p] ?? null;

                      if (isMerged(cell)) return null;

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
                                  <div
                                    className={[
                                      "w-full px-1 text-[8px] leading-none font-semibold truncate",
                                      editable ? "cursor-grab" : "",
                                    ].join(" ")}
                                    draggable={editable}
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      beginDrag(e, {
                                        branch: b.branch,
                                        kind: "LAB_ROW",
                                        fromDay: day,
                                        fromP: p,
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

                      return (
                        <td
                          key={`${day}-${p}`}
                          className={["border border-black p-1 h-[42px]", editable ? "bg-white" : ""].join(" ")}
                          onDragOver={allowDrop}
                          onDrop={(e) => handleDrop(e, day, p)}
                        />
                      );
                    })}

                    {/* Lunch column */}
                    <td
                      className="border border-black p-1 text-center text-[11px] opacity-70 bg-gray-50"
                      title="Lunch Break"
                      onDragOver={(e) => {
                        if (!editable) return;
                        e.preventDefault();
                      }}
                      onDrop={(e) => handleDrop(e, day, lunchAfter, true)}
                    >
                      Lunch
                    </td>

                    {/* After lunch */}
                    {afterLunch.map((p) => {
                      const cell = b.timetable?.[day]?.[p] ?? null;

                      if (isMerged(cell)) return null;

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
                                  <div
                                    className={[
                                      "w-full px-1 text-[8px] leading-none font-semibold truncate",
                                      editable ? "cursor-grab" : "",
                                    ].join(" ")}
                                    draggable={editable}
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      beginDrag(e, {
                                        branch: b.branch,
                                        kind: "LAB_ROW",
                                        fromDay: day,
                                        fromP: p,
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
