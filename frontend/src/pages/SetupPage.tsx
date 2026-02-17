import React, { useEffect, useMemo, useState } from "react";
import {
  getBranches,
  getLabs,
  getRooms,
  getTeachers,
  getBranchLabs,
  upsertBranchLab,
  deleteBranchLab,
  getSubjects,
  getLectureRooms,
  getBranchSubjects,
  upsertBranchSubject,
  deleteBranchSubject,
  getBranchLabBatches,
  upsertBranchLabBatch,
  deleteBranchLabBatch,
  getSettings,
  updateSettings,
  type TimetableSettings,
  type Branch,
  type Lab,
  type Teacher,
  type Room,
  type Subject,
  type LectureRoom,
} from "../api";

function makeBatches(classStrength: number, batchSize: number) {
  const n = Math.max(1, Math.ceil(Math.max(1, classStrength) / Math.max(1, batchSize)));
  return Array.from({ length: n }, (_, i) => `B${i + 1}`);
}

type BatchMap = Record<string, { teacherId: number | ""; roomId: number | "" }>;

export default function SetupPage({
  onReadyGenerate,
}: {
  onReadyGenerate: (
    branchIds: number[],
    config: { classStrength: number; batchSize: number }
  ) => Promise<void> | void;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [labRooms, setLabRooms] = useState<Room[]>([]);
  const [lectureRooms, setLectureRooms] = useState<LectureRoom[]>([]);
  const [labBatchRows, setLabBatchRows] = useState<any[]>([]);

  const [classStrength, setClassStrength] = useState<number>(80);
  const [batchSize, setBatchSize] = useState<number>(20);
  const batches = useMemo(() => makeBatches(classStrength, batchSize), [classStrength, batchSize]);

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);

  const [branchLabRows, setBranchLabRows] = useState<any[]>([]);
  const [branchSubjectRows, setBranchSubjectRows] = useState<any[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ✅ NEW: Schedule Settings (defaults match current hardcoded timetable)
  const [workingDaysCount, setWorkingDaysCount] = useState<number>(5);
  const [startTime, setStartTime] = useState("08:30");
  const [endTime, setEndTime] = useState("17:15");
  const [lunchStart, setLunchStart] = useState("12:30");
  const [lunchEnd, setLunchEnd] = useState("13:15");

  async function refreshAll() {
    const [b, l, s, t, lr, lecr, st] = await Promise.all([
      getBranches(),
      getLabs(),
      getSubjects(),
      getTeachers(),
      getRooms(),
      getLectureRooms(),
      getSettings(),
    ]);

    setBranches(b);
    setLabs(l);
    setSubjects(s);
    setTeachers(t);
    setLabRooms(lr);
    setLectureRooms(lecr);

    // load persisted settings into UI
    if (st) {
      setWorkingDaysCount(st.workingDaysCount ?? 5);
      setStartTime(st.startTime ?? "08:30");
      setEndTime(st.endTime ?? "17:15");
      setLunchStart(st.lunchStart ?? "12:30");
      setLunchEnd(st.lunchEnd ?? "13:15");
    }

    if (!selectedBranchId && b.length) setSelectedBranchId(b[0].id);
    setSelectedBranchIds((prev) => (prev.length ? prev : []));
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshBranchMappings(branchId: number) {
    const [labMap, subjMap, labBatchMap] = await Promise.all([
      getBranchLabs(branchId),
      getBranchSubjects(branchId),
      getBranchLabBatches(branchId),
    ]);
    setBranchLabRows(Array.isArray(labMap) ? labMap : []);
    setBranchSubjectRows(Array.isArray(subjMap) ? subjMap : []);
    setLabBatchRows(Array.isArray(labBatchMap) ? labBatchMap : []);
  }

  useEffect(() => {
    if (!selectedBranchId) return;
    refreshBranchMappings(selectedBranchId);
  }, [selectedBranchId]);

  function toggleBranch(branchId: number) {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((x) => x !== branchId) : [...prev, branchId]
    );
  }

  const selectedBranchName = useMemo(
    () => branches.find((b) => b.id === selectedBranchId)?.name ?? "",
    [branches, selectedBranchId]
  );

  async function handleGenerate() {
    setError("");
    if (!selectedBranchIds.length) {
      setError("Select at least one branch to generate.");
      return;
    }

    // ✅ Save schedule settings to backend first (no parent signature change required)
    const payload: TimetableSettings = {
      workingDaysCount,
      startTime,
      endTime,
      lunchStart,
      lunchEnd,
      periodMinutes: 60,
    };

    try {
      setBusy(true);
      await updateSettings(payload);
      await onReadyGenerate(selectedBranchIds, { classStrength, batchSize });
    } catch (e: any) {
      setError(e?.message ?? "Generate failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">Smart Timetable Generator</div>
          <div className="text-sm opacity-80"></div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={busy}
          className={`px-4 py-2 rounded text-sm ${
            busy ? "bg-gray-300 text-gray-700" : "bg-black text-white"
          }`}
        >
          {busy ? "Generating..." : "Generate Timetable"}
        </button>
      </div>

      {error && (
        <div className="border border-black p-3 text-sm">
          <div className="font-bold">Error</div>
          <div className="mt-1">{error}</div>
        </div>
      )}

      {/* ✅ NEW: Schedule Settings */}
      <div className="border border-black p-4">
        <div className="font-bold mb-2">Schedule Settings</div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          <div>
            <div className="font-semibold mb-1">Working Days</div>
            <select
              className="border p-2 w-full"
              value={workingDaysCount}
              onChange={(e) => setWorkingDaysCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="font-semibold mb-1">Start</div>
            <input
              className="border p-2 w-full"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <div className="font-semibold mb-1">End</div>
            <input
              className="border p-2 w-full"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div>
            <div className="font-semibold mb-1">Lunch Start</div>
            <input
              className="border p-2 w-full"
              type="time"
              value={lunchStart}
              onChange={(e) => setLunchStart(e.target.value)}
            />
          </div>

          <div>
            <div className="font-semibold mb-1">Lunch End</div>
            <input
              className="border p-2 w-full"
              type="time"
              value={lunchEnd}
              onChange={(e) => setLunchEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="text-xs opacity-70 mt-2">
          Period duration is fixed at 60 minutes (same as current).
        </div>
      </div>

      {/* Branches to generate */}
      <div className="border border-black p-4">
        <div className="font-bold mb-2">Branches to generate</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {branches.map((b) => (
            <label key={b.id} className="flex items-center justify-between border border-black p-2">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedBranchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                />
                <div className="font-semibold">{b.name}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Configure a branch */}
      <div className="border border-black p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-bold">Configure Branch:</div>
            <select
              className="border p-2 text-sm"
              value={selectedBranchId ?? ""}
              onChange={(e) => setSelectedBranchId(Number(e.target.value))}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* batches */}
          <div className="flex gap-4 items-center">
            <div className="text-sm font-bold">Class Strength:</div>
            <input
              type="number"
              min={1}
              className="border p-2 w-28 text-sm"
              value={classStrength}
              onChange={(e) => setClassStrength(Number(e.target.value))}
            />

            <div className="text-sm font-bold">Batch Size:</div>
            <input
              type="number"
              min={1}
              className="border p-2 w-28 text-sm"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
            />
          </div>

          <div className="text-sm border border-black px-3 py-2">
            Configuring: <b>{selectedBranchName || "—"}</b>
          </div>
        </div>

        {/* LABS TABLE */}
        <div>
          <div className="font-bold mb-2">1) Configure Labs (default + optional batch-wise)</div>

          <div className="overflow-auto">
            <table className="w-full text-sm border border-black">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-black p-2 text-left">Lab</th>
                  <th className="border border-black p-2 text-left">Teacher / Batch Teachers</th>
                  <th className="border border-black p-2 text-left">Lab Room / Batch Rooms</th>
                  <th className="border border-black p-2 text-left">Save</th>
                </tr>
              </thead>

              <tbody>
                {labs.map((lab) => (
                  <BranchLabRow
                    key={lab.id}
                    lab={lab}
                    teachers={teachers}
                    rooms={labRooms}
                    selectedBranchId={selectedBranchId}
                    existing={branchLabRows.find((x) => x.lab_id === lab.id)}
                    existingBatchRows={labBatchRows.filter((x) => x.lab_id === lab.id)}
                    batches={batches}
                    onSaved={async () => {
                      if (selectedBranchId) await refreshBranchMappings(selectedBranchId);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SUBJECTS TABLE */}
        <div>
          <div className="font-bold mb-2">
            2) Configure Subjects (subject → teacher → lecture room → lectures/week)
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm border border-black">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-black p-2 text-left">Subject</th>
                  <th className="border border-black p-2 text-left">Teacher</th>
                  <th className="border border-black p-2 text-left">Lecture Room</th>
                  <th className="border border-black p-2 text-left">Lectures / week</th>
                  <th className="border border-black p-2 text-left">Save</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subj) => (
                  <BranchSubjectRow
                    key={subj.id}
                    subject={subj}
                    teachers={teachers}
                    lectureRooms={lectureRooms}
                    selectedBranchId={selectedBranchId}
                    existing={branchSubjectRows.find((x) => x.subject_id === subj.id)}
                    onSaved={async () => {
                      if (selectedBranchId) await refreshBranchMappings(selectedBranchId);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs opacity-70 mt-2">
            Stored in <code>branch_subjects</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

function BranchLabRow({
  lab,
  teachers,
  rooms,
  selectedBranchId,
  existing,
  existingBatchRows,
  batches,
  onSaved,
}: any) {
  const [teacherId, setTeacherId] = useState<number | "">("");
  const [roomId, setRoomId] = useState<number | "">("");

  const [useBatch, setUseBatch] = useState(false);
  const [batchMap, setBatchMap] = useState<BatchMap>({});

  useEffect(() => {
    setTeacherId(existing?.teacher_id ?? "");
    setRoomId(existing?.room_id ?? "");
  }, [existing?.teacher_id, existing?.room_id]);

  useEffect(() => {
    const map: BatchMap = {};
    for (const b of batches || []) map[b] = { teacherId: "", roomId: "" };

    for (const r of existingBatchRows || []) {
      const b = r.batch;
      if (!b) continue;
      map[b] = { teacherId: r.teacher_id ?? "", roomId: r.room_id ?? "" };
    }

    const anySaved = (existingBatchRows || []).length > 0;
    setUseBatch(anySaved);
    setBatchMap(map);
  }, [existingBatchRows, batches]);

  useEffect(() => {
    if (!useBatch) return;
    setBatchMap((prev) => {
      const next = { ...prev };
      for (const b of batches || []) {
        if (!next[b]) next[b] = { teacherId: "", roomId: "" };
        if (!next[b].teacherId && teacherId) next[b].teacherId = teacherId;
        if (!next[b].roomId && roomId) next[b].roomId = roomId;
      }
      return next;
    });
  }, [useBatch, batches, teacherId, roomId]);

  const canSaveDefault = !!selectedBranchId && !!teacherId && !!roomId;

  const canSaveBatch =
    !!selectedBranchId &&
    useBatch &&
    (batches || []).every((b: string) => batchMap?.[b]?.teacherId && batchMap?.[b]?.roomId);

  return (
    <tr>
      <td className="border border-black p-2 align-top">
        <div className="font-semibold">{lab.short}</div>
        <div className="text-xs opacity-70">{lab.name}</div>

        <label className="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={useBatch} onChange={(e) => setUseBatch(e.target.checked)} />
          <span>Different teacher/room per batch</span>
        </label>
      </td>

      <td className="border border-black p-2 align-top">
        {!useBatch ? (
          <select
            className="border p-2 w-full"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select</option>
            {teachers.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            {(batches || []).map((b: string) => (
              <div key={b} className="flex items-center gap-2">
                <div className="w-12 text-xs font-bold">{b}</div>
                <select
                  className="border p-1 w-full text-xs"
                  value={batchMap?.[b]?.teacherId ?? ""}
                  onChange={(e) =>
                    setBatchMap((prev) => ({
                      ...prev,
                      [b]: {
                        ...(prev[b] || { teacherId: "", roomId: "" }),
                        teacherId: e.target.value ? Number(e.target.value) : "",
                      },
                    }))
                  }
                >
                  <option value="">Select</option>
                  {teachers.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </td>

      <td className="border border-black p-2 align-top">
        {!useBatch ? (
          <select
            className="border p-2 w-full"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Select</option>
            {rooms.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.code}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            {(batches || []).map((b: string) => (
              <div key={b} className="flex items-center gap-2">
                <div className="w-12 text-xs font-bold">{b}</div>
                <select
                  className="border p-1 w-full text-xs"
                  value={batchMap?.[b]?.roomId ?? ""}
                  onChange={(e) =>
                    setBatchMap((prev) => ({
                      ...prev,
                      [b]: {
                        ...(prev[b] || { teacherId: "", roomId: "" }),
                        roomId: e.target.value ? Number(e.target.value) : "",
                      },
                    }))
                  }
                >
                  <option value="">Select</option>
                  {rooms.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </td>

      <td className="border border-black p-2 align-top">
        <div className="flex gap-2">
          <button
            className={`px-3 py-2 border border-black ${
              useBatch ? (canSaveBatch ? "" : "opacity-50") : canSaveDefault ? "" : "opacity-50"
            }`}
            disabled={useBatch ? !canSaveBatch : !canSaveDefault}
            onClick={async () => {
              if (!selectedBranchId) return;

              try {
                let fallbackTeacherId = teacherId;
                let fallbackRoomId = roomId;

                if (useBatch) {
                  const firstBatch = (batches || [])[0];
                  const firstRow = firstBatch ? batchMap?.[firstBatch] : null;

                  if (!fallbackTeacherId) fallbackTeacherId = firstRow?.teacherId ?? "";
                  if (!fallbackRoomId) fallbackRoomId = firstRow?.roomId ?? "";
                }

                if (!fallbackTeacherId || !fallbackRoomId) {
                  alert("Please select default teacher+room OR fill B1 batch teacher+room.");
                  return;
                }

                await upsertBranchLab(
                  selectedBranchId,
                  lab.id,
                  fallbackTeacherId as number,
                  fallbackRoomId as number
                );

                if (useBatch) {
                  for (const b of batches || []) {
                    const row = batchMap[b];
                    if (!row?.teacherId || !row?.roomId) continue;

                    await upsertBranchLabBatch(
                      selectedBranchId,
                      lab.id,
                      b,
                      row.teacherId as number,
                      row.roomId as number
                    );
                  }
                } else {
                  for (const r of existingBatchRows || []) {
                    await deleteBranchLabBatch(selectedBranchId, lab.id, r.batch);
                  }
                }

                await onSaved();
              } catch (e: any) {
                console.error(e);
                alert(e?.message ?? "Failed to save lab mapping");
              }
            }}
          >
            Save
          </button>

          {existing && selectedBranchId && (
            <button
              className="px-3 py-2 border border-black"
              onClick={async () => {
                await deleteBranchLab(selectedBranchId, lab.id);
                for (const r of existingBatchRows || []) {
                  await deleteBranchLabBatch(selectedBranchId, lab.id, r.batch);
                }
                await onSaved();
              }}
            >
              Remove
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function BranchSubjectRow({ subject, teachers, lectureRooms, selectedBranchId, existing, onSaved }: any) {
  const [teacherId, setTeacherId] = useState<number | "">("");
  const [lectureRoomId, setLectureRoomId] = useState<number | "">("");
  const [lpw, setLpw] = useState<number>(3);

  useEffect(() => {
    setTeacherId(existing?.teacher_id ?? "");
    setLectureRoomId(existing?.lecture_room_id ?? "");
    setLpw(existing?.lectures_per_week ?? 3);
  }, [existing?.teacher_id, existing?.lecture_room_id, existing?.lectures_per_week]);

  const ready = !!selectedBranchId && !!teacherId && !!lectureRoomId && lpw > 0;

  return (
    <tr>
      <td className="border border-black p-2">
        <div className="font-semibold">{subject.short}</div>
        <div className="text-xs opacity-70">{subject.name}</div>
      </td>

      <td className="border border-black p-2">
        <select
          className="border p-2 w-full"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select</option>
          {teachers.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>

      <td className="border border-black p-2">
        <select
          className="border p-2 w-full"
          value={lectureRoomId}
          onChange={(e) => setLectureRoomId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select</option>
          {lectureRooms.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.code}
            </option>
          ))}
        </select>
      </td>

      <td className="border border-black p-2">
        <input
          type="number"
          min={1}
          className="border p-2 w-24"
          value={lpw}
          onChange={(e) => setLpw(Number(e.target.value))}
        />
      </td>

      <td className="border border-black p-2 flex gap-2">
        <button
          className={`px-3 py-2 border border-black ${ready ? "" : "opacity-50"}`}
          disabled={!ready}
          onClick={async () => {
            if (!selectedBranchId || !teacherId || !lectureRoomId) return;
            await upsertBranchSubject(selectedBranchId, subject.id, teacherId as number, lectureRoomId as number, lpw);
            await onSaved();
          }}
        >
          Save
        </button>

        {existing && selectedBranchId && (
          <button
            className="px-3 py-2 border border-black"
            onClick={async () => {
              await deleteBranchSubject(selectedBranchId, subject.id);
              await onSaved();
            }}
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}
