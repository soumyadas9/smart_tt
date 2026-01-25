const BASE = "http://localhost:5000";

export type Branch = { id: number; name: string };
export type Lab = { id: number; name: string; short: string };
export type Teacher = { id: number; name: string };
export type Room = { id: number; code: string };
export type Subject = { id: number; name: string; short: string };
export type LectureRoom = { id: number; code: string };

export async function getSubjects(): Promise<Subject[]> {
  const r = await fetch(`${BASE}/subjects`);
  return r.json();
}

export async function getLectureRooms(): Promise<LectureRoom[]> {
  const r = await fetch(`${BASE}/lecture-rooms`);
  return r.json();
}

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

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Failed to save subject mapping (${r.status})`);
}
export async function deleteBranchLab(branchId: number, labId: number) {
  await fetch(`${BASE}/branch-labs`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, labId }),
  });
}
export async function deleteBranchSubject(branchId: number, subjectId: number) {
  const r = await fetch(`${BASE}/branch-subjects`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, subjectId }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Failed to delete subject mapping (${r.status})`);
}


export async function getBranches(): Promise<Branch[]> {
  const r = await fetch(`${BASE}/branches`);
  return r.json();
}
export async function createBranch(name: string) {
  await fetch(`${BASE}/branches`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
}

export async function getLabs(): Promise<Lab[]> {
  const r = await fetch(`${BASE}/labs`);
  return r.json();
}
export async function createLab(name: string, short: string) {
  await fetch(`${BASE}/labs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, short }) });
}

export async function getTeachers(): Promise<Teacher[]> {
  const r = await fetch(`${BASE}/teachers`);
  return r.json();
}
export async function createTeacher(name: string) {
  await fetch(`${BASE}/teachers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
}

export async function getRooms(): Promise<Room[]> {
  const r = await fetch(`${BASE}/rooms`);
  return r.json();
}
export async function createRoom(code: string) {
  await fetch(`${BASE}/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
}

export async function getBranchLabs(branchId: number) {
  const r = await fetch(`${BASE}/branch-labs/${branchId}`);
  return r.json();
}

export async function upsertBranchLab(branchId: number, labId: number, teacherId: number, roomId: number) {
  await fetch(`${BASE}/branch-labs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, labId, teacherId, roomId }),
  });
}

export async function generateLabsOnly(branchIds: number[]) {
  const r = await fetch(`${BASE}/generate/labs-only`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchIds }),
  });
  return r.json();
}
export async function generateFull(branchIds: number[]) {
  const r = await fetch(`${BASE}/generate/full`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchIds }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error || `Generate failed (${r.status})`);
  }
  return data;
}
