# Requirements Generator (Phase 0)

An offline, rule-based requirements classifier and generator that parses customer requirement documents, product/platform reference manuals, and regulatory standards, and categorizes statements into **Functionality, Mechanism, Performance, and Fault Management** using a deterministic, rule-based approach.

## Important Constraints
- **Fully Offline Design**: This application is designed to run completely offline. There are no AI model endpoints, LLM API calls, or cloud classification dependencies. 
- **Outbound Traffic**: In a later phase, a single isolated URL-fetch utility is planned for downloading reference standards. No other part of the backend should ever attempt to make outbound network calls.

---

## How to Run the Project

### System Prerequisites
- **Node.js**: v20+ (Tested on v24.11.0)
- **Python**: v3.10+ (Tested on v3.13.9)

### 1. Backend Server Setup & Start
Navigate to the `backend/` directory in a shell:

1. **Activate the Virtual Environment**:
   - On Windows (PowerShell):
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - On Windows (CMD):
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```
2. **Install Dependencies (if not already done)**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the FastAPI server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
4. Confirm server status by visiting [http://localhost:8000/health](http://localhost:8000/health) in your browser. It should output `{"status": "ok"}`.

### 2. Frontend Development Server Setup & Start
Navigate to the `frontend/` directory in a separate shell:

1. **Install Dependencies (if not already done)**:
   ```bash
   npm install
   ```
2. **Run the Next.js server**:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser. The page should load and fetch connectivity health status directly from the running backend, displaying `{"status": "ok"}`.
