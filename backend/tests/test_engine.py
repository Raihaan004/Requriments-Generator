import os
import sys
import unittest

# Ensure backend folder is in path so we can import rules and classifier
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from rules import load_rules
from classifier import classify_statement, filter_by_threshold, classify_batch

class TestClassificationEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Load standard rules
        cls.rules = load_rules()

    def test_classify_single_category_keyword(self):
        # "shall support" is a Functionality keyword
        stmt = "The system shall support multiple charging mode selections."
        res = classify_statement(stmt, self.rules)
        
        # Verify Functionality is matched
        self.assertIn("Functionality", res)
        self.assertIn("shall support", res["Functionality"]["matched"])
        self.assertGreaterEqual(res["Functionality"]["score"], 1)
        
        # Verify irrelevant categories (like Fault Management) are not in output
        self.assertNotIn("Fault Management", res)

    def test_classify_regex_match(self):
        # This has a voltage pattern like "3.5 V" which matches Performance
        stmt = "The cell voltage must be maintained at 3.5 V under all conditions."
        res = classify_statement(stmt, self.rules)
        
        self.assertIn("Performance", res)
        # Check if the regex pattern is captured in the matched list
        has_regex_match = any(m.startswith("regex:") for m in res["Performance"]["matched"])
        self.assertTrue(has_regex_match)
        self.assertGreaterEqual(res["Performance"]["score"], 1)

    def test_classify_multi_category_match(self):
        # Contains:
        # Mechanism: "bms", "module"
        # Performance: "within" + regex for seconds "5 seconds"
        # Fault Management: "thermal runaway", "isolate", "in the event of"
        stmt = "In the event of thermal runaway detection, the BMS shall isolate the affected module within 5 seconds."
        res = classify_statement(stmt, self.rules)
        
        self.assertIn("Mechanism", res)
        self.assertIn("Performance", res)
        self.assertIn("Fault Management", res)
        
        # Check specific keywords and regex
        self.assertIn("bms", res["Mechanism"]["matched"])
        self.assertIn("thermal runaway", res["Fault Management"]["matched"])
        
        has_performance_regex = any("regex:" in m for m in res["Performance"]["matched"])
        self.assertTrue(has_performance_regex)

    def test_classify_no_matches(self):
        stmt = "The quick brown fox jumps over the lazy dog."
        res = classify_statement(stmt, self.rules)
        self.assertEqual(res, {})

    def test_filter_by_threshold(self):
        # Mock classification dict
        classification = {
            "Functionality": {"matched": ["shall enable", "cell balancing"], "score": 2},
            "Mechanism": {"matched": ["bms"], "score": 1},
            "Performance": {"matched": [], "score": 0}
        }
        
        # Test threshold = 1 (default)
        filtered_1 = filter_by_threshold(classification, 1)
        self.assertIn("Functionality", filtered_1)
        self.assertIn("Mechanism", filtered_1)
        self.assertNotIn("Performance", filtered_1) # score is 0 < 1
        
        # Test threshold = 2
        filtered_2 = filter_by_threshold(classification, 2)
        self.assertIn("Functionality", filtered_2)
        self.assertNotIn("Mechanism", filtered_2)
        self.assertNotIn("Performance", filtered_2)
        
        # Test threshold = 3
        filtered_3 = filter_by_threshold(classification, 3)
        self.assertEqual(filtered_3, {})

    def test_classify_batch(self):
        statements = [
            {"text": "The user shall be able to view SoC display.", "source_doc": "doc1.txt", "line_number": 5},
            {"text": "An arbitrary unrelated statement with no keywords.", "source_doc": "doc1.txt", "line_number": 10},
            {"text": "Maximum voltage is 4.2V.", "source_doc": "doc1.txt", "line_number": 15}
        ]
        
        # Classify with min_score = 1 (default)
        batch_res = classify_batch(statements, self.rules, min_score=1)
        
        self.assertEqual(len(batch_res), 3)
        
        # Verify first statement
        self.assertEqual(batch_res[0]["source_doc"], "doc1.txt")
        self.assertEqual(batch_res[0]["line_number"], 5)
        self.assertIn("Functionality", batch_res[0]["classification"])
        
        # Verify second statement (should have empty classification as it doesn't match anything)
        self.assertEqual(batch_res[1]["classification"], {})
        
        # Verify third statement
        self.assertIn("Performance", batch_res[2]["classification"])

if __name__ == "__main__":
    unittest.main()
