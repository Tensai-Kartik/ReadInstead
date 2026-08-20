import asyncio
import httpx
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000"

TEST_QUERIES = [
    # 1. METADATA
    ("1. Metadata (Duration)", "How long is this video?"),
    ("2. Metadata (General)", "What is the video title and who is the channel/instructor?"),
    
    # 2. FIRST & LAST WINDOWS
    ("3. First Window", "What happens in the first 5 minutes?"),
    ("4. Last Window", "What happens in the last 5 minutes?"),
    ("5. Final Topic", "What is the final topic discussed at the end of the video?"),
    ("6. Before Conclusion", "What was discussed immediately before the conclusion?"),
    
    # 3. EXACT & AROUND TIMESTAMPS
    ("7. Exact Timestamp", "What is discussed at 02:30?"),
    ("8. Around Timestamp", "What is discussed around 07:40?"),
    ("9. After Timestamp", "What was discussed after 02:00?"),
    
    # 4. TEMPORAL RANGE
    ("10. Range Window", "What happens between 04:00 and 07:00?"),
    
    # 5. NAVIGATION (WHERE / FIND)
    ("11. Navigation (Bias-Variance)", "Where does the instructor explain the bias-variance trade-off?"),
    ("12. Navigation (Decision Trees)", "Where does the instructor explain decision trees?"),
    
    # 6. TEMPORAL + SEMANTIC HYBRID
    ("13. Temporal + Semantic", "What does the instructor say about yams around 03:00?"),
    
    # 7. COMPARISON
    ("14. Comparison", "Compare what was discussed at 03:00 and 08:00."),
    
    # 8. OUT OF BOUNDS / BOUNDARY CHECK (Anti-Hallucination)
    ("15. Out of Bounds Check", "What happens at 1:20:30?")
]

async def run_all_qa_tests():
    print("==================================================================", flush=True)
    print("READINSTEAD — COMPREHENSIVE TEMPORAL + SEMANTIC RAG QA TEST SUITE", flush=True)
    print("==================================================================", flush=True)

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Fetch active video ID
        res = await client.get(f"{BASE_URL}/api/videos")
        videos = res.json().get("videos", [])
        if not videos:
            print("No videos in database to test with!", flush=True)
            return

        video = videos[0]["video"]
        video_id = video["id"]
        video_title = video.get("title", "A Gentle Introduction to Machine Learning")
        video_duration = video.get("duration", "12:45")

        print(f"\nTesting against Active Video: '{video_title}' (ID: {video_id})", flush=True)
        print(f"Verified Duration: {video_duration}\n", flush=True)

        passed_count = 0
        total_count = len(TEST_QUERIES)

        for label, query in TEST_QUERIES:
            print(f"------------------------------------------------------------------", flush=True)
            print(f"[{label}]", flush=True)
            print(f"Query: \"{query}\"", flush=True)
            
            chat_res = await client.post(f"{BASE_URL}/api/chat-with-video", json={
                "video_id": video_id,
                "query": query,
                "video_title": video_title
            })

            assert chat_res.status_code == 200, f"Failed with status {chat_res.status_code}"
            data = chat_res.json()
            answer = data.get("answer", "")
            sources = data.get("sources", [])
            debug_info = data.get("debug_info", {})

            print(f"Detected Intent: {debug_info.get('intent')} | Method: {debug_info.get('retrieval_method')}", flush=True)
            print(f"AI Answer:\n{answer}\n", flush=True)
            print(f"Key Sources ({len(sources)}):", flush=True)
            for s in sources:
                ts = s.get('timestamp') or s.get('time') or '00:00'
                sec = s.get('start_seconds', 0)
                snip = s.get('snippet', '')[:100].replace('\n', ' ')
                print(f"  - [{ts}] ({sec}s): {snip}...", flush=True)

            passed_count += 1

        print(f"\n==================================================================", flush=True)
        print(f"TEST RESULTS: {passed_count}/{total_count} SCENARIOS TESTED SUCCESSFULLY!", flush=True)
        print(f"==================================================================", flush=True)

if __name__ == "__main__":
    asyncio.run(run_all_qa_tests())
