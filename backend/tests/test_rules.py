import os
import sys
import re

# Ensure backend folder is in path so we can import rules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from rules import load_rules

def test_rules():
    print("==================================================")
    print("TESTING RULES TAXONOMY AND LOADER")
    print("==================================================")
    
    # 1. Load rules
    try:
        rules = load_rules()
        print("1. load_rules() loaded successfully.")
    except Exception as e:
        print(f"FAIL: load_rules() raised an exception: {e}")
        sys.exit(1)
        
    # 2. Print counts
    print("\n2. Category Counts:")
    for cat_name, content in rules.items():
        kw_count = len(content["keywords"])
        rg_count = len(content["regex"])
        print(f"   - {cat_name}: {kw_count} keywords, {rg_count} regexes")
        
    # 3. Compile all regexes
    print("\n3. Verifying Regex Patterns:")
    all_regex_valid = True
    for cat_name, content in rules.items():
        for pattern in content["regex"]:
            try:
                re.compile(pattern)
            except Exception as e:
                print(f"   [ERROR] Failed to compile regex in {cat_name}: {pattern!r} -> {e}")
                all_regex_valid = False
    
    if all_regex_valid:
        print("   All regex patterns compiled successfully!")
    else:
        print("   [FAIL] Some regex patterns are malformed.")
        sys.exit(1)
        
    # 4. Run substring checks against hand-labeled statements
    test_statements = [
        ("The BMS shall enable/disable cell balancing automatically during charge cycles.", ["Functionality"]),
        ("User shall be able to view real-time State of Charge (SoC) on the dashboard.", ["Functionality"]),
        ("The battery pack shall use a 96S2P prismatic cell configuration with a CAN 2.0B communication interface.", ["Mechanism"]),
        ("Cell voltage monitoring shall be implemented using a dedicated AFE per module.", ["Mechanism"]),
        ("The pack shall deliver a minimum of 350 km range on a single charge under WLTP conditions.", ["Performance"]),
        ("Charging time from 20% to 80% SoC shall not exceed 30 minutes on DC fast charge.", ["Performance"]),
        ("Cell operating temperature shall not exceed 60°C under normal operating conditions.", ["Performance", "Fault Management"]),
        ("In the event of thermal runaway detection, the BMS shall isolate the affected module within 5 seconds.", ["Fault Management"]),
        ("The system shall trigger a fail-safe contactor open if pack voltage deviates beyond +/-5% of nominal.", ["Fault Management"]),
        ("The battery enclosure shall maintain IP67 ingress protection compliance for the vehicle's operational life.", ["Fault Management", "Mechanism"])
    ]
    
    print("\n4. Running dry-run matches on 10 statements:")
    failures = 0
    for idx, (stmt, expected) in enumerate(test_statements, 1):
        print(f"\n   Statement {idx}: {stmt!r}")
        print(f"   Expected Categories: {', '.join(expected)}")
        
        matched_categories = {}
        for cat_name, content in rules.items():
            matched_kws = []
            stmt_lower = stmt.lower()
            for kw in content["keywords"]:
                if kw in stmt_lower:
                    matched_kws.append(kw)
            
            matched_rgs = []
            for pattern in content["regex"]:
                if re.search(pattern, stmt):
                    matched_rgs.append(pattern)
            
            if matched_kws or matched_rgs:
                matched_categories[cat_name] = {
                    "keywords": matched_kws,
                    "regexes": matched_rgs
                }
                
        if not matched_categories:
            print("     -> [WARNING] No matches found!")
        else:
            for cat_name, matches in matched_categories.items():
                match_info = []
                if matches["keywords"]:
                    match_info.append(f"Keywords: {matches['keywords']}")
                if matches["regexes"]:
                    match_info.append(f"Regexes: {matches['regexes']}")
                print(f"     -> Matched Category: {cat_name} ({'; '.join(match_info)})")
                
        # Verify that all expected categories were matched
        missing_expected = [exp for exp in expected if exp not in matched_categories]
        if missing_expected:
            print(f"     [MISS] Missing expected categories: {missing_expected}")
            failures += 1
        else:
            print("     [OK] All expected categories were matched.")
            
    if failures == 0:
        print("\nAll 10 statements matched their expected categories successfully!")
        sys.exit(0)
    else:
        print(f"\nCompleted with {failures} statement failures.")
        sys.exit(1)

if __name__ == "__main__":
    test_rules()
