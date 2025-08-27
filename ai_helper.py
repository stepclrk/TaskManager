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
    due_this_week_tasks = []
    high_priority_tasks = []
    critical_priority_tasks = []
    categories = {}
    statuses = {}
    customers = {}
    task_titles = []
    objectives_info = []
    
    # Track sections we're in
    current_section = None
    total_count = 0
    overdue_count = 0
    due_today_count = 0
    high_priority_count = 0
    
    lines = content.split('\n')
    
    for line in lines:
        line_stripped = line.strip()
        
        # Check for section headers
        if '**' in line:
            if 'OVERDUE' in line:
                current_section = 'overdue'
            elif 'DUE TODAY' in line:
                current_section = 'due_today'
            elif 'DUE TOMORROW' in line:
                current_section = 'due_tomorrow'
            elif 'HIGH PRIORITY' in line or 'PRIORITY TASKS' in line:
                current_section = 'high_priority'
            elif 'SUMMARY' in line:
                current_section = 'summary'
            elif 'Active Objectives' in line:
                current_section = 'objectives'
            continue
            
        # Process summary statistics
        if current_section == 'summary' and line_stripped.startswith('-'):
            if 'Total active tasks:' in line:
                try:
                    total_count = int(line.split(':')[-1].strip())
                except:
                    pass
            elif 'Overdue:' in line:
                try:
                    overdue_count = int(line.split(':')[-1].strip())
                except:
                    pass
            elif 'Due today:' in line:
                try:
                    due_today_count = int(line.split(':')[-1].strip())
                except:
                    pass
            elif 'High/Critical priority:' in line:
                try:
                    high_priority_count = int(line.split(':')[-1].strip())
                except:
                    pass
        
        # Process task items
        if line_stripped.startswith('-'):
            # Extract task details
            task_info = line_stripped[1:].strip()
            
            # Extract task title (usually the first part before parentheses or dashes)
            if ' - OVERDUE' in task_info or ' - DUE' in task_info:
                task_title = task_info.split(' - ')[0].strip()
            elif ' (Priority:' in task_info:
                task_title = task_info.split(' (Priority:')[0].strip()
            elif ' (' in task_info:
                task_title = task_info.split(' (')[0].strip()
            else:
                task_title = task_info.strip()
            
            if task_title and len(task_title) > 3:  # Filter out very short/invalid titles
                # Add to appropriate list based on current section
                if current_section == 'overdue':
                    overdue_tasks.append(task_title)
                elif current_section == 'due_today':
                    due_today_tasks.append(task_title)
                elif current_section == 'due_tomorrow':
                    due_tomorrow_tasks.append(task_title)
                elif current_section == 'high_priority':
                    high_priority_tasks.append(task_title)
            
            # Extract priority
            if 'Priority: Critical' in task_info or 'critical' in task_info.lower():
                critical_priority_tasks.append(task_title)
            elif 'Priority: High' in task_info or 'high priority' in task_info.lower():
                high_priority_tasks.append(task_title)
            
            # Extract category
            if 'Category:' in task_info:
                cat_match = task_info.split('Category:')[1].split(',')[0].strip()
                categories[cat_match] = categories.get(cat_match, 0) + 1
            
            # Extract status
            if 'Status:' in task_info:
                status_match = task_info.split('Status:')[1].split(',')[0].strip()
                statuses[status_match] = statuses.get(status_match, 0) + 1
            
            # Extract customer
            if 'Customer:' in task_info:
                customer_match = task_info.split('Customer:')[1].split(',')[0].strip()
                if customer_match and customer_match != 'N/A':
                    customers[customer_match] = customers.get(customer_match, 0) + 1
        
        # Check for objectives/OKR info
        elif 'Objective:' in line or 'OKR:' in line:
            objectives_info.append(line.strip())
    
    # Use parsed counts if available, otherwise count from lists
    if overdue_count == 0:
        overdue_count = len(overdue_tasks)
    if due_today_count == 0:
        due_today_count = len(due_today_tasks)
    if total_count == 0:
        total_count = len([l for l in lines if l.strip().startswith('-')])
    
    due_tomorrow_count = len(due_tomorrow_tasks)
    
    # Build comprehensive summary with proper formatting
    summary_parts = []
    
    # Start with a brief overview paragraph
    if overdue_count > 0 or due_today_count > 0:
        summary_parts.append(f"<div style='padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; margin-bottom: 15px; border-radius: 4px;'>")
        summary_parts.append(f"<strong>⚠️ Attention Required:</strong> You have {overdue_count} overdue {'task' if overdue_count == 1 else 'tasks'} and {due_today_count} due today.</div>")
    
    # Overdue section
    if overdue_count > 0:
        summary_parts.append(f"<div style='margin-bottom: 15px;'>")
        summary_parts.append(f"<strong style='color: #dc3545;'>🔴 Overdue ({overdue_count}):</strong>")
        summary_parts.append("<ul style='margin: 5px 0; padding-left: 20px;'>")
        for task in overdue_tasks[:3]:
            if task:
                summary_parts.append(f"<li>{task}</li>")
        if overdue_count > 3:
            summary_parts.append(f"<li><em>...and {overdue_count - 3} more</em></li>")
        summary_parts.append("</ul></div>")
    
    # Today's tasks
    if due_today_count > 0:
        summary_parts.append(f"<div style='margin-bottom: 15px;'>")
        summary_parts.append(f"<strong style='color: #fd7e14;'>📅 Due Today ({due_today_count}):</strong>")
        summary_parts.append("<ul style='margin: 5px 0; padding-left: 20px;'>")
        for task in due_today_tasks[:3]:
            if task:
                summary_parts.append(f"<li>{task}</li>")
        if due_today_count > 3:
            summary_parts.append(f"<li><em>...and {due_today_count - 3} more</em></li>")
        summary_parts.append("</ul></div>")
    
    # High priority items (if we have high priority count from summary)
    if high_priority_count > 0 or high_priority_tasks:
        if high_priority_count == 0:
            high_priority_count = len(high_priority_tasks)
        summary_parts.append(f"<div style='margin-bottom: 15px;'>")
        summary_parts.append(f"<strong style='color: #6f42c1;'>🔥 High Priority ({high_priority_count}):</strong>")
        summary_parts.append("<ul style='margin: 5px 0; padding-left: 20px;'>")
        displayed = 0
        for task in high_priority_tasks[:3]:
            if task:
                summary_parts.append(f"<li>{task}</li>")
                displayed += 1
        if high_priority_count > displayed:
            summary_parts.append(f"<li><em>...and {high_priority_count - displayed} more</em></li>")
        summary_parts.append("</ul></div>")
    
    # Upcoming tasks
    if due_tomorrow_count > 0:
        summary_parts.append(f"<div style='margin-bottom: 15px;'>")
        summary_parts.append(f"<strong style='color: #20c997;'>📆 Tomorrow ({due_tomorrow_count}):</strong>")
        summary_parts.append("<ul style='margin: 5px 0; padding-left: 20px;'>")
        for task in due_tomorrow_tasks[:2]:
            if task:
                summary_parts.append(f"<li>{task}</li>")
        if due_tomorrow_count > 2:
            summary_parts.append(f"<li><em>...and {due_tomorrow_count - 2} more</em></li>")
        summary_parts.append("</ul></div>")
    
    # Quick stats in a formatted box
    summary_parts.append(f"<div style='padding: 10px; background: #e9ecef; border-radius: 4px; margin-bottom: 15px;'>")
    summary_parts.append(f"<strong>📊 Quick Stats:</strong><br/>")
    summary_parts.append(f"Total Tasks: <strong>{total_count}</strong> | ")
    summary_parts.append(f"Overdue: <strong style='color: #dc3545;'>{overdue_count}</strong> | ")
    summary_parts.append(f"Due Today: <strong style='color: #fd7e14;'>{due_today_count}</strong> | ")
    summary_parts.append(f"High Priority: <strong style='color: #6f42c1;'>{high_priority_count}</strong>")
    summary_parts.append("</div>")
    
    # Recommendations section in a nice box
    summary_parts.append(f"<div style='padding: 10px; background: #d1ecf1; border-left: 4px solid #17a2b8; border-radius: 4px;'>")
    summary_parts.append(f"<strong>💡 Recommendations:</strong><br/>")
    
    if overdue_count > 0:
        if overdue_count > 5:
            summary_parts.append(f"• <strong>Critical:</strong> Clear {overdue_count} overdue tasks immediately<br/>")
            summary_parts.append("• Consider delegation or rescheduling lower priority items<br/>")
        else:
            summary_parts.append(f"• Focus on clearing {overdue_count} overdue {'task' if overdue_count == 1 else 'tasks'} first<br/>")
            if overdue_tasks and overdue_tasks[0]:
                summary_parts.append(f"• Start with: <em>{overdue_tasks[0][:40]}</em><br/>")
    elif due_today_count > 0:
        summary_parts.append(f"• Complete {due_today_count} {'task' if due_today_count == 1 else 'tasks'} due today<br/>")
        if due_today_count > 3:
            summary_parts.append("• Time-box work to meet all deadlines<br/>")
    elif high_priority_count > 0:
        summary_parts.append(f"• Address {high_priority_count} high-priority {'task' if high_priority_count == 1 else 'tasks'}<br/>")
        if due_tomorrow_count > 0:
            summary_parts.append(f"• Prepare for tomorrow's {due_tomorrow_count} {'task' if due_tomorrow_count == 1 else 'tasks'}<br/>")
    else:
        if total_count > 10:
            summary_parts.append(f"• Maintain steady progress on {total_count} tasks<br/>")
            summary_parts.append("• Review and adjust priorities as needed<br/>")
        elif total_count > 0:
            summary_parts.append(f"• Light workload ({total_count} {'task' if total_count == 1 else 'tasks'}) - good time for planning<br/>")
            summary_parts.append("• Consider tackling complex or strategic items<br/>")
        else:
            summary_parts.append("• No active tasks - inbox is clear!<br/>")
            summary_parts.append("• Great time for planning or process improvements<br/>")
    
    summary_parts.append("</div>")
    
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