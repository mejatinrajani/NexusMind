import time
import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"
TEST_BOT_ID = "university_demo_bot"
DUMMY_FILE_PATH = "text.txt"

def create_dummy_file():
    """Generates a sample localized document to test GraphRAG extraction."""
    content = (
        "GLA University is a prominent educational institution located in Mathura.\n"
        "The university offers an advanced B.Tech Computer Science program.\n"
        "In the recent placement drive, two exceptional students named John Doe and Jane Smith "
        "were successfully placed at Accenture as Software Engineers.\n"
        "The Computer Science Department handles all engineering curriculum alignments.\n"
        "Accenture is a global professional services company specializing in digital, cloud, and security."
    )
    with open(DUMMY_FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[+] Created dummy text file: {DUMMY_FILE_PATH}")

def test_ingestion_endpoint():
    """Validates the asynchronous file processing pipeline."""
    url = f"{BASE_URL}/ingest"
    print(f"\n[*] Testing Ingestion Endpoint: {url}")
    
    with open(DUMMY_FILE_PATH, "rb") as f:
        files = {"file": (DUMMY_FILE_PATH, f, "text/plain")}
        data = {"chatbot_id": TEST_BOT_ID}
        
        response = requests.post(url, files=files, data=data)
        
    print(f"Status Code: {response.status_code}")
    print(f"Response Payload: {response.json()}")
    return response.status_code == 200

def test_chat_endpoint(question: str):
    """Validates the multi-agent routing, tool retrieval, and synthesis loop."""
    url = f"{BASE_URL}/chat"
    print(f"\n[*] Testing Chat Endpoint: {url}")
    print(f"Question: '{question}'")
    
    payload = {
        "chatbot_id": TEST_BOT_ID,
        "question": question
    }
    
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Reasoning Path Taken: {data.get('reasoning_path')}")
        print(f"Generated Answer:\n{data.get('answer')}")
    else:
        print(f"Error: {response.text}")

if __name__ == "__main__":
    print("=== Starting NexusMind API Integration Tests ===")
    
    # 1. Setup local environment context
    create_dummy_file()
    
    # 2. Run ingestion
    if test_ingestion_endpoint():
        # Pause to let the asynchronous background thread write to ChromaDB and Neo4j
        print("\n[!] Pausing for 5 seconds to let background extraction threads commit to databases...")
        time.sleep(5)
        
        # 3. Test Graph-based relational questions
        test_chat_endpoint("Who got placed at Accenture?")
        
        # 4. Test regular conversational direct routing
        test_chat_endpoint("Hello there! Who are you?")
    else:
        print("[-] Ingestion failed. Skipping chat tests.")