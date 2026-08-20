import asyncio
import os
import sys
from dotenv import load_dotenv

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

from services.groq_service import TokenManager, GroqOpenAIService, GroqKeyPoolManager
from services.supabase_db import SupabaseDatabaseService

async def test_chunker_and_pipeline():
    print("==================================================================")
    print("READINSTEAD — TOKEN-AWARE CHUNKER & HIERARCHICAL PIPELINE TEST")
    print("==================================================================")

    # 1. Simulate a long transcript of ~12,000 words (~16,000 tokens) with timestamp markers
    print("\n[TEST 1] Testing Token-Aware Smart Chunker on Long Transcript...")
    simulated_segments = []
    topics = [
        "Introduction to Distributed Database Systems",
        "ACID Properties vs BASE Consistency Models",
        "Two-Phase Commit Protocol and Failure Modes",
        "Raft Consensus Algorithm Leader Election",
        "Log Replication and State Machine Safety",
        "Vector Clocks and Causality Tracking",
        "Distributed Hash Tables and Consistent Hashing",
        "LSM Trees and Write-Ahead Logging in Storage Engines",
        "Multi-Version Concurrency Control (MVCC)",
        "Summary and Architectural Trade-offs in Production"
    ]
    
    total_sec = 3600  # 60 minute lecture
    sec_step = total_sec // len(topics)

    for i, topic in enumerate(topics):
        start_s = i * sec_step
        mins, secs = divmod(start_s, 60)
        hrs, mins = divmod(mins, 60)
        ts = f"{hrs}:{mins:02d}:{secs:02d}" if hrs > 0 else f"{mins:02d}:{secs:02d}"
        
        # Dense lecture paragraph for each topic
        body = (
            f"In this section covering {topic}, we examine how modern cloud native systems manage large-scale data. "
            f"The fundamental theorem of distributed state machines dictates that no system can simultaneously guarantee linearizability, "
            f"availability during partitions, and zero latency. When nodes experience network asymmetry or packet drops, quorum voting "
            f"via majority intersections (N/2 + 1) ensures uncommitted entries are discarded while committed entries survive failovers. "
            f"For example, Apache Cassandra and DynamoDB use consistent hashing rings with virtual nodes to balance partitions evenly across clusters. "
            f"Storage layers utilize Log-Structured Merge (LSM) trees with MemTables and SSTables to transform random disk writes into high-throughput sequential writes. "
        ) * 8  # multiply to generate realistic length
        
        simulated_segments.append(f"[{ts}] {topic}. {body}")

    full_transcript = " ".join(simulated_segments)
    word_count = len(full_transcript.split())
    token_est = TokenManager.estimate_tokens(full_transcript)
    print(f"Generated Long Lecture Transcript: {word_count} words | ~{token_est} tokens | Duration: 60:00 (3600s)")

    # Execute Token-Aware Chunker
    chunks = TokenManager.create_token_aware_chunks(full_transcript, video_duration_seconds=3600)
    print(f"Resulting Chunks: {len(chunks)} chunks created")
    
    for c in chunks:
        print(f"  - Chunk #{c['sequence_number']} [{c['start_time']} - {c['end_time']}] Tokens: ~{c['token_count']} | Time range: {c['start_seconds']}s -> {c['end_seconds']}s")
        assert c['token_count'] <= 4200, f"Chunk exceeded safety budget: {c['token_count']}"
        assert c['start_time'] != "", "Missing start_time"
        assert c['end_time'] != "", "Missing end_time"

    print("✓ Token-Aware Chunker passed all safety and boundary checks!")

    # 2. Test Groq Hierarchical Service on real execution
    print("\n[TEST 2] Testing Groq Hierarchical AI Processing (OpenAI/GPT-OSS 20B with pacing)...")
    service = GroqOpenAIService()
    
    # Progress tracker
    async def on_progress(stage, curr, total, msg):
        print(f"  [STREAM PROGRESS] [{stage}] {curr}/{total}: {msg}")

    print("Sending multi-chunk transcript to Groq Hierarchical Engine...")
    result = await service.generate_all_learning_materials(
        transcript_text=full_transcript,
        video_title="Distributed Systems & Consensus Masterclass (60 Min)",
        video_duration_seconds=3600,
        on_progress=on_progress
    )

    print("\n✓ Hierarchical Generation Completed Successfully!")
    print(f"Executive Summary ({len(result.get('executive_summary', ''))} chars):")
    print(f"\"{result.get('executive_summary', '')[:200]}...\"\n")
    print(f"TL;DR: \"{result.get('tldr', '')}\"\n")
    print(f"Detailed Notes Count: {len(result.get('detailed_notes', []))}")
    print(f"Key Takeaways Count: {len(result.get('key_takeaways', []))}")
    print(f"Important Concepts Count: {len(result.get('important_concepts', []))}")
    print(f"Chapter Timeline Count: {len(result.get('chapter_timeline', []))}")
    
    print("\nSample Chapter Timeline:")
    for ch in result.get('chapter_timeline', [])[:4]:
        print(f"  [{ch.get('time')}] ({ch.get('seconds')}s) {ch.get('title')}: {ch.get('description')}")

    mcqs = result.get('mcqs', [])
    short_q = result.get('short_answer_questions', [])
    flashcards = result.get('flashcards', [])
    
    print(f"\nGenerated Q&A Bank: {len(mcqs)} MCQs, {len(short_q)} Short Answer, {len(flashcards)} Flashcards")
    if mcqs:
        sample_q = mcqs[0]
        print(f"Sample MCQ [{sample_q.get('timestamp') or sample_q.get('start_seconds')}s] (Difficulty: {sample_q.get('difficulty')}):")
        print(f"  Q: {sample_q.get('question_text')}")
        print(f"  Options: {sample_q.get('options')}")
        print(f"  Correct: {sample_q.get('correct_answer')}")
        print(f"  Explanation: {sample_q.get('explanation')}")

    # 3. Test Database Persistence
    print("\n[TEST 3] Testing Database Persistence (Supabase public.videos + video_chunks)...")
    db = SupabaseDatabaseService()
    test_video_data = {
        "youtube_id": "test_hierarchical_60m",
        "title": "Distributed Systems & Consensus Masterclass (60 Min)",
        "youtube_url": "https://www.youtube.com/watch?v=test_hierarchical_60m",
        "duration": "60:00",
        "duration_seconds": 3600,
        "channel": "MIT OpenCourseWare",
        "thumbnail_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop",
        "processing_status": "completed",
        "pipeline_version": "v2_hierarchical"
    }

    saved = await db.save_complete_video_payload(test_video_data, full_transcript, result, "usr_demo_101")
    vid_id = saved.get("id")
    print(f"Saved to Supabase with Video ID: {vid_id}")

    # Fetch complete video payload to verify
    payload = await db.fetch_complete_video_payload(vid_id)
    assert payload is not None, "Failed to fetch saved video payload"
    assert len(payload.get("questions", [])) > 0, "No questions fetched"
    assert len(payload.get("flashcards", [])) > 0, "No flashcards fetched"
    
    # Check video_chunks table
    v_chunks = await db.get_video_chunks(vid_id)
    print(f"Verified {len(v_chunks)} video_chunks persisted in database!")
    for vc in v_chunks:
        print(f"  - DB Chunk #{vc.get('sequence_number')} [{vc.get('start_time')} - {vc.get('end_time')}]: {vc.get('chunk_summary')[:80]}...")

    print("\n==================================================================")
    print("ALL TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================================")

if __name__ == "__main__":
    asyncio.run(test_chunker_and_pipeline())
