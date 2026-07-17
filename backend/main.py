import os
import uuid
import shutil
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

# Import project components
import parsers
from classifier import splitter
import rules
import classifier
from utils import save_upload_file, get_file_type, TEMP_DIR
from fastapi.responses import FileResponse
from export.excel_export import export_to_excel

# Set up simple logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Requirements Generator Backend")

# Configure CORS to allow local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store
SESSIONS: dict = {}

@app.on_event("startup")
def startup_cleanup():
    logger.info("Server starting up. Clearing temp files...")
    if os.path.exists(TEMP_DIR):
        for item in os.listdir(TEMP_DIR):
            item_path = os.path.join(TEMP_DIR, item)
            try:
                if os.path.isfile(item_path) or os.path.islink(item_path):
                    os.unlink(item_path)
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
            except Exception as e:
                logger.error(f"Failed to delete {item_path}: {e}")
    else:
        os.makedirs(TEMP_DIR, exist_ok=True)
    logger.info("Temp folder cleared successfully.")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/session/start")
def start_session():
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "requirements_text": None,
        "requirements_source_name": None,
        "platform_text": None,
        "platform_source_name": None,
        "regulatory_text": None,
        "regulatory_source_name": None,
        "classified_rows": None
    }
    logger.info(f"Started new session: {session_id}")
    return {"session_id": session_id}


@app.post("/upload/requirements")
def upload_requirements(
    session_id: str = Form(...),
    file: UploadFile = File(...)
):
    if session_id not in SESSIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
        
    try:
        file_type = get_file_type(file.filename)
        saved_path = save_upload_file(file)
    except ValueError as e:
        logger.warning(f"File validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error saving uploaded file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred while saving file."
        )

    try:
        extracted_text = parsers.parse_document(saved_path, file_type)
    except Exception as e:
        logger.error(f"Error parsing document: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not parse file content: {str(e)}"
        )
    finally:
        if os.path.exists(saved_path):
            try:
                os.unlink(saved_path)
            except Exception as cleanup_err:
                logger.error(f"Failed to delete temp file {saved_path}: {cleanup_err}")

    SESSIONS[session_id]["requirements_text"] = extracted_text
    SESSIONS[session_id]["requirements_source_name"] = file.filename
    SESSIONS[session_id]["classified_rows"] = None
    
    preview = extracted_text[:300] if extracted_text else ""
    return {"status": "ok", "preview": preview}


def handle_platform_regulatory_upload(
    session_id: str,
    input_type: str,
    text_value: Optional[str],
    file: Optional[UploadFile],
    url_value: Optional[str]
) -> tuple[str, str]:
    """
    Helper function to process platform and regulatory inputs.
    Returns (extracted_text, source_name).
    """
    if input_type not in ["text", "file", "url"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="input_type must be 'text', 'file', or 'url'"
        )

    if input_type == "text":
        if not text_value or not text_value.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="text_value cannot be empty when input_type is 'text'"
            )
        return text_value.strip(), "Manual Text Input"

    elif input_type == "file":
        if not file or not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="file is required when input_type is 'file'"
            )
        try:
            file_type = get_file_type(file.filename)
            saved_path = save_upload_file(file)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        try:
            extracted_text = parsers.parse_document(saved_path, file_type)
            return extracted_text, file.filename
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not parse file content: {str(e)}"
            )
        finally:
            if os.path.exists(saved_path):
                try:
                    os.unlink(saved_path)
                except Exception as cleanup_err:
                    logger.error(f"Failed to delete temp file {saved_path}: {cleanup_err}")

    elif input_type == "url":
        if not url_value or not url_value.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="url_value cannot be empty when input_type is 'url'"
            )
        try:
            extracted_text = parsers.parse_document(url_value, "url")
            return extracted_text, url_value.strip()
        except Exception as e:
            logger.error(f"Failed to parse URL {url_value}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not fetch or parse URL content: {str(e)}"
            )


@app.post("/upload/platform")
def upload_platform(
    session_id: str = Form(...),
    input_type: str = Form(...),
    text_value: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    url_value: Optional[str] = Form(None)
):
    if session_id not in SESSIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
        
    extracted_text, source_name = handle_platform_regulatory_upload(
        session_id, input_type, text_value, file, url_value
    )
    
    SESSIONS[session_id]["platform_text"] = extracted_text
    SESSIONS[session_id]["platform_source_name"] = source_name
    SESSIONS[session_id]["classified_rows"] = None
    
    preview = extracted_text[:300] if extracted_text else ""
    return {"status": "ok", "preview": preview}


@app.post("/upload/regulatory")
def upload_regulatory(
    session_id: str = Form(...),
    input_type: str = Form(...),
    text_value: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    url_value: Optional[str] = Form(None)
):
    if session_id not in SESSIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
        
    extracted_text, source_name = handle_platform_regulatory_upload(
        session_id, input_type, text_value, file, url_value
    )
    
    SESSIONS[session_id]["regulatory_text"] = extracted_text
    SESSIONS[session_id]["regulatory_source_name"] = source_name
    SESSIONS[session_id]["classified_rows"] = None
    
    preview = extracted_text[:300] if extracted_text else ""
    return {"status": "ok", "preview": preview}


@app.post("/classify/{session_id}")
def classify_session_data(
    session_id: str,
    rules_text: str = Form("")
):
    if session_id not in SESSIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
        
    session = SESSIONS[session_id]
    if not session.get("requirements_text") or not session["requirements_text"].strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requirements document required before classification"
        )
        
    try:
        base_rules = rules.load_rules()
    except Exception as e:
        logger.error(f"Failed to load classification rules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load classification rules: {str(e)}"
        )
        
    try:
        active_rules = classifier.merge_user_rules(base_rules, rules_text)
    except Exception as e:
        logger.error(f"Failed to merge custom instructions: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse custom classification instructions: {str(e)}"
        )
        
    combined_statements = []
    
    # Requirements
    req_statements = splitter.split_statements(session["requirements_text"], "requirements")
    combined_statements.extend(req_statements)
    
    # Platform
    if session.get("platform_text") and session["platform_text"].strip():
        plat_statements = splitter.split_statements(session["platform_text"], "platform")
        combined_statements.extend(plat_statements)
        
    # Regulatory
    if session.get("regulatory_text") and session["regulatory_text"].strip():
        reg_statements = splitter.split_statements(session["regulatory_text"], "regulatory")
        combined_statements.extend(reg_statements)
        
    try:
        classified_rows = classifier.classify_statements(combined_statements, active_rules, min_score=1)
    except Exception as e:
        logger.error(f"Error running classification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error running classification engine: {str(e)}"
        )
        
    session["classified_rows"] = classified_rows
    
    return {
        "rows": classified_rows,
        "total_statements": len(combined_statements)
    }


@app.get("/preview/{session_id}")
def preview_classification(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
        
    session = SESSIONS[session_id]
    if session.get("classified_rows") is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Run /classify first"
        )
        
    return session["classified_rows"]


@app.post("/export/{session_id}", response_class=FileResponse)
def export_session_excel(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
        
    session = SESSIONS[session_id]
    classified_rows = session.get("classified_rows")
    if classified_rows is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Run /classify first before exporting"
        )
        
    output_filename = f"{session_id}_export.xlsx"
    output_path = os.path.join(TEMP_DIR, output_filename)
    
    try:
        export_to_excel(classified_rows, output_path)
    except Exception as e:
        logger.error(f"Failed to generate Excel export: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate Excel file: {str(e)}"
        )
        
    return FileResponse(
        path=output_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="requirements_analysis.xlsx"
    )


