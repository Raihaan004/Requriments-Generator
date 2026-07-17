import os
import uuid
import shutil
from fastapi import UploadFile

TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp")

def save_upload_file(file: UploadFile) -> str:
    """
    Saves the uploaded file to backend/temp/ with a uuid-prefixed filename
    to avoid collisions, and returns the saved absolute path.
    """
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    # Generate UUID prefix
    unique_prefix = str(uuid.uuid4())
    filename = file.filename or "uploaded_file"
    safe_filename = f"{unique_prefix}_{filename}"
    file_path = os.path.join(TEMP_DIR, safe_filename)
    
    # Reset file pointer before copying
    file.file.seek(0)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return file_path

def get_file_type(filename: str) -> str:
    """
    Returns "pdf"/"docx"/"txt" based on the extension of the filename.
    Raises ValueError on unsupported types.
    """
    if not filename:
        raise ValueError("Filename is empty or invalid")
        
    _, ext = os.path.splitext(filename)
    normalized_ext = ext.lower().lstrip(".")
    
    if normalized_ext in ["pdf", "docx", "txt"]:
        return normalized_ext
        
    raise ValueError(f"Unsupported file type: '.{normalized_ext}'. Supported extensions: .pdf, .docx, .txt")
