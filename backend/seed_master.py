# backend/seed_master.py
from db import init_db, get_conn

TEACHER_BLOCK = r"""
Sharmila A. K (/S. A. K) - M-II
Dr. Sushma Shreshta (/SS) - M-II, FLAPS, PnS
Dr. Jyoti Squera (/JS)- EC, EC LAB
Dr. Pravin Nikam (PN)- EP, EP LAB
Dr. Vilas Kharat (VK)- EGD LAB II, PE
Manoj Ghag (MG)- EGD LAB II
Ms. Vanashree Ramteke (/VR)- CAO, DE LAB, IKS
Ms. Shraddha Rokade (/SR)- BaT, JP, JP LAB, AI, AI LAB
Ms. Poonam Dhurpawar (/P)- GT, OOMD, DV LAB, DV
Ms. Pratibha Mahakal (/PM)- BEE LAB, BEE, DMl
Ms. Iffat Kazi (/IK)- CD LAB, CD, PPS LAB, CAO, JP LAB
Ms. Aarti Damani (/AD)
Dr. Santoshi Pote (/SP)- PM, P, VLSI
Ms. Pooja Jambale (/PJ)- IPDC
Ms. Poonam V. (/PV)- CCFH, CCFH LAB, OS, OS LAB
Ms. Samidha (/S)- OS, PM, JP LAB
Dr. Akhilesh Pande (AP)- MT, IPDC, IPDC LAB
Ms. Sheetal Mahatre (/SM)- BEE, BEE LAB
Ms. Prachi Natu (/PN)- NNDL LAB, NNDL, IOS, MAD LAB
Mr. Sanjay Ranveer (SM)- MAD LAB, MAD, EoIkT, PM, ES
Mr. Sudhakar Yerme (M)- CN, CNL, JP LAB, ES
Ms. Neha Aathawale (/NA)- MAD, FLAPS, MAD LAB, DE LAB, DE
Ms. Toshi Jain (/TJ)- DAA, DAA LAB, PPS LAB, PPS
Snehal Bindu (/SB)- PPS, PPS LAB
Visiting Faculty EVS ()
Supriya Ingale (/SI)- MAD, MAD LAB, ML, ML LAB
Sonal Kadam (/SK)-PPS, PPS LAB, CD, CD LAB
Shennaz Siddiqui (/SS)- AI, AI LAB, DE LAB, DE
Visiting faculty IoT- IoT
Dr. Nema Shikha (/NS)- DM, DMl, P
Dr. Sanjay Shitole (SS)- ML LAB, ML, P
Ms. Rajani Nair (/RN)- ATC
Dr. Kavita Mhatre (/KM)- IoT, P, ES
Mr. Bharat Patil (BP)- EFT, Ewtt, P, IoT
Mr. Yashawant Kale (YK)- M, MaM, P, Ml
Dr. Seema Hanchate (/SH)- CNL, CN, P
Mrs. Kumud Wasnik (/KW)- P, DBMP, DBMP LAB
Mr. Ajay Lahane (AL)- P, DE, MaM LAB, Mam, DE LAB
Ms. Kiran dange (/KD)- P, P, WTt, FLAPS, Wtl
Ms.Sujata Kullur (/SK)- DAA, DAA LAB, P, PPS LAB
Mr. Sumedh Pundkar (SP)- OOMD, UJ LAB, P, JP, JP LAB
Dr. Rachana Dhanawat (/RD)- NNDL LAB, NNDL, P
Mr. Mohan Bonde (MB)- P, DAA, DAA LAB, PPS LAB
Mr. Rajesh Kolte (RK)- CN, CNL, P, SE
Dr. Anita Morey (/AJ)- AI, AI LAB, P, FL
Ms. Prachi Dhanawat (/PD)- P, DBMP,DBMP LAB
Mr. Prakash Khelage (PK)- CLE, P, SS, SS LAB
Ms. Arundhati M. (/AM)- AI LAB, AI, P
Ms. Poonam More (/PM)- OOPT, OOPS LAB, PPS, PPS LAB, DVaT
Ms. Sonali Bodekar (/SB)- PPS, UJ LAB, FSD, FSD LAB
Ms. Prajakta Gotarne (/PG)- UJ LAB, PM, NNDL LAB, NNDL
Ms. Merrin Soloman (/MS)- DBMS, MAD, MAD LAB, DBMP LAB, JP
Ms. Monica Charate (/MC)- CN, CNL, MAD LAB, DBMP LAB, JP
"""

ROOMS_BLOCK = r"""
Control & Instrument Lab
NPTEL Lab
Basic Electronics Lab
Integrated Circuits Lab
Communication Lab
Microprocessor Lab
Workshop
Applied Science Lab I
Advance Communication Lab
Power Electronics Lab
Advance EMI Lab
PG Class
English Lab
Applied Science Lab II
Research Lab
CC and M Lab
Conference Hall
New1
New2
IOT Lab
PP Lab
Drawing Hall
Electronics Project Lab

307
407
408
505
207
203
304
202
308
506
11
14
TCC-1
TCC-2
TCC-3
TCC-4
14
15
210
010
011
109
108
105
502
SCC-1
SCC-2
SCC-3
SCC-4
"""

def clean_teacher_name(left: str) -> str:
    s = left.strip()
    if "(" in s and s.endswith(")"):
        s = s[:s.rfind("(")].strip()
    return s.strip()

def split_subject_tokens(right: str) -> list[str]:
    toks = [t.strip() for t in right.split(",") if t.strip()]
    return toks

def is_lecture_room(code: str) -> bool:
    return code.isdigit()

def upsert_one(conn, table: str, col: str, value: str, extra_cols=None):
    extra_cols = extra_cols or {}
    row = conn.execute(f"SELECT id FROM {table} WHERE {col}=?", (value,)).fetchone()
    if row:
        return row["id"]
    if extra_cols:
        cols = [col] + list(extra_cols.keys())
        qs = ",".join(["?"] * len(cols))
        vals = [value] + list(extra_cols.values())
        cur = conn.execute(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({qs})", vals)
    else:
        cur = conn.execute(f"INSERT INTO {table} ({col}) VALUES (?)", (value,))
    return cur.lastrowid

def run_seed_master():
    init_db()
    with get_conn() as conn:
        for b in ["IT1", "CST1", "DS1", "ENC1", "AI1", "CE1", "IT2", "CST2", "ENC2", "DS2", "AI2", "CE2", "IT3", "CST3", "DS3", "ENC3", "AI3", "CE3", "IT4", "CST4", "DS4", "ENC4", "AI4", "CE4"]:
            upsert_one(conn, "branches", "name", b)

        for raw in [x.strip() for x in ROOMS_BLOCK.splitlines() if x.strip()]:
            if is_lecture_room(raw):
                upsert_one(conn, "lecture_rooms", "code", raw)
            else:
                upsert_one(conn, "lab_rooms", "code", raw)

        all_subjects = set()
        all_labs = set()

        for line in [x.strip() for x in TEACHER_BLOCK.splitlines() if x.strip()]:
            if "-" not in line:
                teacher_name = clean_teacher_name(line)
                upsert_one(conn, "teachers", "name", teacher_name)
                continue

            left, right = line.split("-", 1)
            teacher_name = clean_teacher_name(left)
            upsert_one(conn, "teachers", "name", teacher_name)

            tokens = split_subject_tokens(right)
            for tok in tokens:
                if "LAB" in tok.upper():
                    all_labs.add(tok)
                else:
                    all_subjects.add(tok)

        for s in sorted(all_subjects):
            upsert_one(conn, "subjects", "name", s, extra_cols={"short": s})

        for l in sorted(all_labs):
            upsert_one(conn, "labs", "name", l, extra_cols={"short": l})

        conn.commit()

    print("✅ Seeded MASTER data: teachers, subjects, labs, rooms, branches.")
    print("ℹ️ Did NOT seed branch_labs/branch_subjects. Configure per-branch from UI now.")

if __name__ == "__main__":
    run_seed_master()
