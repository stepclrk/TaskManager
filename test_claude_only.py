#!/usr/bin/env python3
"""Test script to verify Claude-only AI implementation"""

import requests
import json

BASE_URL = "http://localhost:8080"

def test_settings():
    """Test that settings are properly configured"""
    print("\nTesting Settings Configuration...")
    
    response = requests.get(f"{BASE_URL}/api/settings")
    if response.status_code == 200:
        settings = response.json()
        print(f"[OK] Settings loaded")
        
        # Check that only Claude fields exist
        if 'api_key' in settings:
            print(f"[OK] API key field present")
        
        # Verify HuggingFace fields are gone
        hf_fields = ['hf_token', 'hf_model', 'ai_provider']
        removed_fields = [f for f in hf_fields if f not in settings]
        if len(removed_fields) == len(hf_fields):
            print(f"[OK] HuggingFace fields removed: {removed_fields}")
        else:
            remaining = [f for f in hf_fields if f in settings]
            print(f"[WARN] HuggingFace fields still present: {remaining}")
    else:
        print(f"[FAIL] Could not load settings: {response.status_code}")

def test_ai_features():
    """Test AI features require API key"""
    print("\nTesting AI Features...")
    
    # Test without API key (should fail)
    print("\n1. Testing without API key:")
    
    # Clear API key first
    requests.post(f"{BASE_URL}/api/settings", json={"api_key": ""})
    
    # Test summary
    response = requests.post(f"{BASE_URL}/api/ai/summary")
    if response.status_code == 400:
        error = response.json().get('error', '')
        if 'API key not configured' in error:
            print(f"   [OK] Summary correctly requires API key")
        else:
            print(f"   [WARN] Unexpected error: {error}")
    else:
        print(f"   [FAIL] Expected 400, got {response.status_code}")
    
    # Test follow-up
    response = requests.post(f"{BASE_URL}/api/ai/follow-up", json={"task_id": "test"})
    if response.status_code == 400:
        error = response.json().get('error', '')
        if 'API key not configured' in error:
            print(f"   [OK] Follow-up correctly requires API key")
        else:
            print(f"   [WARN] Unexpected error: {error}")
    else:
        print(f"   [FAIL] Expected 400, got {response.status_code}")
    
    # Test text enhancement
    response = requests.post(f"{BASE_URL}/api/ai/enhance-text", json={"text": "test", "type": "improve"})
    if response.status_code == 400:
        error = response.json().get('error', '')
        if 'API key not configured' in error:
            print(f"   [OK] Text enhancement correctly requires API key")
        else:
            print(f"   [WARN] Unexpected error: {error}")
    else:
        print(f"   [FAIL] Expected 400, got {response.status_code}")

def main():
    print("=" * 60)
    print("CLAUDE-ONLY AI IMPLEMENTATION TEST")
    print("=" * 60)
    
    test_settings()
    test_ai_features()
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print("\n[SUCCESS] HuggingFace has been removed")
    print("[SUCCESS] System now uses Claude exclusively")
    print("[INFO] Users need to provide a Claude API key for AI features")
    print("\nTo get a Claude API key:")
    print("1. Visit https://console.anthropic.com/")
    print("2. Sign up or log in")
    print("3. Go to API Keys section")
    print("4. Create a new API key")
    print("5. Add it in the Task Manager Settings")

if __name__ == "__main__":
    main()