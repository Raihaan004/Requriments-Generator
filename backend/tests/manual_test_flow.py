import os
import sys
import requests
import time

URL = "http://127.0.0.1:8081"

def run_flow():
    # 1. Start session
    print("1. Starting session...")
    res = requests.post(f"{URL}/session/start")
    res.raise_for_status()
    session_id = res.json()["session_id"]
    print(f"   Session ID: {session_id}")
    
    # 2. Upload requirements
    print("2. Uploading requirements...")
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "sample.txt")
    with open(fixture_path, "rb") as f:
        res = requests.post(
            f"{URL}/upload/requirements",
            data={"session_id": session_id},
            files={"file": ("sample.txt", f, "text/plain")}
        )
    res.raise_for_status()
    print("   Upload success.")
    
    # 3. Classify session data
    print("3. Classifying...")
    res = requests.post(f"{URL}/classify/{session_id}")
    res.raise_for_status()
    print("   Classification success.")
    
    # 4. Export session excel
    print("4. Exporting to excel...")
    res = requests.post(f"{URL}/export/{session_id}")
    res.raise_for_status()
    
    # Verify response headers
    print("   Response Headers:")
    for k, v in res.headers.items():
        print(f"     {k}: {v}")
        
    out_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "manual_test_export.xlsx")
    with open(out_path, "wb") as f:
        f.write(res.content)
    print(f"   Export saved to: {out_path}")
    print("Manual test flow completed successfully.")

if __name__ == "__main__":
    # Give server a second to boot if launched simultaneously
    time.sleep(2)
    try:
        run_flow()
    except Exception as e:
        print(f"Error during flow: {e}")
        sys.exit(1)
