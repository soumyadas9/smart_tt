import React, { useEffect, useState } from "react";
import {
  getTeachers,
  createTeacher,
  deleteTeacher,
  deleteBranch,
  deleteLab,
  deleteRoom,
  deleteSubject,
  deleteLectureRoom,
  type Teacher,
  getBranches,
  createBranch,
  type Branch,
  getLabs,
  createLab,
  type Lab,
  getRooms,
  createRoom,
  type Room,
  getSubjects,
  createSubject,
  type Subject,
  getLectureRooms,
  createLectureRoom,
  type LectureRoom,
} from "../api";

function Card({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="border border-black p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-bold">{title}</div>
        <div className="text-xs opacity-70">Count: {count}</div>
      </div>
      {children}
    </div>
  );
}

export default function AdminPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lectureRooms, setLectureRooms] = useState<LectureRoom[]>([]);

  const [newTeacher, setNewTeacher] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newLabName, setNewLabName] = useState("");
  const [newLabShort, setNewLabShort] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectShort, setNewSubjectShort] = useState("");
  const [newLectureRoom, setNewLectureRoom] = useState("");
  const [newRoomShort, setNewRoomShort] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function refreshAll() {
    const [t, b, l, r, s, lr] = await Promise.all([
      getTeachers(),
      getBranches(),
      getLabs(),
      getRooms(),
      getSubjects(),
      getLectureRooms(),
    ]);
    setTeachers(t);
    setBranches(b);
    setLabs(l);
    setRooms(r);
    setSubjects(s);
    setLectureRooms(lr);
  }

  useEffect(() => {
    refreshAll().catch((e) => setError(String(e)));
  }, []);

  async function run(fn: () => Promise<void>) {
    setError("");
    try {
      setBusy(true);
      await fn();
      await refreshAll(); // ✅ makes the new item show immediately
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <div className="text-2xl font-bold">Admin Panel • Master Data</div>
        <div className="text-sm opacity-70">
          This data is stored permanently in SQLite (<code>backend/timetable.db</code>). If you refresh the page and it’s still
          here, it’s saved.
        </div>
      </div>

      {error && (
        <div className="border border-black p-3 text-sm">
          <div className="font-bold">Error</div>
          <div className="mt-1">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Teachers */}
        <Card title="Teachers" count={teachers.length}>
          <div className="flex gap-2">
            <input
              className="border p-2 w-full text-sm"
              value={newTeacher}
              onChange={(e) => setNewTeacher(e.target.value)}
              placeholder="Teacher name"
            />
            <button
              className="px-3 py-2 border border-black text-sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const name = newTeacher.trim();
                  if (!name) throw new Error("Teacher name required");
                  await createTeacher(name);
                  setNewTeacher("");
                })
              }
            >
              Add
            </button>
          </div>

          <div className="max-h-40 overflow-auto border border-black p-2 text-sm">
            {teachers.length === 0 ? (
              <div className="opacity-60">No teachers yet.</div>
            ) : (
              <div className="space-y-1">
  {teachers.map((t) => (
    <div key={t.id} className="flex items-center justify-between border border-black p-2">
      <div className="text-sm">{t.name}</div>
      <button
        className="px-2 py-1 border border-black text-xs"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const ok = window.confirm(`Delete teacher "${t.name}"?\nThis will also remove any mappings using them.`);
            if (!ok) return;
            await deleteTeacher(t.id);
          })
        }
      >
        Delete
      </button>
    </div>
  ))}
</div>

            )}
          </div>
        </Card>

        {/* Branches */}
        <Card title="Branches" count={branches.length}>
          <div className="flex gap-2">
            <input
              className="border p-2 w-full text-sm"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder="Branch (e.g. IT1)"
            />
            <button
              className="px-3 py-2 border border-black text-sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const name = newBranch.trim();
                  if (!name) throw new Error("Branch name required");
                  await createBranch(name);
                  setNewBranch("");
                })
              }
            >
              Add
            </button>
          </div>

          <div className="max-h-40 overflow-auto border border-black p-2 text-sm">
            {branches.length === 0 ? (
              <div className="opacity-60">No branches yet.</div>
            ) : (
              <div className="space-y-1">
  {branches.map((b) => (
    <div key={b.id} className="flex items-center justify-between border border-black p-2">
      <div className="text-sm">{b.name}</div>
      <button
        className="px-2 py-1 border border-black text-xs"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const ok = window.confirm(
              `Delete branch "${b.name}"?\nThis will also remove its subject/lab mappings.`
            );
            if (!ok) return;
            await deleteBranch(b.id);
          })
        }
      >
        Delete
      </button>
    </div>
  ))}
</div>

            )}
          </div>
        </Card>

        {/* Labs */}
        <Card title="Labs" count={labs.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              className="border p-2 text-sm"
              value={newLabName}
              onChange={(e) => setNewLabName(e.target.value)}
              placeholder="Lab name"
            />
            <input
              className="border p-2 text-sm"
              value={newLabShort}
              onChange={(e) => setNewLabShort(e.target.value)}
              placeholder="Short (optional)"
            />
          </div>
          <button
            className="px-3 py-2 border border-black text-sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const name = newLabName.trim();
                const short = (newLabShort.trim() || name).trim();
                if (!name) throw new Error("Lab name required");
                await createLab(name, short);
                setNewLabName("");
                setNewLabShort("");
              })
            }
          >
            Add Lab
          </button>

          <div className="max-h-40 overflow-auto border border-black p-2 text-sm">
            {labs.length === 0 ? (
              <div className="opacity-60">No labs yet.</div>
            ) : (
              <div className="space-y-1">
  {labs.map((l) => (
    <div key={l.id} className="flex items-center justify-between border border-black p-2">
      <div className="text-sm">
        {l.name} <span className="opacity-70">({l.short})</span>
      </div>
      <button
        className="px-2 py-1 border border-black text-xs"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const ok = window.confirm(
              `Delete lab "${l.name}"?\nThis will also remove any lab mappings using it.`
            );
            if (!ok) return;
            await deleteLab(l.id);
          })
        }
      >
        Delete
      </button>
    </div>
  ))}
</div>

            )}
          </div>
        </Card>

        {/* Lab Rooms */}
        <Card title="Lab Rooms" count={rooms.length}>
          <div className="flex gap-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
  <input
    className="border p-2 w-full text-sm"
    value={newRoom}
    onChange={(e) => setNewRoom(e.target.value)}
    placeholder="Full room name (e.g. Applied Science Lab II)"
  />
  <input
    className="border p-2 w-full text-sm"
    value={newRoomShort}
    onChange={(e) => setNewRoomShort(e.target.value)}
    placeholder="Short (optional) e.g. ASL2"
  />
</div>

<button
  className="px-3 py-2 border border-black text-sm"
  disabled={busy}
  onClick={() =>
    run(async () => {
      const code = newRoom.trim();
      const short = newRoomShort.trim();
      if (!code) throw new Error("Room required");
      await createRoom(code, short || undefined);  // ✅ pass short
      setNewRoom("");
      setNewRoomShort("");
    })
  }
>
  Add
</button>

          </div>

          <div className="max-h-40 overflow-auto border border-black p-2 text-sm">
            {rooms.length === 0 ? (
              <div className="opacity-60">No lab rooms yet.</div>
            ) : (
              <div className="space-y-1">
  {rooms.map((r) => (
    <div key={r.id} className="flex items-center justify-between border border-black p-2">
      <div className="text-sm">
  {r.code} <span className="opacity-70">({r.short || r.code})</span>
</div>

      <button
        className="px-2 py-1 border border-black text-xs"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const ok = window.confirm(
              `Delete lab room "${r.code}"?\nThis will also remove any lab mappings using it.`
            );
            if (!ok) return;
            await deleteRoom(r.id);
          })
        }
      >
        Delete
      </button>
    </div>
  ))}
</div>

            )}
          </div>
        </Card>

        {/* Subjects */}
        <Card title="Subjects" count={subjects.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              className="border p-2 text-sm"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Subject name"
            />
            <input
              className="border p-2 text-sm"
              value={newSubjectShort}
              onChange={(e) => setNewSubjectShort(e.target.value)}
              placeholder="Short (optional)"
            />
          </div>
          <button
            className="px-3 py-2 border border-black text-sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const name = newSubjectName.trim();
                const short = (newSubjectShort.trim() || name).trim();
                if (!name) throw new Error("Subject required");
                await createSubject(name, short);
                setNewSubjectName("");
                setNewSubjectShort("");
              })
            }
          >
            Add Subject
          </button>

          <div className="max-h-40 overflow-auto border border-black p-2 text-sm">
            {subjects.length === 0 ? (
              <div className="opacity-60">No subjects yet.</div>
            ) : (
              <div className="space-y-1">
  {subjects.map((s) => (
    <div key={s.id} className="flex items-center justify-between border border-black p-2">
      <div className="text-sm">
        {s.name} <span className="opacity-70">({s.short})</span>
      </div>
      <button
        className="px-2 py-1 border border-black text-xs"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const ok = window.confirm(
              `Delete subject "${s.name}"?\nThis will also remove any subject mappings using it.`
            );
            if (!ok) return;
            await deleteSubject(s.id);
          })
        }
      >
        Delete
      </button>
    </div>
  ))}
</div>

            )}
          </div>
        </Card>

        {/* Lecture Rooms */}
        <Card title="Lecture Rooms" count={lectureRooms.length}>
          <div className="flex gap-2">
            <input
              className="border p-2 w-full text-sm"
              value={newLectureRoom}
              onChange={(e) => setNewLectureRoom(e.target.value)}
              placeholder="Lecture room code (e.g. 010)"
            />
            <button
              className="px-3 py-2 border border-black text-sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const code = newLectureRoom.trim();
                  if (!code) throw new Error("Lecture room required");
                  await createLectureRoom(code);
                  setNewLectureRoom("");
                })
              }
            >
              Add
            </button>
          </div>

          <div className="max-h-40 overflow-auto border border-black p-2 text-sm">
            {lectureRooms.length === 0 ? (
              <div className="opacity-60">No lecture rooms yet.</div>
            ) : (
             <div className="space-y-1">
  {lectureRooms.map((r) => (
    <div key={r.id} className="flex items-center justify-between border border-black p-2">
      <div className="text-sm">{r.code}</div>
      <button
        className="px-2 py-1 border border-black text-xs"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const ok = window.confirm(
              `Delete lecture room "${r.code}"?\nThis will also remove any subject mappings using it.`
            );
            if (!ok) return;
            await deleteLectureRoom(r.id);
          })
        }
      >
        Delete
      </button>
    </div>
  ))}
</div>

            )}
          </div>
        </Card>
      </div>

      <div className="text-xs opacity-70">
        Quick test: Add an item → refresh page → if it’s still there, it’s saved in SQLite.
      </div>
    </div>
  );
}
