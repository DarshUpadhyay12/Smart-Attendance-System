import cv2
import numpy as np
import base64
import logging

logger = logging.getLogger(__name__)

# Load OpenCV's built-in Haar Cascade for face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def decode_base64_image(base64_string: str) -> np.ndarray:
    """Decodes a base64 encoded JPEG into a BGR numpy array compatible with OpenCV."""
    try:
        encoded_data = base64_string.split(',')[1] if ',' in base64_string else base64_string
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.error(f"Failed to decode base64 image: {e}")
        return None

def process_frame(img: np.ndarray, previous_faces: list = None) -> dict:
    """Finds faces using OpenCV Haar Cascades and generates pseudo-encodings for the MVP.
    Includes rudimentary Liveness detection by tracking box movement across frames."""
    if img is None:
        return {"status": "error", "message": "Invalid image data"}
        
    if previous_faces is None:
        previous_faces = []

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    if len(faces) == 0:
        return {"status": "no_face"}
    
    encodings = []
    locations = []
    
    for (x, y, w, h) in faces:
        # Create a more robust encoding by cropping exclusively to the facial T-zone (eyes/nose/mouth)
        # This completely discards hair, jawline, and background walls which cause false-positive matches!
        cy = y + int(h * 0.15)
        ch = int(h * 0.7)
        cx = x + int(w * 0.15)
        cw = int(w * 0.7)
        
        face_roi = gray[cy:cy+ch, cx:cx+cw]
        # Equalize histogram to normalize lighting/contrast
        face_roi = cv2.equalizeHist(face_roi)
        # Resize to 32x32 for a dense 1024 pixel feature array
        face_resized = cv2.resize(face_roi, (32, 32)) 
        # Normalize and flatten
        encoding_arr = (face_resized.flatten() / 255.0)
        encodings.append(encoding_arr.tolist())
        
        # Calculate bounding box for React Canvas overlay
        bx, by, bw, bh = int(x), int(y), int(w), int(h)
        
        # Liveness Check: Does this box move slightly compared to the last frame?
        # A static printed photo held to the camera will have exactly 0 movement or very unnatural jitter.
        # A real human inevitably has micro-movements (breathing, pulse, natural sway).
        is_live = False
        if not previous_faces:
            # First frame is always assumed "pending/live" until we get a secondary frame to compare
            is_live = True 
        else:
            for pf in previous_faces:
                dx = abs(pf["x"] - bx)
                dy = abs(pf["y"] - by)
                dw = abs(pf["w"] - bw)
                dh = abs(pf["h"] - bh)
                
                # If movement is perfectly zero, it's a static spoof photo. 
                # If movement is within a realistic human micro-sway threshold (1 to 15 pixels), it's live.
                if (0 < dx < 15) or (0 < dy < 15) or (0 < dw < 15) or (0 < dh < 15):
                    is_live = True
                    break
                    
        locations.append({
            "x": bx, "y": by, "w": bw, "h": bh,
            "is_live": is_live
        })
        
    return {
        "status": "success",
        "faces_detected": len(faces),
        "encodings": encodings, 
        "locations": locations
    }
