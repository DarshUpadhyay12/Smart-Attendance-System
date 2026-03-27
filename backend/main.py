from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
import logging
import asyncio
from core.vision import decode_base64_image, process_frame

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart Attendance System API", version="0.1.0")

# Allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Smart Attendance API is running"}

from pydantic import BaseModel
import numpy as np
import time
import json
import os

class EnrollRequest(BaseModel):
    name: str
    enrollment: str
    branch: str
    image_base64: str

class UpdateStudentRequest(BaseModel):
    name: str
    enrollment: str
    branch: str

# In-memory DB for MVP demonstration, backed by local JSON files
mock_students = {}      # dict mapping student_id -> { id, name, enrollment, branch, encoding }
attendance_log = []     # list of { student_id, name, enrollment, branch, timestamp }
marked_today = set()    # set of student_ids already marked present this session
state = {
    "student_counter": 1,
    "active_session": "Morning Class"
}

DB_FILE = "students.json"
LOG_FILE = "attendance.json"

def load_db():
    global mock_students, attendance_log, marked_today
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r") as f:
            mock_students = json.load(f)
            state["student_counter"] = len(mock_students) + 1
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            attendance_log = json.load(f)
            today = time.strftime("%Y-%m-%d")
            for log in attendance_log:
                if log["timestamp"].startswith(today):
                    marked_today.add(log["student_id"])

def save_db():
    with open(DB_FILE, "w") as f:
        json.dump(mock_students, f, indent=4)
    with open(LOG_FILE, "w") as f:
        json.dump(attendance_log, f, indent=4)

load_db()

@app.post("/enroll")
async def enroll_user(req: EnrollRequest):
    print(f"Enroll Request received for {req.name}")
    img = decode_base64_image(req.image_base64)
    if img is not None:
        result = process_frame(img)
        print(f"Process Frame Result: {result}")
        if result.get("status") == "success" and result.get("faces_detected") == 1:
            student_id = f"STU-{state['student_counter']}"
            state['student_counter'] += 1
            
            mock_students[student_id] = {
                "id": student_id,
                "name": req.name,
                "enrollment": req.enrollment,
                "branch": req.branch,
                "encoding": result["encodings"][0]
            }
            save_db()
            print(f"Successfully saved {student_id} to persistent storage.")
            return {"status": "success", "message": f"Successfully enrolled {req.name}."}
        print("Failed to enroll: either status not success, or faces_detected != 1")
        return {"status": "error", "message": "Could not detect exactly one clear face."}
    print("Invalid image data.")
    return {"status": "error", "message": "Invalid image data."}

@app.get("/attendance_logs")
async def get_logs():
    return {"status": "success", "logs": attendance_log}

@app.get("/export_attendance", response_class=PlainTextResponse)
async def export_attendance():
    """Generates a simple, easy-to-read CSV report for the active session."""
    active_session = state["active_session"]
    csv_str = f"Attendance Report for: {active_session}\n"
    csv_str += "Name,Enrollment Number,Branch,Status,Check-In Time\n"
    
    # Map student IDs to their timestamp for today's active session
    record_times = {}
    today = time.strftime("%Y-%m-%d")
    for log in attendance_log:
        if log.get("session_id") == active_session and log["timestamp"].startswith(today):
            record_times[log["student_id"]] = log["timestamp"]
            
    for sid, student in mock_students.items():
        if sid in marked_today and sid in record_times:
            status = "Present"
            check_in = record_times[sid].split(" ")[1] # Extract just the HH:MM:SS
        else:
            status = "Absent"
            check_in = "N/A"
            
        csv_str += f"{student['name']},{student['enrollment']},{student['branch']},{status},{check_in}\n"
        
    return csv_str

class SessionRequest(BaseModel):
    session_name: str

@app.post("/set_session")
async def set_session(req: SessionRequest):
    global marked_today
    state["active_session"] = req.session_name
    # When a new session starts, clear the people who were marked today so they can be marked again for this new class
    marked_today.clear() 
    return {"status": "success", "message": f"Session changed to {req.session_name}"}

@app.get("/current_session")
async def get_current_session():
    return {"status": "success", "active_session": state["active_session"]}

@app.get("/students")
async def get_students():
    return {"status": "success", "students": list(mock_students.values())}

@app.put("/students/{student_id}")
async def update_student(student_id: str, req: UpdateStudentRequest):
    if student_id not in mock_students:
        return {"status": "error", "message": "Student not found"}
    mock_students[student_id].update({
        "name": req.name,
        "enrollment": req.enrollment,
        "branch": req.branch
    })
    save_db()
    return {"status": "success", "message": "Student updated successfully."}

@app.delete("/students/{student_id}")
async def delete_student(student_id: str):
    if student_id in mock_students:
        global attendance_log, marked_today
        mock_students.pop(student_id, None)
        
        # Purge the student from the live attendance session as well
        attendance_log = [log for log in attendance_log if log["student_id"] != student_id]
        if student_id in marked_today:
            marked_today.remove(student_id)
            
        save_db()
        return {"status": "success", "message": "Student deleted"}
    return {"status": "error", "message": "Student not found"}

def identify_face(face_encoding):
    """Compares a live encoding against the mock_students database using a simple distance metric."""
    if not mock_students:
        return None, 0.0
        
    best_match_id = ""
    best_distance = float('inf')
    
    # Simple Euclidean distance since we're using pseudo encodings
    live_enc = np.array(face_encoding)
    for sid, student in mock_students.items():
        db_enc = np.array(student["encoding"])
        if db_enc.shape != live_enc.shape:
            continue # Skip legacy low-res or corrupted encodings
            
        dist = np.linalg.norm(live_enc - db_enc)
        if dist < best_distance:
            best_distance = dist
            best_match_id = sid
            
    # Empirical threshold to physically distinguish between different facial T-zones
    # Combined with the 10-consecutive-frame streak tracker, 3.5 serves as highly robust (stricter for accuracy)
    if best_distance < 3.5: 
        # Map distance (0 to 3.5) into a Confidence Percentage (99.8% to ~50%)
        conf_float = float(99.8 - ((float(best_distance) / 3.5) * 49.8))
        confidence = max(0.0, conf_float)
        return mock_students[best_match_id], round(confidence, 1)
    return None, 0.0

@app.websocket("/ws/attendance")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established")
    
    # Track the previous frame's facial geometry to calculate liveness
    last_locations = []
    
    # Track consecutive identical identifications to prevent random fluttering cross-matches
    match_streaks = {}
    
    try:
        while True:
            # We will receive binary base64 frames here
            data = await websocket.receive_text()
            
            # Process frame asynchronously by throwing it to a background thread to prevent blocking
            img = decode_base64_image(data)
            if img is not None:
                loop = asyncio.get_event_loop()
                # Run the synchronous CPU-bound face_recognition in an executor
                result = await loop.run_in_executor(None, process_frame, img, last_locations)
                
                if result.get("status") == "success":
                    faces = []
                    encodings = result.get("encodings", [])
                    locations = result.get("locations", [])
                    
                    # Update tracked locations for the next frame
                    last_locations = locations
                    
                    # Track who was seen in this exact single frame
                    seen_this_frame = set()
                    
                    for i, encoding in enumerate(encodings):
                        student, confidence = identify_face(encoding)
                        if student:
                            sid = student["id"]
                            seen_this_frame.add(sid)
                            
                            # Increment their uninterrupted streak
                            match_streaks[sid] = match_streaks.get(sid, 0) + 1
                            
                            # Mark attendance logic ONLY if streak >= 5 (highly reliable without being overly strict)
                            just_marked = False
                            if match_streaks[sid] >= 5 and sid not in marked_today:
                                marked_today.add(sid)
                                attendance_log.insert(0, {
                                    "student_id": sid,
                                    "name": student["name"],
                                    "enrollment": student["enrollment"],
                                    "branch": student["branch"],
                                    "session_id": state["active_session"],
                                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                                })
                                save_db()
                                just_marked = True
                            
                            faces.append({
                                "type": "known",
                                "box": locations[i],
                                "student": student,
                                "confidence": confidence,
                                "just_marked": just_marked
                            })
                        else:
                            faces.append({
                                "type": "unknown",
                                "box": locations[i]
                            })
                            
                    # Reset streaks for anyone NOT securely identified in this frame
                    # This guarantees the matches must be purely consecutive
                    for known_id in list(match_streaks.keys()):
                        if known_id not in seen_this_frame:
                            match_streaks[known_id] = 0
                            
                            
                    await websocket.send_json({"status": "identifying", "faces": faces, "message": f"Processing {len(faces)} faces"})
                else:
                    await websocket.send_json({"status": "no_face", "faces": [], "message": "Scanning... No faces detected."})
            else:
                await websocket.send_json({"status": "error", "message": "Error decoding frame."})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected gracefully")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
