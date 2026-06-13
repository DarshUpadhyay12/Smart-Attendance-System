import json
import logging
import asyncio
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from core.vision import decode_base64_image, process_frame
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart Attendance System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Mock using JSON files ---
BASE_DIR = Path(__file__).parent
STUDENTS_FILE = BASE_DIR / "students.json"
ATTENDANCE_FILE = BASE_DIR / "attendance.json"

def read_json(path: Path, default=list):
    if not path.exists():
        return default()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict) and default == list:
                return list(data.values())
            return data
    except Exception:
        return default()

def write_json(path: Path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

# Load in-memory DB
students_db = read_json(STUDENTS_FILE, list)
attendance_db = read_json(ATTENDANCE_FILE, list)

# --- Models ---
class StudentCreate(BaseModel):
    name: str
    enrollment: str
    branch: str
    image: str

class StudentUpdate(BaseModel):
    name: str
    enrollment: str
    branch: str

def get_student_by_id(sid: str):
    return next((s for s in students_db if s.get("id") == sid), None)

def get_student_by_enrollment(enrollment: str):
    return next((s for s in students_db if s.get("enrollment") == enrollment), None)

def calculate_distance(encoding1, encoding2):
    # Use Mean Absolute Error (MAE) which is much more stable for raw pixel comparisons
    return float(np.mean(np.abs(np.array(encoding1) - np.array(encoding2))))

# --- API Endpoints ---

@app.get("/students")
def get_students():
    return {"status": "success", "students": [
        {"id": s["id"], "name": s["name"], "enrollment": s["enrollment"], "branch": s["branch"]} 
        for s in students_db
    ]}

@app.post("/students")
def enroll_student(student: StudentCreate):
    if get_student_by_enrollment(student.enrollment):
        raise HTTPException(status_code=400, detail="Student already enrolled")
    
    img = decode_base64_image(student.image)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")
        
    vision_result = process_frame(img)
    if vision_result.get("status") != "success" or not vision_result.get("encodings"):
        raise HTTPException(status_code=400, detail="No face detected in the image")
    
    new_student = {
        "id": f"student_{len(students_db)+1}_{int(datetime.now().timestamp())}",
        "name": student.name,
        "enrollment": student.enrollment,
        "branch": student.branch,
        "encoding": vision_result["encodings"][0]
    }
    students_db.append(new_student)
    write_json(STUDENTS_FILE, students_db)
    return {"status": "success", "message": "Student enrolled successfully"}

@app.put("/students/{sid}")
def update_student(sid: str, data: StudentUpdate):
    st = get_student_by_id(sid)
    if not st:
        raise HTTPException(status_code=404, detail="Student not found")
    st["name"] = data.name
    st["enrollment"] = data.enrollment
    st["branch"] = data.branch
    write_json(STUDENTS_FILE, students_db)
    return {"status": "success", "message": "Student updated"}

@app.delete("/students/{sid}")
def delete_student(sid: str):
    global students_db
    if not get_student_by_id(sid):
        raise HTTPException(status_code=404, detail="Student not found")
    students_db = [s for s in students_db if s.get("id") != sid]
    write_json(STUDENTS_FILE, students_db)
    return {"status": "success"}

@app.get("/analytics")
def get_analytics():
    today_date = datetime.now().strftime("%Y-%m-%d")
    today_attendance = [a for a in attendance_db if a.get("date") == today_date]
    unique_present = len(set(a.get("student_id") for a in today_attendance))
    
    return {
        "status": "success",
        "total_students": len(students_db),
        "present_today": unique_present,
        "recent_logs": sorted(attendance_db, key=lambda x: x.get("timestamp", ""), reverse=True)[:10]
    }

# --- WebSockets ---

@app.websocket("/ws/attendance")
async def websocket_attendance(websocket: WebSocket):
    await websocket.accept()
    previous_faces = []
    
    try:
        while True:
            data = await websocket.receive_text()
            img = decode_base64_image(data)
            
            if img is not None:
                vision_result = process_frame(img, previous_faces)
                response = {"status": "identifying", "faces": []}
                
                if vision_result.get("status") == "success":
                    previous_faces = vision_result.get("locations", [])
                    
                    for i, encoding in enumerate(vision_result.get("encodings", [])):
                        loc = vision_result["locations"][i]
                        
                        best_match = None
                        best_dist = float('inf')
                        
                        for st in students_db:
                            if "encoding" in st:
                                dist = calculate_distance(encoding, st["encoding"])
                                if dist < best_dist:
                                    best_dist = dist
                                    best_match = st
                        
                        # Confidence mapping
                        # Using MAE, < 0.18 is usually a good match for identical faces with slight noise
                        threshold = 0.18
                        is_known = False
                        confidence = 0
                        student_data = None
                        just_marked = False
                        
                        if best_dist < threshold and best_match:
                            is_known = True
                            # Map distance 0 -> 100%, threshold -> 50%
                            confidence = int(max(0, min(100, (1 - (best_dist / (threshold * 2))) * 100)))
                            student_data = {
                                "id": best_match["id"],
                                "name": best_match["name"],
                                "enrollment": best_match["enrollment"]
                            }
                            
                            # Mark attendance if live and confident enough
                            if loc.get("is_live", False) and confidence > 50:
                                today_str = datetime.now().strftime("%Y-%m-%d")
                                already_marked = any(
                                    a.get("student_id") == best_match["id"] and a.get("date") == today_str 
                                    for a in attendance_db
                                )
                                if not already_marked:
                                    attendance_db.append({
                                        "student_id": best_match["id"],
                                        "name": best_match["name"],
                                        "date": today_str,
                                        "timestamp": datetime.now().isoformat()
                                    })
                                    write_json(ATTENDANCE_FILE, attendance_db)
                                    just_marked = True

                        response["faces"].append({
                            "type": "known" if is_known else "unknown",
                            "student": student_data,
                            "confidence": confidence,
                            "box": loc,
                            "just_marked": just_marked
                        })
                
                await websocket.send_json(response)
            
            await asyncio.sleep(0.01)
            
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
