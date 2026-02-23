const BASE = "http://localhost:5000";

/* =========================
   Shared helper (cookie session support)
========================= */
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const r = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any)?.error || `Request failed (${r.status})`);
  return data;
}

/* =========================
   Types
========================= */
export type Branch = { id: number; name: string };
export type Lab = { id: number; name: string; short: string };
export type Teacher = { id: number; name: string; short: string };
export type Room = { id: number; code: string; short?: string };
export type Subject = { id: number; name: string; short: string };
export type LectureRoom = { id: number; code: string };

export type TimetableSettings = {
  workingDaysCount: number;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  lunchStart: string; // "HH:MM"
  lunchEnd: string; // "HH:MM"
  periodMinutes?: number; // default 60
};

/* =========================
   AUTH (NEW)
========================= */
export async function register(username: string, password: string) {
  return fetchWithAuth(`${BASE}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string) {
  return fetchWithAuth(`${BASE}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  return fetchWithAuth(`${BASE}/auth/logout`, { method: "POST" });
}

export async function checkAuth() {
  return fetchWithAuth(`${BASE}/auth/me`);
}

/* =========================
   Settings
========================= */
export async function getSettings(): Promise<TimetableSettings> {
  return fetchWithAuth(`${BASE}/settings`);
}

export async function updateSettings(s: TimetableSettings) {
  return fetchWithAuth(`${BASE}/settings`, {
    method: "PUT",
    body: JSON.stringify(s),
  });
}

/* =========================
   Branches
========================= */
export async function getBranches(): Promise<Branch[]> {
  return fetchWithAuth(`${BASE}/branches`);
}

export async function createBranch(name: string) {
  return fetchWithAuth(`${BASE}/branches`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteBranch(id: number) {
  return fetchWithAuth(`${BASE}/branches/${id}`, { method: "DELETE" });
}

/* =========================
   Labs
========================= */
export async function getLabs(): Promise<Lab[]> {
  return fetchWithAuth(`${BASE}/labs`);
}

export async function createLab(name: string, short: string) {
  return fetchWithAuth(`${BASE}/labs`, {
    method: "POST",
    body: JSON.stringify({ name, short }),
  });
}

export async function deleteLab(id: number) {
  return fetchWithAuth(`${BASE}/labs/${id}`, { method: "DELETE" });
}

/* =========================
   Teachers
========================= */
export async function getTeachers(): Promise<Teacher[]> {
  return fetchWithAuth(`${BASE}/teachers`);
}

export async function createTeacher(name: string, short: string) {
  return fetchWithAuth(`${BASE}/teachers`, {
    method: "POST",
    body: JSON.stringify({ name, short }),
  });
}

export async function deleteTeacher(id: number) {
  return fetchWithAuth(`${BASE}/teachers/${id}`, { method: "DELETE" });
}

/* =========================
   Rooms (Lab Rooms)
========================= */
export async function getRooms(): Promise<Room[]> {
  return fetchWithAuth(`${BASE}/rooms`);
}

export async function createRoom(code: string, short?: string) {
  return fetchWithAuth(`${BASE}/rooms`, {
    method: "POST",
    body: JSON.stringify({ code, short }),
  });
}

export async function deleteRoom(id: number) {
  return fetchWithAuth(`${BASE}/rooms/${id}`, { method: "DELETE" });
}

/* =========================
   Subjects + Lecture Rooms
========================= */
export async function getSubjects(): Promise<Subject[]> {
  return fetchWithAuth(`${BASE}/subjects`);
}

export async function createSubject(name: string, short: string) {
  return fetchWithAuth(`${BASE}/subjects`, {
    method: "POST",
    body: JSON.stringify({ name, short }),
  });
}

export async function deleteSubject(id: number) {
  return fetchWithAuth(`${BASE}/subjects/${id}`, { method: "DELETE" });
}

export async function getLectureRooms(): Promise<LectureRoom[]> {
  return fetchWithAuth(`${BASE}/lecture-rooms`);
}

export async function createLectureRoom(code: string) {
  return fetchWithAuth(`${BASE}/lecture-rooms`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function deleteLectureRoom(id: number) {
  return fetchWithAuth(`${BASE}/lecture-rooms/${id}`, { method: "DELETE" });
}

/* =========================
   Branch Labs (default mapping)  ✅ MISSING BEFORE
========================= */
export async function getBranchLabs(branchId: number) {
  return fetchWithAuth(`${BASE}/branch-labs/${branchId}`);
}

export async function upsertBranchLab(branchId: number, labId: number, teacherId: number, roomId: number) {
  return fetchWithAuth(`${BASE}/branch-labs`, {
    method: "POST",
    body: JSON.stringify({ branchId, labId, teacherId, roomId }),
  });
}

export async function deleteBranchLab(branchId: number, labId: number) {
  return fetchWithAuth(`${BASE}/branch-labs`, {
    method: "DELETE",
    body: JSON.stringify({ branchId, labId }),
  });
}

/* =========================
   Branch Subjects ✅ MISSING BEFORE
========================= */
export async function getBranchSubjects(branchId: number) {
  return fetchWithAuth(`${BASE}/branch-subjects/${branchId}`);
}

export async function upsertBranchSubject(
  branchId: number,
  subjectId: number,
  teacherId: number,
  lectureRoomId: number,
  lecturesPerWeek: number
) {
  return fetchWithAuth(`${BASE}/branch-subjects`, {
    method: "POST",
    body: JSON.stringify({ branchId, subjectId, teacherId, lectureRoomId, lecturesPerWeek }),
  });
}

export async function deleteBranchSubject(branchId: number, subjectId: number) {
  return fetchWithAuth(`${BASE}/branch-subjects`, {
    method: "DELETE",
    body: JSON.stringify({ branchId, subjectId }),
  });
}

/* =========================
   Branch Lab Batches ✅ MISSING BEFORE
========================= */
export async function getBranchLabBatches(branchId: number) {
  return fetchWithAuth(`${BASE}/branch-lab-batches/${branchId}`);
}

export async function upsertBranchLabBatch(
  branchId: number,
  labId: number,
  batch: string,
  teacherId: number,
  roomId: number
) {
  return fetchWithAuth(`${BASE}/branch-lab-batches`, {
    method: "POST",
    body: JSON.stringify({ branchId, labId, batch, teacherId, roomId }),
  });
}

export async function deleteBranchLabBatch(branchId: number, labId: number, batch: string) {
  return fetchWithAuth(`${BASE}/branch-lab-batches`, {
    method: "DELETE",
    body: JSON.stringify({ branchId, labId, batch }),
  });
}

/* =========================
   Generate endpoints
========================= */
export async function generateLabsOnly(
  branchIds: number[],
  config?: { classStrength: number; batchSize: number }
) {
  return fetchWithAuth(`${BASE}/generate/labs-only`, {
    method: "POST",
    body: JSON.stringify({
      branchIds,
      classStrength: config?.classStrength,
      batchSize: config?.batchSize,
    }),
  });
}

export async function generateFull(
  branchIds: number[],
  config?: { classStrength: number; batchSize: number }
) {
  return fetchWithAuth(`${BASE}/generate/full`, {
    method: "POST",
    body: JSON.stringify({
      branchIds,
      classStrength: config?.classStrength,
      batchSize: config?.batchSize,
    }),
  });
}