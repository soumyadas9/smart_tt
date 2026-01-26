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
  type Branch,
  type Lab,
  type Teacher,
  type Room,
  type Subject,
  type LectureRoom,
} from "../api";


export default function SetupPage({
  onReadyGenerate,
}: {
  onReadyGenerate: (branchIds: number[]) => Promise<void> | void;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [labRooms, setLabRooms] = useState<Room[]>([]);
  const [lectureRooms, setLectureRooms] = useState<LectureRoom[]>([]);

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);

  const [branchLabRows, setBranchLabRows] = useState<any[]>([]);
  const [branchSubjectRows, setBranchSubjectRows] = useState<any[]>([]);


  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refreshAll() {
    const [b, l, s, t, lr, lecr] = await Promise.all([
      getBranches(),
      getLabs(),
      getSubjects(),
      getTeachers(),
      getRooms(),
      getLectureRooms(),
    ]);

    setBranches(b);
    setLabs(l);
    setSubjects(s);
    setTeachers(t);
    setLabRooms(lr);
    setLectureRooms(lecr);

    if (!selectedBranchId && b.length) setSelectedBranchId(b[0].id);
    setSelectedBranchIds((prev) => (prev.length ? prev : []));

  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshBranchMappings(branchId: number) {
    const [labMap, subjMap] = await Promise.all([
      getBranchLabs(branchId),
      getBranchSubjects(branchId),
    ]);
    setBranchLabRows(Array.isArray(labMap) ? labMap : []);
    setBranchSubjectRows(Array.isArray(subjMap) ? subjMap : []);
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
    try {
      setBusy(true);
      await onReadyGenerate(selectedBranchIds);
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
          <div className="text-sm opacity-80">
            Select branches → Configure branch mappings (Labs + Subjects) → Generate
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={busy}
          className={`px-4 py-2 rounded text-sm ${busy ? "bg-gray-300 text-gray-700" : "bg-black text-white"}`}
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

          <div className="text-sm border border-black px-3 py-2">
            Configuring: <b>{selectedBranchName || "—"}</b>
          </div>
        </div>

        {/* LABS TABLE */}
        <div>
          <div className="font-bold mb-2">1) Configure Labs (lab → teacher → lab room)</div>
          <div className="overflow-auto">
            <table className="w-full text-sm border border-black">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-black p-2 text-left">Lab</th>
                  <th className="border border-black p-2 text-left">Teacher</th>
                  <th className="border border-black p-2 text-left">Lab Room</th>
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
          <div className="font-bold mb-2">2) Configure Subjects (subject → teacher → lecture room → lectures/week)</div>
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
            If lectures still don’t show after mapping subjects, it means the subject mappings weren’t saved into{" "}
            <code>branch_subjects</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

function BranchLabRow({ lab, teachers, rooms, selectedBranchId, existing, onSaved }: any) {
  const [teacherId, setTeacherId] = useState<number | "">("");
  const [roomId, setRoomId] = useState<number | "">("");

  useEffect(() => {
    setTeacherId(existing?.teacher_id ?? "");
    setRoomId(existing?.room_id ?? "");
  }, [existing?.teacher_id, existing?.room_id]);

  const ready = !!selectedBranchId && !!teacherId && !!roomId;

  return (
    <tr>
      <td className="border border-black p-2">
        <div className="font-semibold">{lab.short}</div>
        <div className="text-xs opacity-70">{lab.name}</div>
      </td>
      <td className="border border-black p-2">
        <select className="border p-2 w-full" value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))}>
          <option value="">Select</option>
          {teachers.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="border border-black p-2">
        <select className="border p-2 w-full" value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
          <option value="">Select</option>
          {rooms.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.code}
            </option>
          ))}
        </select>
      </td>
      <td className="border border-black p-2 flex gap-2">
  <button
    className="px-3 py-2 border border-black"
    disabled={!selectedBranchId || !teacherId || !roomId}
    onClick={async () => {
      if (!selectedBranchId || !teacherId || !roomId) return;
      await upsertBranchLab(selectedBranchId, lab.id, teacherId as number, roomId as number);
      await onSaved();
    }}
  >
    Save
  </button>

  {existing && selectedBranchId && (
    <button
      className="px-3 py-2 border border-black"
      onClick={async () => {
        await deleteBranchLab(selectedBranchId, lab.id);
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
        <select className="border p-2 w-full" value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))}>
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
          onChange={(e) => setLectureRoomId(Number(e.target.value))}
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
      await upsertBranchSubject(
        selectedBranchId,
        subject.id,
        teacherId as number,
        lectureRoomId as number,
        lpw
      );
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
