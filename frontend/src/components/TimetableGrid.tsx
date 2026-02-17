import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

const PERIODS = [
  { p: 1, label: "1", time: "8:30-9:30" },
  { p: 2, label: "2", time: "9:30-10:30" },
  { p: 3, label: "3", time: "10:30-11:30" },
  { p: 4, label: "4", time: "11:30-12:30" },
  { p: 5, label: "5", time: "1:15-2:15" },
  { p: 6, label: "6", time: "2:15-3:15" },
  { p: 7, label: "7", time: "3:15-4:15" },
  { p: 8, label: "8", time: "4:15-5:15" },
] as const;

type LabRow = {
  batch: string;
  labShort: string;
  teacher: string;
  teacherShort?: string; // ✅
  roomShort: string;
  roomFull: string;
};

type LabBlock = { type: "LAB_BLOCK"; start: number; end: number; batches: LabRow[] };
type Merged = { type: "MERGED"; into: number };

// ✅ teacherShort optional
type LectureCell = { type: "LECTURE"; subjectShort: string; teacher: string; teacherShort?: string; room: string };

type Cell = LabBlock | Merged | LectureCell | null;

function isLecture(x: any): x is LectureCell {
  return x && x.type === "LECTURE";
}
function isLabBlock(x: any): x is LabBlock {
  return x && x.type === "LAB_BLOCK";
}
function isMerged(x: any): x is Merged {
  return x && x.type === "MERGED";
}

export type BranchTimetable = {
  branch: string;
  timetable: Record<string, Record<number, Cell>>;
};

export default function TimetableGrid({
  titleRight,
  subtitleLeft,
  timetable,
  editable = false,
  onMoveCell,
}: {
  titleRight: string;
  subtitleLeft: string;
  timetable: Record<string, Record<number, Cell>>;
  editable?: boolean;
  onMoveCell?: (args:
    | { kind: "LECTURE"; fromDay: string; fromP: number; toDay: string; toP: number }
    | { kind: "LAB_ROW"; fromDay: string; fromP: number; toDay: string; toP: number; batch: string }
  ) => void | { ok: true } | { ok: false; reason: string };
}) {
  const [dndError, setDndError] = React.useState<string>("");

  function onDragEnd(result: DropResult) {
    if (!editable || !onMoveCell) return;

    const { source, destination, draggableId } = result;
    if (!destination) return;

    const [fromDay, fromPStr] = source.droppableId.split("-");
    const [toDay, toPStr] = destination.droppableId.split("-");

    const fromP = Number(fromPStr);
    const toP = Number(toPStr);

    if (!fromDay || !toDay || !fromP || !toP) return;
    if (fromDay === toDay && fromP === toP) return;

    const fromCell = timetable?.[fromDay]?.[fromP] ?? null;
    if (!fromCell) return;

    type DragKind = "LECTURE" | "LAB_ROW";
    const kind: DragKind = draggableId.startsWith("labrow-") ? "LAB_ROW" : "LECTURE";

    // LAB ROW DRAG
    if (kind === "LAB_ROW") {
      const parts = draggableId.split("-");
      const batch = parts[3];

      if (!isLabBlock(fromCell)) return;
      if (fromP % 2 === 0) return;

      const targetStartP = toP % 2 === 0 ? toP - 1 : toP;
      if (targetStartP < 1) return;

      const toCell = timetable?.[toDay]?.[targetStartP] ?? null;
      const toCell2 = timetable?.[toDay]?.[targetStartP + 1] ?? null;

      if (isLecture(toCell) || isLecture(toCell2)) return;

      const empty2hOK = toCell === null && toCell2 === null;

      const existingLabOK =
        isLabBlock(toCell) &&
        (toCell2 === null || (isMerged(toCell2) && (toCell2 as any).into === targetStartP));

      if (isMerged(toCell)) return;

      if (!(empty2hOK || existingLabOK)) return;

      const res = onMoveCell({
        kind: "LAB_ROW",
        fromDay,
        fromP,
        toDay,
        toP: targetStartP,
        batch,
      });

      if (res && (res as any).ok === false) {
        setDndError((res as any).reason || "Move blocked.");
      }
      return;
    }

    // LECTURE DRAG
    if (!isLecture(fromCell)) return;

    const toCell = timetable?.[toDay]?.[toP] ?? null;
    if (isMerged(toCell) || isLabBlock(toCell)) return;

    if (toCell && !isLecture(toCell)) return;

    const res = onMoveCell({ kind: "LECTURE", fromDay, fromP, toDay, toP });
    if (res && (res as any).ok === false) {
      setDndError((res as any).reason || "Move blocked.");
    }
  }

  const footerInfo = React.useMemo(() => {
    const teacherSet = new Set<string>();
    const roomSet = new Set<string>();
    const subjectSet = new Set<string>();
    const labSet = new Set<string>();

    for (const day of DAYS) {
      for (const p of PERIODS.map((x) => x.p)) {
        const cell = timetable?.[day]?.[p];
        if (!cell) continue;

        if ((cell as any).type === "LAB_BLOCK") {
          for (const row of (cell as any).batches || []) {
            if (row.teacher) teacherSet.add(row.teacher);
            if (row.roomFull) roomSet.add(row.roomFull);
            if (row.labShort) labSet.add(row.labShort);
          }
        }

        if ((cell as any).type === "LECTURE") {
          const c: any = cell;
          if (c.teacher) teacherSet.add(c.teacher);
          if (c.room) roomSet.add(c.room);
          if (c.subjectShort) subjectSet.add(c.subjectShort);
        }
      }
    }

    return {
      teachers: Array.from(teacherSet).sort(),
      rooms: Array.from(roomSet).sort(),
      subjects: Array.from(subjectSet).sort(),
      labs: Array.from(labSet).sort(),
    };
  }, [timetable]);

  return (
    <div className="paper p-4 print-all">
      {dndError && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-black p-4 max-w-md w-full space-y-3">
            <div className="font-bold">Move blocked</div>
            <div className="text-sm">{dndError}</div>
            <button className="px-3 py-2 border border-black text-sm" onClick={() => setDndError("")}>
              OK
            </button>
          </div>
        </div>
      )}

      <div className="tt-print-scale">
        <div className="text-center">
          <div className="text-xl header-bold">USHA MITTAL INSTITUTE OF TECHNOLOGY</div>
          <div className="text-xs mt-1 flex justify-between">
            <div className="font-semibold">{subtitleLeft}</div>
            <div className="font-semibold">{titleRight}</div>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto">
            <div className="mt-3 grid-border">
              <div className="grid" style={{ gridTemplateColumns: "80px repeat(4, 112px) 90px repeat(4, 112px)" }}>
                <div className="grid-border p-2 text-sm font-bold text-center">Day</div>

                {PERIODS.slice(0, 4).map((x) => (
                  <div key={x.p} className="grid-border p-2 text-sm font-bold text-center">
                    <div>{x.label}</div>
                    <div className="text-[11px] font-semibold opacity-80">{x.time}</div>
                  </div>
                ))}

                <div className="grid-border p-2 text-sm font-bold text-center">LUNCH BREAK</div>

                {PERIODS.slice(4).map((x) => (
                  <div key={x.p} className="grid-border p-2 text-sm font-bold text-center">
                    <div>{x.label}</div>
                    <div className="text-[11px] font-semibold opacity-80">{x.time}</div>
                  </div>
                ))}
              </div>

              {DAYS.map((day) => (
                <div
                  key={day}
                  className="grid"
                  style={{ gridTemplateColumns: "80px repeat(4, 112px) 90px repeat(4, 112px)" }}
                >
                  <div className="grid-border p-2 text-sm font-bold text-center">{day.slice(0, 2)}</div>

                  {renderPeriodRow({ day, dayData: timetable?.[day] ?? {}, startP: 1, endP: 4, editable })}

                  <div className="grid-border p-2 text-xs text-center font-semibold">Lunch</div>

                  {renderPeriodRow({ day, dayData: timetable?.[day] ?? {}, startP: 5, endP: 8, editable })}
                </div>
              ))}
            </div>
          </div>
        </DragDropContext>

        <div className="mt-4 grid grid-cols-3 gap-4 text-[11px]">
          <div>
            <div className="font-bold mb-1">Teachers:</div>
            <div className="space-y-0.5">
              {footerInfo.teachers.map((t) => (
                <div key={t} className="truncate">
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="font-bold mb-1">Classrooms / Labs:</div>
            <div className="space-y-0.5">
              {footerInfo.rooms.map((r) => (
                <div key={r} className="truncate">
                  {r}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="font-bold mb-1">Subjects / Labs:</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-semibold mb-1">Subjects</div>
                <div className="space-y-0.5">
                  {footerInfo.subjects.map((s) => (
                    <div key={s} className="truncate">
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-semibold mb-1">Labs</div>
                <div className="space-y-0.5">
                  {footerInfo.labs.map((l) => (
                    <div key={l} className="truncate">
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 text-xs">
          <div className="text-center font-semibold">Time Table Incharge</div>
          <div className="text-center font-semibold">Principal</div>
          <div className="text-center font-semibold">Class Coordinator</div>
        </div>
      </div>
    </div>
  );
}

function CellBox({
  cell,
  day,
  p,
  editable,
}: {
  cell: Cell;
  day: string;
  p: number;
  editable: boolean;
}) {
  if (isMerged(cell)) {
    return <div className="grid-border tt-cell" />;
  }

  const base = "grid-border tt-cell px-2 py-2 text-[12px]";

  // ✅ LECTURE: subject left, teacher short right (like image)
  if (isLecture(cell)) {
    const tShort = (cell.teacherShort || cell.teacher || "").trim();
    return (
      <div className={`${base} flex flex-col justify-center`}>
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold tt-subject truncate">{cell.subjectShort}</div>
          <div className="text-[11px] font-bold opacity-90">{tShort}</div>
        </div>
        <div className="opacity-80 text-[11px] truncate">{cell.room}</div>
      </div>
    );
  }

  // ✅ LAB: lab left, teacher short right per batch row
  if (isLabBlock(cell)) {
    return (
      <div className={`${base} p-0`}>
        <div className="tt-cell-inner flex flex-col">
          {cell.batches.map((b, idx) => {
            const tShort = (b.teacherShort || b.teacher || "").trim();
            return (
              <Draggable
                key={b.batch}
                draggableId={`labrow-${day}-${p}-${b.batch}`}
                index={idx}
                isDragDisabled={!editable}
              >
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`tt-lab-row px-2 py-1 text-[11px] flex justify-between items-center ${
                      idx !== cell.batches.length - 1 ? "border-b border-black" : ""
                    }`}
                  >
                    <div className="font-semibold truncate">
                      {b.batch} - {b.labShort}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-[11px] font-bold opacity-90">{tShort}</div>
                      <div className="room truncate">{b.roomShort}</div>
                    </div>
                  </div>
                )}
              </Draggable>
            );
          })}
        </div>
      </div>
    );
  }

  return <div className={base} />;
}

function DroppableSlot({
  droppableId,
  editable,
  cell,
  children,
}: {
  droppableId: string;
  editable: boolean;
  cell: Cell;
  children: React.ReactNode;
}) {
  const dropDisabled =
    !editable ||
    (isMerged(cell) && !(cell.into && typeof cell.into === "number"));

  return (
    <Droppable droppableId={droppableId} isDropDisabled={dropDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={snapshot.isDraggingOver ? "bg-black/5" : ""}
        >
          {children}
          {provided.placeholder as any}
        </div>
      )}
    </Droppable>
  );
}


function renderPeriodRow({
  day,
  dayData,
  startP,
  endP,
  editable,
}: {
  day: string;
  dayData: Record<number, Cell>;
  startP: number;
  endP: number;
  editable: boolean;
}) {
  const cells: React.ReactNode[] = [];
  let p = startP;

  while (p <= endP) {
    const cell = dayData[p] ?? null;

    if (isMerged(cell)) {
      p += 1;
      continue;
    }

    if (isLabBlock(cell)) {
      const droppableId = `${day}-${p}`;

      cells.push(
        <div key={p} style={{ gridColumn: "span 2" }}>
          <DroppableSlot droppableId={droppableId} editable={editable} cell={cell}>
            <CellBox cell={cell} day={day} p={p} editable={editable} />
          </DroppableSlot>
        </div>
      );

      p += 2;
      continue;
    }

    const droppableId = `${day}-${p}`;
    if (isLecture(cell)) {
      const draggableId = `lec-${day}-${p}`;
      cells.push(
        <div key={p}>
          <DroppableSlot droppableId={droppableId} editable={editable} cell={cell}>
            <Draggable draggableId={draggableId} index={0} isDragDisabled={!editable}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                  <CellBox cell={cell} day={day} p={p} editable={editable} />
                </div>
              )}
            </Draggable>
          </DroppableSlot>
        </div>
      );
      p += 1;
      continue;
    }

    cells.push(
      <div key={p}>
        <DroppableSlot droppableId={droppableId} editable={editable} cell={cell}>
          <CellBox cell={cell} day={day} p={p} editable={editable} />
        </DroppableSlot>
      </div>
    );
    p += 1;
  }

  return cells;
}
