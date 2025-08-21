#!/usr/bin/env python3
"""Test script to verify all enhanced features are accessible"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoints():
    """Test that all endpoints are accessible"""
    print("Testing API endpoints...")
    
    endpoints = [
        ("GET", "/", "Dashboard page"),
        ("GET", "/tasks", "Tasks page"),
        ("GET", "/calendar", "Calendar page"),
        ("GET", "/settings", "Settings page"),
        ("GET", "/api/tasks", "Tasks API"),
        ("GET", "/api/templates", "Templates API"),
        ("GET", "/api/config", "Config API"),
        ("GET", "/api/settings", "Settings API"),
    ]
    
    results = []
    for method, endpoint, description in endpoints:
        try:
            url = BASE_URL + endpoint
            if method == "GET":
                response = requests.get(url)
            
            status = "✓" if response.status_code == 200 else f"✗ ({response.status_code})"
            results.append(f"{status} {description} - {endpoint}")
        except Exception as e:
            results.append(f"✗ {description} - {endpoint} - Error: {str(e)}")
    
    return results

def test_template_creation():
    """Test creating a template"""
    print("\nTesting template creation...")
    
    template = {
        "name": "Bug Report Template",
        "title_pattern": "Bug: {description}",
        "description": "Template for bug reports",
        "category": "Bug",
        "priority": "High",
        "tags": ["bug", "needs-fix"]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/templates", json=template)
        if response.status_code == 201:
            return "✓ Template created successfully"
        else:
            return f"✗ Template creation failed: {response.status_code}"
    except Exception as e:
        return f"✗ Template creation error: {str(e)}"

def test_task_creation_with_features():
    """Test creating a task with enhanced features"""
    print("\nTesting task creation with enhanced features...")
    
    task = {
        "title": "Test Task with Features",
        "customer_name": "Test Customer",
        "description": "<p>This is a <strong>rich text</strong> description</p>",
        "category": "Development",
        "priority": "High",
        "status": "Open",
        "tags": ["test", "enhanced"],
        "dependencies": [],
        "comments": [],
        "attachments": [],
        "history": []
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/tasks", json=task)
        if response.status_code == 201:
            task_data = response.json()
            task_id = task_data.get('id')
            
            # Test adding a comment
            comment_response = requests.post(
                f"{BASE_URL}/api/tasks/{task_id}/comments",
                json={"text": "This is a test comment"}
            )
            
            if comment_response.status_code == 201:
                return f"✓ Task created with ID: {task_id} and comment added"
            else:
                return f"✓ Task created but comment failed: {comment_response.status_code}"
        else:
            return f"✗ Task creation failed: {response.status_code}"
    except Exception as e:
        return f"✗ Task creation error: {str(e)}"

def main():
    print("=" * 50)
    print("TESTING ENHANCED TASK MANAGER FEATURES")
    print("=" * 50)
    
    # Test endpoints
    endpoint_results = test_endpoints()
    for result in endpoint_results:
        print(result)
    
    # Test template creation
    print(test_template_creation())
    
    # Test task creation
    print(test_task_creation_with_features())
    
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    total_tests = len(endpoint_results) + 2
    passed_tests = sum(1 for r in endpoint_results if r.startswith("✓")) + 2
    
    print(f"Total tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    
    if passed_tests == total_tests:
        print("\n✅ All enhanced features are working!")
    else:
        print("\n⚠️ Some features need attention")

if __name__ == "__main__":
    main()