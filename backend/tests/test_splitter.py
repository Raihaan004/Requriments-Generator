import os
import sys
import shutil

# Ensure backend folder is in path so we can import parsers and classifier
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from parsers import parse_document
from classifier import split_statements

# Define paths for testing
TEMP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "temp", "test_files"))
TXT_PATH = os.path.join(TEMP_DIR, "sample.txt")
DOCX_PATH = os.path.join(TEMP_DIR, "sample.docx")
PDF_PATH = os.path.join(TEMP_DIR, "sample.pdf")

def setup_test_files():
    """Ensure the sample test files are generated using test_parsers code."""
    if not os.path.exists(TEMP_DIR):
        os.makedirs(TEMP_DIR)
        
    # Import parser test generators to build the standard fixtures
    try:
        from tests.test_parsers import (
            generate_sample_txt,
            generate_sample_docx,
            generate_sample_pdf
        )
        generate_sample_txt()
        generate_sample_docx()
        generate_sample_pdf()
        print("Generated sample files in temp directory successfully.")
    except Exception as e:
        print(f"Error generating sample files using test_parsers helpers: {e}")
        # Manual fallback generation in case test_parsers isn't importable
        with open(TXT_PATH, "w", encoding="utf-8") as f:
            f.write("   This is a sample requirements text file.\nREQ-001: The system shall run offline.\nREQ-002: Latency must be low.   ")

def run_edge_cases() -> bool:
    print("\n==================================================")
    print("RUNNING EDGE-CASE TESTS (HARDCODED STRINGS)")
    print("==================================================")
    
    all_passed = True
    
    # 1. Abbreviation Case
    abbr_text = "The system shall run at all times, e.g. during a power outage. This is a separate sentence."
    abbr_results = split_statements(abbr_text, "edge_case_1")
    # Expected results: two statements, not split at e.g.
    expected_abbr = [
        "The system shall run at all times, e.g. during a power outage.",
        "This is a separate sentence."
    ]
    abbr_passed = [r["text"] for r in abbr_results] == expected_abbr
    print(f"Case 1 (Abbreviation 'e.g.'): {'PASS' if abbr_passed else 'FAIL'}")
    print(f"  Input:  {abbr_text!r}")
    print(f"  Output: {abbr_results}")
    if not abbr_passed:
        all_passed = False
        
    # 2. Decimal Case
    decimal_text = "Ensure voltage shall not exceed 3.5V or 3.5 V. Let's make sure it is correct."
    decimal_results = split_statements(decimal_text, "edge_case_2")
    expected_decimal = [
        "Ensure voltage shall not exceed 3.5V or 3.5 V.",
        "Let's make sure it is correct."
    ]
    decimal_passed = [r["text"] for r in decimal_results] == expected_decimal
    print(f"Case 2 (Decimal point '3.5V' / '3.5 V'): {'PASS' if decimal_passed else 'FAIL'}")
    print(f"  Input:  {decimal_text!r}")
    print(f"  Output: {decimal_results}")
    if not decimal_passed:
        all_passed = False
        
    # 3. Short/Junk Line Case
    junk_text = "Page 3"
    junk_results = split_statements(junk_text, "edge_case_3")
    junk_passed = len(junk_results) == 0
    print(f"Case 3 (Short junk line 'Page 3'): {'PASS' if junk_passed else 'FAIL'}")
    print(f"  Input:  {junk_text!r}")
    print(f"  Output: {junk_results}")
    if not junk_passed:
        all_passed = False
        
    return all_passed

def test_document_splitting():
    setup_test_files()
    
    print("\n==================================================")
    print("RUNNING SPLITTER ON PHASE 1 SAMPLE FILES")
    print("==================================================")
    
    files_to_test = [
        (TXT_PATH, "txt"),
        (DOCX_PATH, "docx"),
        (PDF_PATH, "pdf")
    ]
    
    for filepath, file_type in files_to_test:
        print(f"\n--- Parsing and Splitting: {os.path.basename(filepath)} ({file_type}) ---")
        try:
            parsed_text = parse_document(filepath, file_type)
            statements = split_statements(parsed_text, os.path.basename(filepath))
            
            print(f"Found {len(statements)} candidate statements:")
            print("-" * 60)
            for stmt in statements:
                print(f"Line {stmt['line_number']:02d} | Source: {stmt['source_doc']} | Text: {stmt['text']}")
            print("-" * 60)
        except Exception as e:
            print(f"Failed to process {filepath}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_document_splitting()
    edge_passed = run_edge_cases()
    
    # Cleanup temp dir generated during test
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR)
        
    sys.exit(0 if edge_passed else 1)
