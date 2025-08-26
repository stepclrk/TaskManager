"""
AI Helper module for handling Anthropic Claude API and local summary generation
"""
import json
import requests
import re
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def create_local_summary(content: str) -> str:
    """
    Create a local summary without using AI models
    This provides a structured summary of tasks with overdue alerts and recommendations
    """
    # Parse task data more comprehensively
    overdue_tasks = []
    due_today_tasks = []
    due_tomorrow_tasks = []
    high_priority_tasks = []
    critical_priority_tasks = []
    categories = {}
    statuses = {}
    customers = {}
    
    lines = content.split('\n')
    
    for line in lines:
        if line.strip().startswith('-'):
            # Extract task details
            task_info = line.strip()[1:].strip()
            
            # Check for overdue/due status
            if 'OVERDUE' in task_info:
                task_name = task_info.split(' - ')[0] if ' - ' in task_info else task_info.split(' (')[0]
                overdue_tasks.append(task_name.strip())
            elif 'DUE TODAY' in task_info:
                task_name = task_info.split(' - ')[0] if ' - ' in task_info else task_info.split(' (')[0]
                due_today_tasks.append(task_name.strip())
            elif 'Due Tomorrow' in task_info:
                task_name = task_info.split(' - ')[0] if ' - ' in task_info else task_info.split(' (')[0]
                due_tomorrow_tasks.append(task_name.strip())
            
            # Extract priority
            if 'Critical' in task_info:
                task_name = task_info.split(' (')[0] if ' (' in task_info else task_info
                critical_priority_tasks.append(task_name.strip())
            elif 'High' in task_info:
                task_name = task_info.split(' (')[0] if ' (' in task_info else task_info
                high_priority_tasks.append(task_name.strip())
            
            # Extract category
            if 'Category:' in task_info:
                cat_match = task_info.split('Category:')[1].split(',')[0].strip()
                categories[cat_match] = categories.get(cat_match, 0) + 1
            
            # Extract status
            if 'Status:' in task_info:
                status_match = task_info.split('Status:')[1].split(',')[0].strip()
                statuses[status_match] = statuses.get(status_match, 0) + 1
            
            # Extract customer
            for part in task_info.split(','):
                if part.strip() and not any(keyword in part for keyword in ['Category:', 'Status:', 'Priority:', 'OVERDUE', 'DUE TODAY']):
                    # This might be a customer name
                    customer = part.strip().split(' (')[0]
                    if customer and len(customer) < 50:  # Reasonable customer name length
                        customers[customer] = customers.get(customer, 0) + 1
    
    # Count totals
    task_count = len([l for l in lines if l.strip().startswith('-')])
    overdue_count = len(overdue_tasks)
    due_today_count = len(due_today_tasks)
    due_tomorrow_count = len(due_tomorrow_tasks)
    high_priority_count = len(high_priority_tasks) + len(critical_priority_tasks)
    
    # Build comprehensive summary
    summary_parts = []
    
    # Critical alerts section
    if overdue_count > 0:
        summary_parts.append(f"🔴 CRITICAL ALERT: {overdue_count} task{'s' if overdue_count > 1 else ''} overdue!")
        if overdue_tasks and overdue_tasks[0]:
            summary_parts.append(f"Immediate action needed on: {overdue_tasks[0][:50]}")
    elif due_today_count > 0:
        summary_parts.append(f"⚠️ TIME SENSITIVE: {due_today_count} task{'s' if due_today_count > 1 else ''} due today")
        if due_today_tasks and due_today_tasks[0]:
            summary_parts.append(f"Priority for today: {due_today_tasks[0][:50]}")
    
    # Task overview section
    summary_parts.append(f"\n📊 TASK OVERVIEW")
    summary_parts.append(f"Total Active Tasks: {task_count}")
    
    if critical_priority_tasks:
        summary_parts.append(f"Critical Priority: {len(critical_priority_tasks)}")
    if high_priority_tasks:
        summary_parts.append(f"High Priority: {len(high_priority_tasks)}")
    if due_tomorrow_count > 0:
        summary_parts.append(f"Due Tomorrow: {due_tomorrow_count}")
    
    # Category breakdown if available
    if categories and len(categories) > 1:
        summary_parts.append(f"\n📁 BY CATEGORY")
        top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:3]
        for category, count in top_categories:
            summary_parts.append(f"{category}: {count} task{'s' if count > 1 else ''}")
    
    # Status distribution if varied
    if statuses and len(statuses) > 1:
        summary_parts.append(f"\n📈 STATUS BREAKDOWN")
        for status, count in sorted(statuses.items(), key=lambda x: x[1], reverse=True):
            if status in ['Open', 'In Progress', 'Pending']:
                summary_parts.append(f"{status}: {count}")
    
    # Top customers if available
    if customers:
        summary_parts.append(f"\n👥 KEY CUSTOMERS")
        top_customers = sorted(customers.items(), key=lambda x: x[1], reverse=True)[:3]
        for customer, count in top_customers:
            if count > 1:
                summary_parts.append(f"{customer}: {count} tasks")
    
    # Action recommendations
    summary_parts.append(f"\n💡 RECOMMENDATIONS")
    if overdue_count > 0:
        summary_parts.append("• Clear overdue tasks immediately to prevent escalation")
        if overdue_count > 3:
            summary_parts.append("• Consider delegating or rescheduling lower priority items")
    elif due_today_count > 0:
        summary_parts.append("• Focus on today's deadlines first")
        summary_parts.append("• Block time for uninterrupted work on critical items")
    elif high_priority_count > 0:
        summary_parts.append("• Address high-priority tasks while you have breathing room")
        summary_parts.append("• Review upcoming deadlines to avoid last-minute rushes")
    else:
        summary_parts.append("• Good position - use this time for strategic planning")
        summary_parts.append("• Consider tackling complex tasks while workload is manageable")
    
    # Workload assessment
    summary_parts.append(f"\n📊 WORKLOAD ASSESSMENT")
    if task_count > 20:
        summary_parts.append("Heavy workload detected - consider prioritization strategies")
    elif task_count > 10:
        summary_parts.append("Moderate workload - maintain steady progress")
    else:
        summary_parts.append("Light workload - opportunity for proactive work")
    
    return '\n'.join(summary_parts)

def call_ai_api(settings: Dict[str, Any], prompt: str, task_type: str = 'general', max_tokens: int = 500) -> Dict[str, Any]:
    """
    Call the appropriate AI API based on settings
    
    Args:
        settings: Dictionary containing API settings
        prompt: The prompt to send to the AI
        task_type: Type of task (for future extensibility)
        max_tokens: Maximum tokens for response
    
    Returns:
        Dictionary with 'success' and 'text' or 'error'
    """
    ai_provider = settings.get('ai_provider', 'claude')  # Default to Claude for backward compatibility
    
    if ai_provider == 'none':
        # Use local summary generation
        # Extract content from prompt if it's a summarization task
        if task_type == 'summarization':
            # Look for task data in the prompt
            if 'Task data:\n' in prompt:
                content = prompt.split('Task data:\n', 1)[1].strip()
            else:
                content = prompt
            
            summary_text = create_local_summary(content)
            return {'success': True, 'text': summary_text}
        else:
            # For non-summarization tasks with 'none' provider
            return {'success': False, 'error': 'AI features are disabled. Please select Claude as the AI provider.'}
    
    else:
        # Use Claude (default)
        api_key = settings.get('api_key')
        
        if not api_key:
            return {'success': False, 'error': 'Claude API key not configured'}
        
        return call_anthropic_api(api_key, prompt, max_tokens)

def call_anthropic_api(api_key: str, prompt: str, max_tokens: int = 500) -> Dict[str, Any]:
    """
    Call Anthropic API with compatibility for different library versions
    """
    # First try the native library
    try:
        from anthropic import Anthropic
        
        # Try new initialization style (without proxies)
        try:
            client = Anthropic(api_key=api_key)
        except TypeError:
            # Try older initialization style
            try:
                client = Anthropic(api_key=api_key, max_retries=3)
            except:
                # Fallback to most basic initialization
                import anthropic
                anthropic.api_key = api_key
                client = anthropic.Client()
        
        # Try to create message
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=max_tokens,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )
        
        # Extract text from response
        if hasattr(response, 'content'):
            if isinstance(response.content, list) and len(response.content) > 0:
                if hasattr(response.content[0], 'text'):
                    return {'success': True, 'text': response.content[0].text}
                else:
                    return {'success': True, 'text': str(response.content[0])}
            else:
                return {'success': True, 'text': str(response.content)}
        else:
            return {'success': False, 'error': 'Unexpected response format from Claude API'}
            
    except ImportError:
        # Fallback to REST API if anthropic library is not installed
        return call_anthropic_rest_api(api_key, prompt, max_tokens)
    except Exception as e:
        return {'success': False, 'error': f'Claude API error: {str(e)}'}

def call_anthropic_rest_api(api_key: str, prompt: str, max_tokens: int = 500) -> Dict[str, Any]:
    """
    Call Anthropic API using REST endpoint (fallback method)
    """
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': api_key,
        'anthropic-version': '2023-06-01'
    }
    
    data = {
        'model': 'claude-3-haiku-20240307',
        'max_tokens': max_tokens,
        'messages': [
            {
                'role': 'user',
                'content': prompt
            }
        ]
    }
    
    try:
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if 'content' in result and len(result['content']) > 0:
                return {'success': True, 'text': result['content'][0].get('text', '')}
            else:
                return {'success': False, 'error': 'No content in response'}
        else:
            error_msg = f"API request failed with status {response.status_code}"
            try:
                error_data = response.json()
                if 'error' in error_data:
                    error_msg = f"{error_msg}: {error_data['error'].get('message', '')}"
            except:
                pass
            return {'success': False, 'error': error_msg}
            
    except requests.exceptions.Timeout:
        return {'success': False, 'error': 'API request timed out'}
    except requests.exceptions.ConnectionError:
        return {'success': False, 'error': 'Could not connect to Anthropic API'}
    except Exception as e:
        return {'success': False, 'error': f'Request failed: {str(e)}'}