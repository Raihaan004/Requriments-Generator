# ==============================================================================
# WARNING / ARCHITECTURE CONSTRAINT:
# This is the ONLY file in the entire backend allowed to make outbound network calls.
# The rest of the application must run fully offline. Do not add outbound network 
# operations to any other module.
# ==============================================================================

import requests
from bs4 import BeautifulSoup

def parse_url(url: str) -> str:
    """
    Fetches a URL and extracts clean plain text.
    Strips <script>, <style>, <nav>, and <footer> tags before extracting content.
    Implements a 10-second timeout.
    
    If fetching or parsing fails, raises ValueError.
    """
    if not url:
        raise ValueError("Could not parse URL: Provided URL is empty or null")

    # Ensure URL starts with a valid scheme
    if not (url.startswith("http://") or url.startswith("https://")):
        # Defaulting to https if not specified (optional, but raises exception if invalid anyway)
        raise ValueError(f"Could not parse URL: Invalid scheme. Must start with http:// or https://")

    try:
        # Define a standard user-agent to avoid simple blocking by servers
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"
        }
        # Set a 10-second timeout for connection and reading
        response = requests.get(url, headers=headers, timeout=10)
        # Raise HTTPError if status code is not 2xx
        response.raise_for_status()
    except requests.exceptions.Timeout as e:
        raise ValueError(f"Could not fetch URL: Connection timed out (10s threshold). Details: {str(e)}")
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Could not fetch URL: Network request failed. Details: {str(e)}")
    except Exception as e:
        raise ValueError(f"Could not fetch URL: Unexpected error. Details: {str(e)}")

    try:
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Strip script, style, nav, and footer tags
        for element in soup(["script", "style", "nav", "footer"]):
            element.decompose()
            
        # Extract text content
        raw_text = soup.get_text(separator="\n")
        
        # Clean up text by removing extra whitespaces and empty lines
        cleaned_lines = []
        for line in raw_text.splitlines():
            line_stripped = line.strip()
            if line_stripped:
                cleaned_lines.append(line_stripped)
                
        return "\n".join(cleaned_lines)
    except Exception as e:
        raise ValueError(f"Could not parse HTML content from URL. Details: {str(e)}")
