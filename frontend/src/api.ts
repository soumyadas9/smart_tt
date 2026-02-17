const BASE = "http://localhost:5000";

export type Branch = { id: number; name: string };
export type Lab = { id: number; name: string; short: string };

// ✅ UPDATED: teacher has short
export type Teacher = { id: number; name: string; short: string };

export type Room = { id: number; code: string; short?: string };
export type Subject = { id: number; name: string; short: string };
export type LectureRoom = { id: number; code: string };

async function okOrThrow(r: Response, label: string) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `${label} failed (${r.status})`);
}

/* --------------------------
   Delete endpoints
-------------------------- */
export async function deleteTeacher(id: number) {
  const r = await fetch(`${BASE}/teachers/${id}`, { method: "DELETE" });
  await okOrThrow(r, "Delete teacher");
}

export async function deleteBranch(id: number) {
  const r = await fetch(`${BASE}/branches/${id}`, { method: "DELETE" });
  await okOrThrow(r, "Delete branch");
}

export async function deleteLab(id: number) {
  const r = await fetch(`${BASE}/labs/${id}`, { method: "DELETE" });
  await okOrThrow(r, "Delete lab");
}

export async function deleteRoom(id: number) {
  const r = await fetch(`${BASE}/rooms/${id}`, { method: "DELETE" });
  await okOrThrow(r, "Delete room");
}

export async function deleteSubject(id: number) {
  const r = await fetch(`${BASE}/subjects/${id}`, { method: "DELETE" });
  await okOrThrow(r, "Delete subject");
}

export async function deleteLectureRoom(id: number) {
  const r = await fetch(`${BASE}/lecture-rooms/${id}`, { method: "DELETE" });
  await okOrThrow(r, "Delete lecture room");
}

/* --------------------------
   Subjects + Lecture Rooms
-------------------------- */
export async function getSubjects(): Promise<Subject[]> {
  const r = await fetch(`${BASE}/subjects`);
  return r.json();
}

export async function createSubject(name: string, short: string) {
  const r = await fetch(`${BASE}/subjects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, short }),
  });
  await okOrThrow(r, "Create subject");
}

export async function getLectureRooms(): Promise<LectureRoom[]> {
  const r = await fetch(`${BASE}/lecture-rooms`);
  return r.json();
}

export async function createLectureRoom(code: string) {
  const r = await fetch(`${BASE}/lecture-rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  await okOrThrow(r, "Create lecture room");
}

/* --------------------------
   Branch Subjects
-------------------------- */
export async function getBranchSubjects(branchId: number) {
  const r = await fetch(`${BASE}/branch-subjects/${branchId}`);
  return r.json();
}

export async function upsertBranchSubject(
  branchId: number,
  subjectId: number,
  teacherId: number,
  lectureRoomId: number,
  lecturesPerWeek: number
) {
  const r = await fetch(`${BASE}/branch-subjects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, subjectId, teacherId, lectureRoomId, lecturesPerWeek }),
  });
  await okOrThrow(r, "Save subject mapping");
}

export async function deleteBranchSubject(branchId: number, subjectId: number) {
  const r = await fetch(`${BASE}/branch-subjects`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, subjectId }),
  });
  await okOrThrow(r, "Delete subject mapping");
}

/* --------------------------
   Branches
-------------------------- */
export async function getBranches(): Promise<Branch[]> {
  const r = await fetch(`${BASE}/branches`);
  return r.json();
}

export async function createBranch(name: string) {
  const r = await fetch(`${BASE}/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  await okOrThrow(r, "Create branch");
}

/* --------------------------
   Labs
-------------------------- */
export async function getLabs(): Promise<Lab[]> {
  const r = await fetch(`${BASE}/labs`);
  return r.json();
}

export async function createLab(name: string, short: string) {
  const r = await fetch(`${BASE}/labs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, short }),
  });
  await okOrThrow(r, "Create lab");
}

/* --------------------------
   Teachers (UPDATED)
-------------------------- */
export async function getTeachers(): Promise<Teacher[]> {
  const r = await fetch(`${BASE}/teachers`);
  return r.json();
}

// ✅ UPDATED: send short as well
export async function createTeacher(name: string, short: string) {
  const r = await fetch(`${BASE}/teachers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, short }),
  });
  await okOrThrow(r, "Create teacher");
}

/* --------------------------
   Rooms (Lab Rooms)
-------------------------- */
export async function getRooms(): Promise<Room[]> {
  const r = await fetch(`${BASE}/rooms`);
  return r.json();
}

export async function createRoom(code: string, short?: string) {
  const r = await fetch(`${BASE}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, short }),
  });
  await okOrThrow(r, "Create room");
}

/* --------------------------
   Branch Labs (default mapping)
-------------------------- */
export async function getBranchLabs(branchId: number) {
  const r = await fetch(`${BASE}/branch-labs/${branchId}`);
  return r.json();
}

export async function upsertBranchLab(branchId: number, labId: number, teacherId: number, roomId: number) {
  const r = await fetch(`${BASE}/branch-labs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, labId, teacherId, roomId }),
  });
  await okOrThrow(r, "Save lab mapping");
}

export async function deleteBranchLab(branchId: number, labId: number) {
  const r = await fetch(`${BASE}/branch-labs`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, labId }),
  });
  await okOrThrow(r, "Delete lab mapping");
}

/* --------------------------
   Branch Lab Batches (batch-wise mapping)
-------------------------- */
export async function getBranchLabBatches(branchId: number) {
  const r = await fetch(`${BASE}/branch-lab-batches/${branchId}`);
  return r.json();
}

export async function upsertBranchLabBatch(
  branchId: number,
  labId: number,
  batch: string,
  teacherId: number,
  roomId: number
) {
  const r = await fetch(`${BASE}/branch-lab-batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, labId, batch, teacherId, roomId }),
  });
  await okOrThrow(r, "Save lab batch mapping");
}

export async function deleteBranchLabBatch(branchId: number, labId: number, batch: string) {
  const r = await fetch(`${BASE}/branch-lab-batches`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, labId, batch }),
  });
  await okOrThrow(r, "Delete lab batch mapping");
}

/* --------------------------
   Generate endpoints
-------------------------- */
export async function generateLabsOnly(
  branchIds: number[],
  config?: { classStrength: number; batchSize: number }
) {
  const r = await fetch(`${BASE}/generate/labs-only`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchIds,
      classStrength: config?.classStrength,
      batchSize: config?.batchSize,
    }),
  });
  return r.json();
}

export async function generateFull(
  branchIds: number[],
  config?: { classStrength: number; batchSize: number }
) {
  const r = await fetch(`${BASE}/generate/full`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branchIds,
      classStrength: config?.classStrength,
      batchSize: config?.batchSize,
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Generate failed (${r.status})`);
  return data;
}
