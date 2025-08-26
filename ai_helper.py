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
    # Count actual tasks, not section headers
    overdue_count = 0
    due_today_count = 0
    
    for line in content.split('\n'):
        if line.strip().startswith('-'):
            if 'OVERDUE' in line:
                overdue_count += 1
            elif 'DUE TODAY' in line:
                due_today_count += 1
    
    task_lines = [l for l in content.split('\n') if l.strip().startswith('-')]
    task_count = len(task_lines)
    high_priority = content.count('High') + content.count('Critical')
    
    # Extract priority task names
    overdue_task = ""
    critical_task = ""
    high_task = ""
    
    for line in content.split('\n'):
        if 'OVERDUE' in line and not overdue_task:
            # Extract task name from overdue line
            if line.strip().startswith('-'):
                parts = line.strip()[1:].strip().split(' - ')
                if parts:
                    overdue_task = parts[0].strip()
        elif 'Critical' in line and not critical_task:
            if line.strip().startswith('-'):
                parts = line.strip()[1:].strip().split(' (')
                if parts:
                    critical_task = parts[0].strip()
        elif 'High' in line and not high_task:
            if line.strip().startswith('-'):
                parts = line.strip()[1:].strip().split(' (')
                if parts:
                    high_task = parts[0].strip()
    
    # Build summary text
    summary_text = ""
    
    if overdue_count > 0:
        summary_text = f"⚠️ URGENT: {overdue_count} task{'s are' if overdue_count > 1 else ' is'} overdue and needs immediate attention"
        if overdue_task:
            summary_text += f". Start with '{overdue_task}'"
        summary_text += ". "
    elif due_today_count > 0:
        summary_text = f"📅 IMPORTANT: {due_today_count} task{'s are' if due_today_count > 1 else ' is'} due today. "
    else:
        summary_text = ""
    
    # Add specific priority task mentions
    priority_mention = ""
    if critical_task:
        priority_mention = f"Critical priority: '{critical_task}'"
    elif high_task:
        priority_mention = f"High priority: '{high_task}'"
    
    summary_text += f"You have {task_count} active tasks total with {high_priority} high-priority items. "
    
    if priority_mention:
        summary_text += f"{priority_mention}. "
    
    if overdue_count > 0:
        summary_text += "Focus on clearing overdue items immediately."
    elif due_today_count > 0:
        summary_text += "Focus on completing today's deadlines."
    elif high_priority > 0:
        summary_text += "Focus on high-priority tasks next."
    else:
        summary_text += "Stay on track with upcoming deadlines."
    
    return summary_text

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