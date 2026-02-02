"""
UC Transfer Path Verifier - Main FastAPI Application
A tool to help California community college students verify their UC transfer eligibility
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin if not already done
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()



app = FastAPI(
    title="UC Transfer Path Verifier",
    description="Verify your UC transfer eligibility using official sources",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory sessions (for demo, not used for persistent user data)
sessions_db: Dict[str, str] = {}


# ===================== MODELS =====================

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    major: str
    community_college: str


class UserProfile(BaseModel):
    email: str
    name: str
    major: str
    community_college: str
    created_at: str


class TranscriptCourse(BaseModel):
    course_code: str
    course_name: str
    units: float
    grade: str
    semester: str


class TranscriptUpload(BaseModel):
    user_email: str
    courses: List[TranscriptCourse]


class UCSelection(BaseModel):
    user_email: str
    target_uc: str  # For demo, only "UCSC"
    target_major: str


# ===================== UCSC TRANSFER REQUIREMENTS DATA =====================
# This is mock data based on real UCSC requirements - in production, fetch from official sources

UCSC_REQUIREMENTS = {
    "Computer Science": {
        "required_courses": [
            {"name": "Calculus I", "equivalent_codes": ["MATH 1A", "MATH 3A", "MATH 181"]},
            {"name": "Calculus II", "equivalent_codes": ["MATH 1B", "MATH 3B", "MATH 182"]},
            {"name": "Linear Algebra", "equivalent_codes": ["MATH 21", "MATH 6", "MATH 250"]},
            {"name": "Introduction to Programming", "equivalent_codes": ["CS 1A", "CIS 22A", "COMSC 110"]},
            {"name": "Data Structures", "equivalent_codes": ["CS 1B", "CIS 22B", "COMSC 165"]},
            {"name": "Discrete Mathematics", "equivalent_codes": ["CS 18", "CIS 18", "MATH 55"]},
            {"name": "Physics I (Mechanics)", "equivalent_codes": ["PHYS 4A", "PHYS 1A", "PHYSIC 4A"]},
        ],
        "igetc_areas": {
            "1A": {"name": "English Composition", "required": True},
            "1B": {"name": "Critical Thinking", "required": True},
            "2": {"name": "Mathematical Concepts", "required": True},
            "3A": {"name": "Arts", "required": True},
            "3B": {"name": "Humanities", "required": True},
            "4": {"name": "Social Sciences", "required": True, "courses_needed": 3},
            "5A": {"name": "Physical Science", "required": True},
            "5B": {"name": "Biological Science", "required": True},
            "5C": {"name": "Lab Science", "required": True},
            "6A": {"name": "Language Other Than English", "required": True},
        },
        "min_gpa": 3.0,
        "min_units": 60,
        "max_units": 90,
        "notes": [
            "Selection to the major is highly competitive",
            "A GPA above 3.4 is recommended for competitive applicants",
            "All major prep courses should be completed with C or better",
        ],
        "source_url": "https://admissions.ucsc.edu/transfer/requirements"
    },
    "Biology": {
        "required_courses": [
            {"name": "General Chemistry I", "equivalent_codes": ["CHEM 1A", "CHEM 101"]},
            {"name": "General Chemistry II", "equivalent_codes": ["CHEM 1B", "CHEM 102"]},
            {"name": "Organic Chemistry I", "equivalent_codes": ["CHEM 12A", "CHEM 201"]},
            {"name": "Biology I", "equivalent_codes": ["BIOL 1A", "BIO 101", "BIOSCI 101"]},
            {"name": "Biology II", "equivalent_codes": ["BIOL 1B", "BIO 102", "BIOSCI 102"]},
            {"name": "Calculus I", "equivalent_codes": ["MATH 1A", "MATH 3A", "MATH 181"]},
            {"name": "Physics I", "equivalent_codes": ["PHYS 4A", "PHYS 1A", "PHYSIC 4A"]},
        ],
        "igetc_areas": {
            "1A": {"name": "English Composition", "required": True},
            "1B": {"name": "Critical Thinking", "required": True},
            "2": {"name": "Mathematical Concepts", "required": True},
            "3A": {"name": "Arts", "required": True},
            "3B": {"name": "Humanities", "required": True},
            "4": {"name": "Social Sciences", "required": True, "courses_needed": 3},
            "5A": {"name": "Physical Science", "required": True},
            "5B": {"name": "Biological Science", "required": True},
            "5C": {"name": "Lab Science", "required": True},
            "6A": {"name": "Language Other Than English", "required": True},
        },
        "min_gpa": 2.8,
        "min_units": 60,
        "max_units": 90,
        "notes": [
            "Strong performance in science courses is expected",
            "Research experience is recommended but not required",
        ],
        "source_url": "https://admissions.ucsc.edu/transfer/requirements"
    },
    "Psychology": {
        "required_courses": [
            {"name": "Introduction to Psychology", "equivalent_codes": ["PSYCH 1", "PSYCH 101", "PSY 1A"]},
            {"name": "Statistics", "equivalent_codes": ["STAT 1", "MATH 10", "PSYCH 7"]},
            {"name": "Research Methods", "equivalent_codes": ["PSYCH 2", "PSY 2"]},
        ],
        "igetc_areas": {
            "1A": {"name": "English Composition", "required": True},
            "1B": {"name": "Critical Thinking", "required": True},
            "2": {"name": "Mathematical Concepts", "required": True},
            "3A": {"name": "Arts", "required": True},
            "3B": {"name": "Humanities", "required": True},
            "4": {"name": "Social Sciences", "required": True, "courses_needed": 3},
            "5A": {"name": "Physical Science", "required": True},
            "5B": {"name": "Biological Science", "required": True},
            "5C": {"name": "Lab Science", "required": True},
            "6A": {"name": "Language Other Than English", "required": True},
        },
        "min_gpa": 2.5,
        "min_units": 60,
        "max_units": 90,
        "notes": [
            "Biology courses are recommended as preparation",
        ],
        "source_url": "https://admissions.ucsc.edu/transfer/requirements"
    }
}

# Sample course equivalencies (mock Assist.org data)
ASSIST_EQUIVALENCIES = {
    "De Anza College": {
        "MATH 1A": {"uc_equivalent": "MATH 19A", "units": 5, "igetc": ["2", "5A"]},
        "MATH 1B": {"uc_equivalent": "MATH 19B", "units": 5, "igetc": ["2"]},
        "MATH 21": {"uc_equivalent": "MATH 21", "units": 5, "igetc": []},
        "CIS 22A": {"uc_equivalent": "CSE 20", "units": 4.5, "igetc": []},
        "CIS 22B": {"uc_equivalent": "CSE 30", "units": 4.5, "igetc": []},
        "PHYS 4A": {"uc_equivalent": "PHYS 6A", "units": 5, "igetc": ["5A", "5C"]},
        "EWRT 1A": {"uc_equivalent": "Writing 1", "units": 5, "igetc": ["1A"]},
        "EWRT 2": {"uc_equivalent": "Writing 2", "units": 5, "igetc": ["1B"]},
        "BIOL 6A": {"uc_equivalent": "BIOE 20A", "units": 5, "igetc": ["5B", "5C"]},
        "CHEM 1A": {"uc_equivalent": "CHEM 1A", "units": 5, "igetc": ["5A", "5C"]},
        "CHEM 1B": {"uc_equivalent": "CHEM 1B", "units": 5, "igetc": ["5A"]},
    },
    "Foothill College": {
        "MATH 1A": {"uc_equivalent": "MATH 19A", "units": 5, "igetc": ["2", "5A"]},
        "MATH 1B": {"uc_equivalent": "MATH 19B", "units": 5, "igetc": ["2"]},
        "CS 1A": {"uc_equivalent": "CSE 20", "units": 4.5, "igetc": []},
        "CS 1B": {"uc_equivalent": "CSE 30", "units": 4.5, "igetc": []},
        "ENGL 1A": {"uc_equivalent": "Writing 1", "units": 5, "igetc": ["1A"]},
        "PSYC 1": {"uc_equivalent": "PSYC 1", "units": 5, "igetc": ["4"]},
    },
    "Mission College": {
        "MATH 3A": {"uc_equivalent": "MATH 19A", "units": 5, "igetc": ["2", "5A"]},
        "MATH 3B": {"uc_equivalent": "MATH 19B", "units": 5, "igetc": ["2"]},
        "COMSC 110": {"uc_equivalent": "CSE 20", "units": 4, "igetc": []},
        "COMSC 165": {"uc_equivalent": "CSE 30", "units": 4, "igetc": []},
        "ENGL 1A": {"uc_equivalent": "Writing 1", "units": 4, "igetc": ["1A"]},
    }
}


# ===================== API ENDPOINTS =====================

@app.get("/")
async def root():
    return {"message": "UC Transfer Path Verifier API", "status": "online"}


@app.post("/api/auth/register")
async def register_user(user: UserCreate):
    """Register a new user after Google OAuth"""
    user_ref = db.collection("users").document(user.email)
    doc = user_ref.get()
    if doc.exists:
        raise HTTPException(status_code=400, detail="User already exists")
    user_data = {
        "email": user.email,
        "name": user.name,
        "major": user.major,
        "community_college": user.community_college,
        "created_at": datetime.now().isoformat(),
        "transcript": [],
        "target_uc": None,
        "target_major": user.major,
        "verification_results": None
    }
    user_ref.set(user_data)
    return {"success": True, "user": user_data}


@app.get("/api/auth/user/{email}")
async def get_user(email: str):
    """Get user profile by email"""
    user_ref = db.collection("users").document(email)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    return doc.to_dict()


@app.put("/api/auth/user/{email}")
async def update_user(email: str, user: UserCreate):
    """Update user profile"""
    user_ref = db.collection("users").document(email)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = {
        "name": user.name,
        "major": user.major,
        "community_college": user.community_college,
    }
    user_ref.update(update_data)
    # Return updated user
    updated_doc = user_ref.get()
    return updated_doc.to_dict()


@app.get("/api/colleges")
async def get_community_colleges():
    """Get list of supported community colleges"""
    return {
        "colleges": [
            "De Anza College",
            "Foothill College", 
            "Mission College",
            "West Valley College",
            "Ohlone College",
            "San Jose City College",
            "Evergreen Valley College",
        ]
    }


@app.get("/api/majors")
async def get_supported_majors():
    """Get list of supported majors for UCSC"""
    return {
        "majors": list(UCSC_REQUIREMENTS.keys())
    }


@app.get("/api/uc-campuses")
async def get_uc_campuses():
    """Get list of UC campuses (demo: only UCSC)"""
    return {
        "campuses": [
            {"id": "ucsc", "name": "UC Santa Cruz", "available": True},
            {"id": "ucb", "name": "UC Berkeley", "available": False},
            {"id": "ucla", "name": "UCLA", "available": False},
            {"id": "ucsd", "name": "UC San Diego", "available": False},
            {"id": "ucd", "name": "UC Davis", "available": False},
            {"id": "uci", "name": "UC Irvine", "available": False},
            {"id": "ucr", "name": "UC Riverside", "available": False},
            {"id": "ucsb", "name": "UC Santa Barbara", "available": False},
            {"id": "ucm", "name": "UC Merced", "available": False},
        ]
    }


@app.post("/api/select-uc")
async def select_target_uc(selection: UCSelection):
    """Select target UC campus"""
    user_ref = db.collection("users").document(selection.user_email)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    if selection.target_uc.lower() != "ucsc":
        raise HTTPException(status_code=400, detail="Only UCSC is available in demo")
    user_ref.update({
        "target_uc": selection.target_uc,
        "target_major": selection.target_major
    })
    return {"success": True, "target_uc": selection.target_uc}


@app.post("/api/transcript/upload")
async def upload_transcript(transcript: TranscriptUpload):
    """Upload/enter transcript courses"""
    user_ref = db.collection("users").document(transcript.user_email)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    user_ref.update({
        "transcript": [course.dict() for course in transcript.courses]
    })
    return {"success": True, "courses_count": len(transcript.courses)}


@app.get("/api/transcript/{email}")
async def get_transcript(email: str):
    """Get user's transcript"""
    user_ref = db.collection("users").document(email)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    user_data = doc.to_dict()
    return {"courses": user_data.get("transcript", [])}


@app.post("/api/verify/{email}")
async def verify_transfer_eligibility(email: str):
    """
    Main verification endpoint - checks transcript against requirements
    Uses mock Assist.org data and UCSC requirements
    """
    user_ref = db.collection("users").document(email)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    user = doc.to_dict()

    if not user.get("target_uc"):
        raise HTTPException(status_code=400, detail="Please select a target UC first")

    if not user.get("transcript"):
        raise HTTPException(status_code=400, detail="Please upload your transcript first")

    major = user.get("target_major", user.get("major", "Computer Science"))
    if major not in UCSC_REQUIREMENTS:
        raise HTTPException(status_code=400, detail=f"Major '{major}' not supported in demo")

    requirements = UCSC_REQUIREMENTS[major]
    college = user["community_college"]
    transcript = user["transcript"]

    # Get course equivalencies for the college
    equivalencies = ASSIST_EQUIVALENCIES.get(college, {})

    # Analyze completed courses
    completed_codes = [c["course_code"].upper() for c in transcript]
    total_units = sum(c["units"] for c in transcript)

    # Calculate GPA
    grade_points = {"A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
                   "C+": 2.3, "C": 2.0, "C-": 1.7, "D+": 1.3, "D": 1.0, "F": 0.0}

    total_grade_points = 0
    graded_units = 0
    for course in transcript:
        grade = course["grade"].upper()
        if grade in grade_points:
            total_grade_points += grade_points[grade] * course["units"]
            graded_units += course["units"]

    gpa = total_grade_points / graded_units if graded_units > 0 else 0.0

    # Check major requirements
    major_requirements_status = []
    for req in requirements["required_courses"]:
        completed = False
        matched_course = None

        for code in req["equivalent_codes"]:
            if code.upper() in completed_codes:
                completed = True
                matched_course = code
                break

        major_requirements_status.append({
            "requirement": req["name"],
            "completed": completed,
            "matched_course": matched_course,
            "acceptable_courses": req["equivalent_codes"],
        })

    # Check IGETC areas
    igetc_status = {}
    completed_igetc = set()

    for code in completed_codes:
        if code in equivalencies:
            for area in equivalencies[code].get("igetc", []):
                completed_igetc.add(area)

    for area, info in requirements["igetc_areas"].items():
        igetc_status[area] = {
            "name": info["name"],
            "completed": area in completed_igetc,
            "required": info["required"],
        }

    # Identify risks and warnings
    risks = []

    if gpa < requirements["min_gpa"]:
        risks.append({
            "type": "GPA",
            "severity": "high",
            "message": f"Your GPA ({gpa:.2f}) is below the minimum requirement ({requirements['min_gpa']})",
            "source": requirements["source_url"]
        })
    elif gpa < requirements["min_gpa"] + 0.3:
        risks.append({
            "type": "GPA",
            "severity": "medium",
            "message": f"Your GPA ({gpa:.2f}) is close to the minimum. A higher GPA improves your chances.",
            "source": requirements["source_url"]
        })

    if total_units < requirements["min_units"]:
        risks.append({
            "type": "Units",
            "severity": "high",
            "message": f"You have {total_units} units but need at least {requirements['min_units']} to transfer",
            "source": requirements["source_url"]
        })

    if total_units > requirements["max_units"]:
        risks.append({
            "type": "Units",
            "severity": "medium",
            "message": f"You have {total_units} units which exceeds the {requirements['max_units']} unit cap. Some units may not transfer.",
            "source": requirements["source_url"]
        })

    # Missing major prep courses
    missing_major_prep = [r for r in major_requirements_status if not r["completed"]]
    if missing_major_prep:
        risks.append({
            "type": "Major Prep",
            "severity": "high",
            "message": f"You are missing {len(missing_major_prep)} required major preparation course(s)",
            "source": "https://assist.org"
        })

    # Missing IGETC areas
    missing_igetc = [area for area, info in igetc_status.items()
                    if info["required"] and not info["completed"]]
    if missing_igetc:
        risks.append({
            "type": "IGETC",
            "severity": "medium",
            "message": f"IGETC areas not yet satisfied: {', '.join(missing_igetc)}",
            "source": "https://assist.org/transfer/institution/113/115"
        })

    # Overall eligibility determination
    major_prep_complete = len(missing_major_prep) == 0
    units_ok = requirements["min_units"] <= total_units <= requirements["max_units"]
    gpa_ok = gpa >= requirements["min_gpa"]

    if major_prep_complete and units_ok and gpa_ok:
        eligibility_status = "likely_eligible"
        eligibility_message = "Based on official requirements, you appear to meet the basic transfer eligibility criteria."
    elif gpa_ok and units_ok:
        eligibility_status = "conditional"
        eligibility_message = "You meet some requirements but have missing coursework. Complete the missing courses before applying."
    else:
        eligibility_status = "not_yet_eligible"
        eligibility_message = "You do not yet meet the transfer requirements. See the issues below."

    # Build the result
    result = {
        "eligibility_status": eligibility_status,
        "eligibility_message": eligibility_message,
        "summary": {
            "total_units": total_units,
            "gpa": round(gpa, 2),
            "min_gpa_required": requirements["min_gpa"],
            "units_range": f"{requirements['min_units']}-{requirements['max_units']}",
            "major": major,
            "target_uc": "UC Santa Cruz",
        },
        "major_requirements": {
            "completed": [r for r in major_requirements_status if r["completed"]],
            "missing": missing_major_prep,
        },
        "igetc_status": igetc_status,
        "risks": risks,
        "notes": requirements["notes"],
        "sources": {
            "ucsc_transfer": requirements["source_url"],
            "assist_org": f"https://assist.org/transfer/institution/113/115",
            "igetc": "https://assist.org/transfer/igetc",
        },
        "disclaimer": "This is a verification tool using official sources. It is NOT official advice. Always confirm with an academic counselor before making decisions."
    }

    # Store results in Firestore
    user_ref.update({"verification_results": result})
    return result


@app.get("/api/results/{email}")
async def get_verification_results(email: str):
    """Get stored verification results"""
    user_ref = db.collection("users").document(email)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    user = doc.to_dict()
    results = user.get("verification_results")
    if not results:
        raise HTTPException(status_code=404, detail="No verification results found. Run verification first.")
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
