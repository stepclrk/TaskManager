"""
AI Helper module for handling Anthropic Claude API calls
"""
import json
import requests
from typing import Dict, Any

def call_ai_api(settings: Dict[str, Any], prompt: str, task_type: str = 'general', max_tokens: int = 500) -> Dict[str, Any]:
    """
    Call the Claude API
    
    Args:
        settings: Dictionary containing API settings
        prompt: The prompt to send to Claude
        task_type: Type of task (for future extensibility)
        max_tokens: Maximum tokens for response
    
    Returns:
        Dictionary with 'success' and 'text' or 'error'
    """
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
            return {'success': True, 'text': str(response)}
            
    except ImportError:
        # Anthropic library not installed, use direct API call
        return call_anthropic_api_direct(api_key, prompt, max_tokens)
    except Exception as e:
        # If native library fails, try direct API call
        if "proxies" not in str(e):
            return {'success': False, 'error': str(e)}
        return call_anthropic_api_direct(api_key, prompt, max_tokens)

def call_anthropic_api_direct(api_key: str, prompt: str, max_tokens: int = 500) -> Dict[str, Any]:
    """
    Direct API call to Anthropic without using the library
    """
    try:
        headers = {
            'anthropic-version': '2023-06-01',
            'x-api-key': api_key,
            'content-type': 'application/json',
        }
        
        data = {
            'model': 'claude-3-haiku-20240307',
            'max_tokens': max_tokens,
            'messages': [{
                'role': 'user',
                'content': prompt
            }]
        }
        
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
            return {'success': False, 'error': 'Invalid response format'}
        else:
            error_msg = f"API error: {response.status_code}"
            try:
                error_data = response.json()
                if 'error' in error_data:
                    error_msg = f"API error: {error_data['error'].get('message', response.status_code)}"
            except:
                pass
            return {'success': False, 'error': error_msg}
            
    except requests.exceptions.RequestException as e:
        return {'success': False, 'error': f'Network error: {str(e)}'}
    except Exception as e:
        return {'success': False, 'error': f'Unexpected error: {str(e)}'}