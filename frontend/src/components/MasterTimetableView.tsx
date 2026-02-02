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

// Unlimited colors (no palette limit)
function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function teacherBg(teacher: string) {
  const h = hashString(teacher) % 360;
  // soft readable pastel
  return `hsl(${h} 70% 85%)`;
}

function teacherShort(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 6).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MasterTimetableView({
  branches,
  title = "MASTER TIMETABLE VIEW (All Branches)",
}: {
  branches: BranchTimetable[];
  title?: string;
}) {
  const [clickedTeacher, setClickedTeacher] = useState("");

  // 1. ✅ ADDED: Teacher Color Map (Golden Angle Distribution)
  const teacherColorMap = useMemo(() => {
    const set = new Set<string>();

    // collect teachers from ALL branches
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

    // golden angle distribution -> highly distinct hues for many teachers
    teachers.forEach((t, i) => {
      const hue = (i * 137.508) % 360;

// alternate lightness + saturation so nearby hues don't look same
const sat = i % 3 === 0 ? 80 : i % 3 === 1 ? 70 : 85;
const light = i % 2 === 0 ? 88 : 78;

map.set(t, `hsl(${hue.toFixed(2)} ${sat}% ${light}%)`);

    });

    return map;
  }, [branches]);

  // 2. ✅ UPDATED: Local teacherBg function using the Map
  const teacherBg = (teacher: string) => {
    return teacherColorMap.get(teacher) ?? "hsl(0 0% 92%)";
  };

  // 3. Clash map logic (Same as your previous code)
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

  // ... rest of your JSX return logic follows here 

  return (
    <div className="paper p-4">
      <div className="text-center font-extrabold text-lg">{title}</div>
      <div className="text-center text-[11px] opacity-70 mt-1">
       
      </div>

      <div className="mt-3 overflow-auto">
        <table className="border border-black w-full text-sm table-fixed">
          <thead className="bg-gray-100">
            {/* Row 1: Day group headers */}
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

            {/* Row 2: Period numbers */}
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

                      // skip merged hour of a lab (because start cell will span 2 cols)
                      if (isMerged(cell)) return null;

                      // LAB_BLOCK: show once with colspan=2
                      if (isLabBlock(cell)) {
  // If ANY batch teacher clashes in this slot, mark the whole lab cell as clash
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
  ].join(" ")}
  title={
    cell.batches
      ?.map((r) => `${r.batch} ${r.labShort} | ${r.teacher} | ${r.room}`)
      .join("\n") ?? ""
  }
>
  {/* tiny LAB label */}
 

  {/* compressed 4 strips */}
  <div className="flex flex-col">
    {(cell.batches ?? []).slice(0, 4).map((row, idx) => (
      <div
  key={idx}
  className="h-[10px] border-b border-black last:border-b-0 cursor-pointer flex items-center"
  style={{ backgroundColor: teacherBg(row.teacher) }}
  onClick={() => setClickedTeacher(row.teacher)}
  title={[
    row.batch,
    row.labShort,
    row.teacher,
    row.room,         // if this exists
  ].filter(Boolean).join(" | ")}
>
  <span className="px-1 text-[8px] leading-none font-semibold truncate">
    {row.labShort}
  </span>
</div>

    ))}
  </div>
</td>

  );
}


                      // LECTURE
                      if (isLecture(cell)) {
                        const clashKey = `${day}|${p}|${cell.teacher}`;
                        const isClash = (clashMap.get(clashKey) ?? 0) > 1;

                        return (
                          <td
                            key={`${day}-${p}`}
                            className={[
                              "border border-black p-1 align-top cursor-pointer",
                              isClash ? "border-2 border-red-600" : "",
                            ].join(" ")}
                            style={{ backgroundColor: teacherBg(cell.teacher) }}
                            onClick={() => setClickedTeacher(cell.teacher)}
                            title={`${cell.subjectShort} | ${cell.teacher} | ${cell.room}`}
                          >
                            <div className="text-[11px] font-bold truncate">{cell.subjectShort}</div>
                            <div className="text-[10px] opacity-80 truncate">{cell.teacher}</div>
                          </td>
                        );
                      }

                      // empty slot
                      return <td key={`${day}-${p}`} className="border border-black p-1 h-[42px]" />;
                    })}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Click info (instead of heavy footer legend) */}
      <div className="mt-3 border border-black p-2 text-sm">
        <span className="font-bold">Selected Teacher:</span>{" "}
        <span className={clickedTeacher ? "" : "opacity-60"}>{clickedTeacher || "Click any colored cell"}</span>
      </div>
    </div>
  );
}
