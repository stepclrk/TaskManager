from flask import Flask, jsonify, request, render_template, send_from_directory, send_file
from flask_cors import CORS
import json
import os
from datetime import datetime, date, timedelta
import uuid
import threading
import time
# from plyer import notification  # Removed - using browser notifications only
from ai_helper import call_ai_api
from werkzeug.utils import secure_filename
import shutil
import difflib

app = Flask(__name__)
CORS(app)

DATA_FILE = 'data/tasks.json'
CONFIG_FILE = 'data/config.json'
SETTINGS_FILE = 'data/settings.json'
TEMPLATES_FILE = 'data/templates.json'
ATTACHMENTS_DIR = 'data/attachments'
DASHBOARD_LAYOUTS_FILE = 'data/dashboard_layouts.json'
AI_SUMMARY_CACHE_FILE = 'data/ai_summary_cache.json'
TOPICS_FILE = 'data/objectives.json'
PROJECTS_FILE = 'data/projects.json'

def load_tasks():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return []

def save_tasks(tasks):
    os.makedirs('data', exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(tasks, f, indent=2, default=str)

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    return {
        'categories': ['Development', 'Support', 'Bug', 'Feature', 'Documentation'],
        'statuses': ['Open', 'In Progress', 'Pending', 'Completed', 'Cancelled'],
        'priorities': ['Low', 'Medium', 'High', 'Urgent'],
        'tags': ['Frontend', 'Backend', 'Database', 'API', 'UI', 'Security']
    }

def save_config(config):
    os.makedirs('data', exist_ok=True)
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, 'r') as f:
            return json.load(f)
    return {
        'api_key': '',
        'notifications_enabled': True,
        'check_interval': 60
    }

def save_settings(settings):
    os.makedirs('data', exist_ok=True)
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=2)

def load_templates():
    if os.path.exists(TEMPLATES_FILE):
        with open(TEMPLATES_FILE, 'r') as f:
            return json.load(f)
    return {
        'templates': [
            {
                'id': 'bug-report',
                'name': 'Bug Report',
                'title_pattern': 'Bug: {issue}',
                'description': 'Steps to reproduce:\n1. \n2. \n3. \n\nExpected behavior:\n\nActual behavior:',
                'category': 'Bug',
                'priority': 'High',
                'tags': 'bug,needs-investigation'
            },
            {
                'id': 'feature-request',
                'name': 'Feature Request',
                'title_pattern': 'Feature: {feature_name}',
                'description': 'Feature Description:\n\nBusiness Value:\n\nAcceptance Criteria:\n- [ ] ',
                'category': 'Feature',
                'priority': 'Medium',
                'tags': 'feature,enhancement'
            }
        ]
    }

def save_templates(templates):
    os.makedirs('data', exist_ok=True)
    with open(TEMPLATES_FILE, 'w') as f:
        json.dump(templates, f, indent=2)

def parse_follow_up_datetime(follow_up_value):
    """Parse follow-up date/datetime string and return datetime object"""
    if not follow_up_value:
        return None
    
    # Try parsing as datetime first (YYYY-MM-DDTHH:MM format from datetime-local input)
    try:
        # Handle both with and without seconds
        if 'T' in follow_up_value:
            if len(follow_up_value) == 16:  # YYYY-MM-DDTHH:MM
                return datetime.fromisoformat(follow_up_value + ':00')
            else:
                return datetime.fromisoformat(follow_up_value)
        elif ' ' in follow_up_value:
            # Handle space-separated datetime
            return datetime.strptime(follow_up_value, '%Y-%m-%d %H:%M:%S')
    except:
        pass
    
    # Try parsing as date only (YYYY-MM-DD format)
    try:
        date_obj = datetime.strptime(follow_up_value, '%Y-%m-%d')
        # Set to end of day for date-only values for backward compatibility
        return date_obj.replace(hour=23, minute=59, second=59)
    except:
        return None

def is_overdue(follow_up_value, status=None):
    """Check if a task is overdue based on follow-up date/time"""
    if status == 'Completed':
        return False
    follow_up_dt = parse_follow_up_datetime(follow_up_value)
    if not follow_up_dt:
        return False
    return follow_up_dt < datetime.now()

def is_due_today(follow_up_value):
    """Check if a task is due today"""
    follow_up_dt = parse_follow_up_datetime(follow_up_value)
    if not follow_up_dt:
        return False
    
    today = datetime.now().date()
    return follow_up_dt.date() == today

def format_follow_up_display(follow_up_value):
    """Format follow-up date/time for display"""
    follow_up_dt = parse_follow_up_datetime(follow_up_value)
    if not follow_up_dt:
        return None
    
    # If time is set (not 23:59:59), show date and time
    if follow_up_dt.hour != 23 or follow_up_dt.minute != 59:
        return follow_up_dt.strftime('%Y-%m-%d %I:%M %p')
    # Otherwise just show date
    return follow_up_dt.strftime('%Y-%m-%d')

def load_ai_summary_cache():
    if os.path.exists(AI_SUMMARY_CACHE_FILE):
        try:
            with open(AI_SUMMARY_CACHE_FILE, 'r') as f:
                return json.load(f)
        except:
            return None
    return None

def save_ai_summary_cache(summary, include_completed_cancelled=False):
    os.makedirs('data', exist_ok=True)
    cache_data = {
        'summary': summary,
        'timestamp': datetime.now().isoformat(),
        'include_completed_cancelled': include_completed_cancelled
    }
    with open(AI_SUMMARY_CACHE_FILE, 'w') as f:
        json.dump(cache_data, f, indent=2)

def load_objectives():
    if os.path.exists(TOPICS_FILE):
        with open(TOPICS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_objectives(objectives):
    os.makedirs('data', exist_ok=True)
    with open(TOPICS_FILE, 'w') as f:
        json.dump(objectives, f, indent=2, default=str)

def load_projects():
    if os.path.exists(PROJECTS_FILE):
        with open(PROJECTS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_projects(projects):
    os.makedirs('data', exist_ok=True)
    with open(PROJECTS_FILE, 'w') as f:
        json.dump(projects, f, indent=2, default=str)

def load_dashboard_layouts():
    if os.path.exists(DASHBOARD_LAYOUTS_FILE):
        with open(DASHBOARD_LAYOUTS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_dashboard_layout(user_id, layout):
    layouts = load_dashboard_layouts()
    layouts[user_id] = layout
    os.makedirs('data', exist_ok=True)
    with open(DASHBOARD_LAYOUTS_FILE, 'w') as f:
        json.dump(layouts, f, indent=2)

def add_task_history(task_id, field, old_value, new_value, action='modified'):
    """Add history entry to a task"""
    tasks = load_tasks()
    for task in tasks:
        if task.get('id') == task_id:
            if 'history' not in task:
                task['history'] = []
            task['history'].append({
                'timestamp': datetime.now().isoformat(),
                'action': action,
                'field': field,
                'old_value': old_value,
                'new_value': new_value
            })
            save_tasks(tasks)
            break

def find_similar_tasks(task_title, task_description='', customer=''):
    """Find tasks similar to the given task"""
    tasks = load_tasks()
    similar = []
    
    for existing in tasks:
        if existing.get('status') == 'Completed':
            continue
            
        similarity_score = 0
        
        # Check title similarity
        if existing.get('title'):
            title_ratio = difflib.SequenceMatcher(None, task_title.lower(), existing['title'].lower()).ratio()
            similarity_score += title_ratio * 50
        
        # Check description similarity
        if task_description and existing.get('description'):
            desc_ratio = difflib.SequenceMatcher(None, task_description.lower(), existing['description'].lower()).ratio()
            similarity_score += desc_ratio * 30
        
        # Check customer match
        if customer and existing.get('customer_name') == customer:
            similarity_score += 20
        
        if similarity_score > 40:  # Threshold for similarity
            similar.append({
                'task': existing,
                'score': similarity_score
            })
    
    # Sort by similarity score
    similar.sort(key=lambda x: x['score'], reverse=True)
    return similar[:5]  # Return top 5 similar tasks

@app.route('/test')
def test_page():
    """Test route to verify server is working"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Server Test</title>
        <style>
            body { font-family: Arial; padding: 20px; background: #f0f0f0; }
            .success { color: green; }
            .info { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h1 class="success">✓ Server is Working!</h1>
        <div class="info">
            <h2>Navigation Links:</h2>
            <ul>
                <li><a href="/">Dashboard</a></li>
                <li><a href="/tasks">Tasks</a></li>
                <li><a href="/settings">Settings</a></li>
            </ul>
        </div>
        <div class="info">
            <h2>API Endpoints:</h2>
            <ul>
                <li><a href="/api/tasks">/api/tasks</a> - View tasks JSON</li>
                <li><a href="/api/config">/api/config</a> - View config JSON</li>
                <li><a href="/api/tasks/summary">/api/tasks/summary</a> - View summary JSON</li>
            </ul>
        </div>
    </body>
    </html>
    """

@app.route('/')
def index():
    try:
        # Check if template exists
        import os
        template_path = os.path.join(app.template_folder or 'templates', 'dashboard.html')
        if not os.path.exists(template_path):
            return f"Template not found at: {template_path}", 404
        return render_template('dashboard.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading dashboard:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/tasks')
def tasks_page():
    try:
        return render_template('tasks.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading tasks page:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/settings')
def settings_page():
    try:
        return render_template('settings.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading settings page:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

# Calendar route removed - feature disabled

@app.route('/reports')
def reports_page():
    try:
        return render_template('reports.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading reports page:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/objectives')
def objectives_page():
    try:
        return render_template('objectives.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading objectives page:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/objectives/<objective_id>')
def objective_workspace(objective_id):
    try:
        return render_template('objective_workspace.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading objective workspace:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/projects')
def projects():
    return render_template('projects.html')

@app.route('/projects/<project_id>')
def project_workspace(project_id):
    try:
        return render_template('project_workspace.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading project workspace:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = load_tasks()
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    task = request.json
    task['id'] = str(uuid.uuid4())
    task['created_date'] = datetime.now().isoformat()
    task['history'] = [{
        'timestamp': datetime.now().isoformat(),
        'action': 'created',
        'field': 'task',
        'old_value': None,
        'new_value': 'Task created'
    }]
    task['comments'] = []
    task['attachments'] = []
    task['dependencies'] = []
    task['blocks'] = []
    
    # Check for similar tasks
    similar = find_similar_tasks(
        task.get('title', ''),
        task.get('description', ''),
        task.get('customer_name', '')
    )
    
    tasks = load_tasks()
    tasks.append(task)
    save_tasks(tasks)
    
    response = {'task': task}
    if similar:
        response['similar_tasks'] = similar
    
    return jsonify(response), 201

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    tasks = load_tasks()
    task_data = request.json
    for i, task in enumerate(tasks):
        if task['id'] == task_id:
            # Track history for changed fields
            if 'history' not in tasks[i]:
                tasks[i]['history'] = []
                
            # Preserve fields that might not be sent in the update
            preserved_fields = ['history', 'comments', 'attachments', 'dependencies', 'blocks', 'created_date']
            
            for field, new_value in task_data.items():
                if field not in preserved_fields and tasks[i].get(field) != new_value:
                    tasks[i]['history'].append({
                        'timestamp': datetime.now().isoformat(),
                        'action': 'modified',
                        'field': field,
                        'old_value': tasks[i].get(field),
                        'new_value': new_value
                    })
            
            # Update task data while preserving certain fields if not provided
            for field in preserved_fields:
                if field not in task_data and field in tasks[i]:
                    task_data[field] = tasks[i][field]
            
            tasks[i].update(task_data)
            save_tasks(tasks)
            return jsonify(tasks[i])
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>/dependencies', methods=['PUT'])
def update_task_dependencies(task_id):
    """Update task dependencies"""
    tasks = load_tasks()
    dependencies = request.json.get('dependencies', [])
    
    for task in tasks:
        if task['id'] == task_id:
            task['dependencies'] = dependencies
            
            # Update blocks field for dependent tasks
            for t in tasks:
                if 'blocks' not in t:
                    t['blocks'] = []
                # Remove this task from blocks if no longer dependent
                if task_id in t.get('blocks', []) and t['id'] not in dependencies:
                    t['blocks'].remove(task_id)
                # Add this task to blocks if newly dependent
                elif t['id'] in dependencies and task_id not in t.get('blocks', []):
                    t['blocks'].append(task_id)
            
            save_tasks(tasks)
            return jsonify({'success': True, 'dependencies': dependencies})
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks = load_tasks()
    tasks = [task for task in tasks if task['id'] != task_id]
    save_tasks(tasks)
    return '', 204

@app.route('/api/tasks/summary', methods=['GET'])
def get_summary():
    tasks = load_tasks()
    topics = load_objectives()  # Load objectives
    today = date.today().isoformat()
    
    # Filter out completed and cancelled tasks for active counts
    active_statuses = ['Completed', 'Cancelled']
    active_tasks = [t for t in tasks if t.get('status') not in active_statuses]
    
    # Get active objectives
    active_objectives = [t for t in topics if t.get('status') not in ['Completed']]
    
    # Process objectives for dashboard display
    objectives_with_stats = []
    for obj in active_objectives:
        # Calculate OKR score
        okr_score = 0
        if obj.get('key_results'):
            total_progress = sum(kr.get('progress', 0) for kr in obj['key_results'])
            okr_score = total_progress / len(obj['key_results']) if obj['key_results'] else 0
        
        # Count associated tasks
        obj_tasks = [t for t in active_tasks if t.get('topic_id') == obj['id']]
        completed_obj_tasks = [t for t in tasks if t.get('topic_id') == obj['id'] and t.get('status') == 'Completed']
        
        objectives_with_stats.append({
            'id': obj.get('id'),
            'title': obj.get('title'),
            'type': obj.get('objective_type', 'aspirational'),
            'period': obj.get('period', 'Q1'),
            'confidence': obj.get('confidence', 0.5),
            'okr_score': okr_score,
            'key_results_count': len(obj.get('key_results', [])),
            'key_results_completed': sum(1 for kr in obj.get('key_results', []) if kr.get('progress', 0) >= 1),
            'total_tasks': len(obj_tasks) + len(completed_obj_tasks),
            'active_tasks': len(obj_tasks),
            'completed_tasks': len(completed_obj_tasks),
            'status': obj.get('status', 'Active'),
            'target_date': obj.get('target_date')
        })
    
    # Get all overdue tasks
    overdue_tasks = [t for t in active_tasks if is_overdue(t.get('follow_up_date'), t.get('status'))]
    # Sort overdue tasks by follow-up date (oldest first)
    overdue_tasks = sorted(overdue_tasks, key=lambda x: parse_follow_up_datetime(x.get('follow_up_date')) or datetime.min)
    
    summary = {
        'total': len(active_tasks),  # Only count active tasks
        'open': len([t for t in tasks if t.get('status') == 'Open']),
        'due_today': len([t for t in active_tasks if is_due_today(t.get('follow_up_date'))]),
        'overdue': len(overdue_tasks),
        'overdue_tasks': overdue_tasks,  # Include full list of overdue tasks
        'urgent': [t for t in active_tasks if t.get('priority') == 'Urgent'],
        'by_customer': {},
        'upcoming': [],
        'active_objectives': len(active_objectives),
        'objectives': objectives_with_stats[:5]  # Top 5 objectives for dashboard
    }
    
    # Only show active tasks grouped by customer
    for task in active_tasks:
        customer = task.get('customer_name', 'Unassigned')
        if customer not in summary['by_customer']:
            summary['by_customer'][customer] = []
        summary['by_customer'][customer].append(task)
    
    # Only show upcoming active tasks (not overdue and not due today)
    upcoming = [t for t in active_tasks if t.get('follow_up_date') and 
                not is_overdue(t.get('follow_up_date'), t.get('status')) and 
                not is_due_today(t.get('follow_up_date'))]
    # Sort by datetime properly
    upcoming = sorted(upcoming, key=lambda x: parse_follow_up_datetime(x.get('follow_up_date')) or datetime.max)[:5]
    
    return jsonify(summary)

@app.route('/api/ai/summary/cache-status', methods=['GET'])
def ai_summary_cache_status():
    """Get the cache status without generating a new summary"""
    cached = load_ai_summary_cache()
    if cached:
        cache_time = datetime.fromisoformat(cached['timestamp'])
        age_hours = (datetime.now() - cache_time).total_seconds() / 3600
        
        return jsonify({
            'has_cache': True,
            'age_hours': age_hours,
            'age_minutes': int(age_hours * 60),
            'timestamp': cached['timestamp'],
            'include_completed_cancelled': cached.get('include_completed_cancelled', False),
            'is_valid': age_hours < 3
        })
    
    return jsonify({'has_cache': False})

@app.route('/api/ai/test', methods=['POST'])
def test_api_key():
    """Test if the AI configuration is valid"""
    data = request.json
    test_key = data.get('api_key')
    ai_provider = data.get('ai_provider', 'claude')
    
    if ai_provider == 'claude':
        if not test_key:
            return jsonify({'success': False, 'error': 'No API key provided'}), 400
        
        # Create a simple test prompt
        test_prompt = "Reply with just 'OK' if you can read this message."
        
        # Test the API key
        result = call_ai_api({'api_key': test_key, 'ai_provider': 'claude'}, test_prompt, max_tokens=10)
        
        if result['success']:
            return jsonify({'success': True, 'message': 'Claude API key is valid'})
        else:
            return jsonify({'success': False, 'error': result.get('error', 'API key test failed')}), 400
    
    elif ai_provider == 'none':
        # Local summary mode is always ready
        return jsonify({'success': True, 'message': 'Template mode is ready'})
    
    else:
        return jsonify({'success': False, 'error': f'Unknown AI provider: {ai_provider}'}), 400


@app.route('/api/ai/summary', methods=['POST'])
def ai_summary():
    settings = load_settings()
    ai_provider = settings.get('ai_provider', 'claude')
    
    # Check configuration based on provider
    if ai_provider == 'claude' and not settings.get('api_key'):
        return jsonify({'error': 'Claude API key not configured'}), 400
    elif ai_provider == 'none':
        # Local summary mode doesn't need any configuration
        pass
    
    # Get optional parameter to include completed/cancelled tasks
    data = request.get_json() or {}
    include_completed_cancelled = data.get('includeCompletedCancelled', False)
    force_regenerate = data.get('forceRegenerate', False)
    
    # Check for cached summary
    if not force_regenerate:
        cached = load_ai_summary_cache()
        if cached:
            # Check if cache is valid (less than 3 hours old and same filter setting)
            cache_time = datetime.fromisoformat(cached['timestamp'])
            age_hours = (datetime.now() - cache_time).total_seconds() / 3600
            
            if age_hours < 3 and cached.get('include_completed_cancelled') == include_completed_cancelled:
                # Return cached summary with cache info
                return jsonify({
                    'summary': cached['summary'],
                    'cached': True,
                    'cache_age_minutes': int(age_hours * 60),
                    'cache_timestamp': cached['timestamp']
                })
    
    tasks = load_tasks()
    topics = load_objectives()  # Load objectives
    
    # Filter tasks based on the parameter
    if include_completed_cancelled:
        open_tasks = tasks
        active_objectives = topics
    else:
        open_tasks = [t for t in tasks if t.get('status') not in ['Completed', 'Cancelled']]
        active_objectives = [t for t in topics if t.get('status') not in ['Completed']]
    
    if not open_tasks and not active_objectives:
        summary_text = 'No active tasks or objectives to summarize.'
        save_ai_summary_cache(summary_text, include_completed_cancelled)
        return jsonify({'summary': summary_text})
    
    # Build objectives summary
    objectives_text = []
    if active_objectives:
        objectives_text.append("\n**Active Objectives (OKRs):**")
        for obj in active_objectives[:10]:
            obj_info = f"- {obj.get('title', 'Untitled')} ({obj.get('objective_type', 'aspirational').title()}, {obj.get('period', 'Q1')})"
            
            # Add confidence and progress
            if obj.get('confidence'):
                obj_info += f" - Confidence: {int(obj.get('confidence', 0.5) * 100)}%"
            
            # Add key results summary
            if obj.get('key_results'):
                completed_krs = sum(1 for kr in obj['key_results'] if kr.get('progress', 0) >= 1)
                total_krs = len(obj['key_results'])
                obj_info += f" - Key Results: {completed_krs}/{total_krs} completed"
                
                # Calculate overall OKR score
                if total_krs > 0:
                    total_progress = sum(kr.get('progress', 0) for kr in obj['key_results'])
                    okr_score = total_progress / total_krs
                    obj_info += f" (Score: {int(okr_score * 100)}%)"
            
            # Count associated tasks
            obj_tasks = [t for t in open_tasks if t.get('topic_id') == obj['id']]
            if obj_tasks:
                obj_info += f" - {len(obj_tasks)} associated tasks"
            
            objectives_text.append(obj_info)
    
    # Build enhanced tasks summary with overdue detection
    from datetime import datetime as dt, timedelta
    today = dt.now().date()
    tomorrow = today + timedelta(days=1)
    week_from_now = today + timedelta(days=7)
    
    # Categorize tasks by urgency
    overdue_tasks = []
    due_today = []
    due_tomorrow = []
    due_this_week = []
    high_priority = []
    medium_priority = []
    low_priority = []
    no_date_tasks = []
    
    for task in open_tasks:
        # Parse follow-up date
        follow_up_date_str = task.get('follow_up_date', '')
        due_status = ""
        
        if follow_up_date_str:
            try:
                # Handle both date and datetime formats
                if 'T' in follow_up_date_str:
                    follow_up_date = dt.fromisoformat(follow_up_date_str.split('T')[0]).date()
                else:
                    follow_up_date = dt.fromisoformat(follow_up_date_str).date()
                
                # Calculate due status
                if follow_up_date < today:
                    due_status = f"OVERDUE ({(today - follow_up_date).days} days)"
                    overdue_tasks.append((task, due_status))
                elif follow_up_date == today:
                    due_status = "DUE TODAY"
                    due_today.append((task, due_status))
                elif follow_up_date == tomorrow:
                    due_status = "DUE TOMORROW"
                    due_tomorrow.append((task, due_status))
                elif follow_up_date <= week_from_now:
                    due_status = f"Due in {(follow_up_date - today).days} days"
                    due_this_week.append((task, due_status))
                else:
                    due_status = f"Due {follow_up_date.strftime('%Y-%m-%d')}"
            except:
                pass
        
        # Also categorize by priority if not already in urgent lists
        # Check if task ID is in any of the urgent lists
        task_id = task.get('id')
        urgent_task_ids = [t[0].get('id') for t in overdue_tasks + due_today + due_tomorrow]
        if task_id not in urgent_task_ids:
            priority = task.get('priority', 'Medium')
            if priority == 'Critical' or priority == 'High':
                high_priority.append((task, due_status))
            elif priority == 'Medium':
                medium_priority.append((task, due_status))
            elif priority == 'Low':
                low_priority.append((task, due_status))
            else:
                no_date_tasks.append((task, due_status))
    
    # Build structured task descriptions
    task_descriptions = []
    
    # Add overdue tasks first
    if overdue_tasks:
        task_descriptions.append("\n**⚠️ OVERDUE TASKS (Immediate Action Required):**")
        for task, due_status in overdue_tasks[:5]:  # Limit to top 5
            task_descriptions.append(f"- {task.get('title', 'Untitled')} - {due_status} (Priority: {task.get('priority', 'Medium')}, Customer: {task.get('customer_name', 'N/A')})")
    
    # Add tasks due today
    if due_today:
        task_descriptions.append("\n**🔴 DUE TODAY:**")
        for task, due_status in due_today:
            task_descriptions.append(f"- {task.get('title', 'Untitled')} (Priority: {task.get('priority', 'Medium')}, Customer: {task.get('customer_name', 'N/A')})")
    
    # Add tasks due tomorrow
    if due_tomorrow:
        task_descriptions.append("\n**🟡 DUE TOMORROW:**")
        for task, due_status in due_tomorrow:
            task_descriptions.append(f"- {task.get('title', 'Untitled')} (Priority: {task.get('priority', 'Medium')})")
    
    # Add high priority tasks
    if high_priority:
        task_descriptions.append("\n**🔥 HIGH PRIORITY TASKS:**")
        for task, due_status in high_priority[:5]:  # Limit to top 5
            info = f"- {task.get('title', 'Untitled')}"
            if due_status:
                info += f" ({due_status})"
            task_descriptions.append(info)
    
    # Add summary statistics
    task_descriptions.append(f"\n**📊 SUMMARY:**")
    task_descriptions.append(f"- Total active tasks: {len(open_tasks)}")
    task_descriptions.append(f"- Overdue: {len(overdue_tasks)}")
    task_descriptions.append(f"- Due today: {len(due_today)}")
    task_descriptions.append(f"- Due this week: {len(due_this_week)}")
    task_descriptions.append(f"- High/Critical priority: {len([t for t in open_tasks if t.get('priority') in ['High', 'Critical']])}")
    
    # Combine objectives and tasks for the prompt
    all_descriptions = objectives_text + task_descriptions
    
    # Enhanced prompt for consistent structure
    prompt = f"""Generate a task summary using EXACTLY this structure (use these exact section headers):

**🚨 URGENT ITEMS:**
List any overdue or due-today tasks. If none, write "No urgent items."

**📌 PRIORITY ITEMS:**
List the top 3 high/critical priority tasks. Focus on tasks marked as High or Critical priority.

**📅 DUE ITEMS:**
List upcoming tasks with deadlines in the next 7 days (excluding today's items already mentioned).

**💡 RECOMMENDATIONS:**
Provide 2-3 specific action recommendations for task management and productivity.

Important instructions:
- Use bullet points (•) for each item under sections
- Keep each item to one line
- Be specific with task names
- Do not use "Summary:" or similar prefixes
- Do not add any other sections or formatting

Task data:
""" + "\n".join(all_descriptions)
    
    result = call_ai_api(settings, prompt, task_type='summarization', max_tokens=500)
    
    if result['success']:
        summary_text = result['text']
        # Save to cache
        save_ai_summary_cache(summary_text, include_completed_cancelled)
        return jsonify({'summary': summary_text, 'cached': False})
    else:
        # Log the error for debugging
        error_msg = result.get('error', 'Unknown error occurred')
        print(f"AI API Error: {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/ai/follow-up', methods=['POST'])
def ai_follow_up():
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    data = request.json
    task = data.get('task')
    tone = data.get('tone', 'polite')
    message_type = data.get('message_type', 'email')
    
    tone_instructions = {
        'polite': 'Write in a professional and polite tone',
        'casual': 'Write in a friendly and casual tone',
        'funny': 'Write in a humorous and light-hearted tone while still being professional',
        'forceful': 'Write in a firm and assertive tone, emphasizing urgency'
    }
    
    # Adjust instructions based on message type
    if message_type == 'messenger':
        format_instruction = "Keep it brief and conversational, suitable for instant messaging or chat (2-3 sentences max). Don't include formal greetings or signatures."
        max_tokens = 150
    else:  # email
        format_instruction = "Write a complete email with appropriate greeting, body, and professional closing."
        max_tokens = 300
    
    # Build comprehensive task context
    task_context = f"Title: {task.get('title')}\nDescription: {task.get('description')}\nCustomer: {task.get('customer_name')}\nPriority: {task.get('priority')}"
    
    # Add status and dates if available
    if task.get('status'):
        task_context += f"\nStatus: {task.get('status')}"
    if task.get('follow_up_date'):
        task_context += f"\nDue Date: {task.get('follow_up_date')}"
    if task.get('assigned_to'):
        task_context += f"\nAssigned to: {task.get('assigned_to')}"
    
    # Add comments if they exist
    if task.get('comments') and len(task['comments']) > 0:
        task_context += "\n\nRecent Comments:"
        for comment in task['comments'][-3:]:  # Last 3 comments
            task_context += f"\n- {comment.get('text', '')}"
    
    # Add dependencies context if they exist
    if task.get('dependencies') and len(task['dependencies']) > 0:
        task_context += f"\n\nNote: This task has {len(task['dependencies'])} dependencies that may need to be mentioned."
    
    prompt = f"{tone_instructions.get(tone, tone_instructions['polite'])}. {format_instruction}\n\nWrite a follow-up message for this task:\n\n{task_context}"
    
    result = call_ai_api(settings, prompt, task_type='generation', max_tokens=max_tokens)
    
    if result['success']:
        return jsonify({'message': result['text']})
    else:
        return jsonify({'error': result.get('error', 'Unknown error occurred')}), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify(load_config())

@app.route('/api/config', methods=['POST'])
def update_config():
    config = request.json
    save_config(config)
    return jsonify(config)

@app.route('/api/test-notification', methods=['GET'])
def test_notification():
    """Test endpoint - system notifications disabled, using browser notifications only"""
    return jsonify({
        'success': True, 
        'message': 'System notifications disabled. Browser notifications are active when dashboard is open.'
    })

@app.route('/api/tasks/notification-check', methods=['GET'])
def check_notification_tasks():
    """Check for tasks that need notifications (for browser notifications)"""
    tasks = load_tasks()
    
    # Get active tasks only
    active_tasks = [t for t in tasks if t.get('status') not in ['Completed', 'Cancelled']]
    
    # Find overdue tasks
    overdue = []
    for task in active_tasks:
        if is_overdue(task.get('follow_up_date'), task.get('status')):
            overdue.append({
                'id': task.get('id'),
                'title': task.get('title'),
                'follow_up_date': task.get('follow_up_date'),
                'customer_name': task.get('customer_name'),
                'priority': task.get('priority')
            })
    
    # Find tasks due soon (within next hour)
    due_soon = []
    for task in active_tasks:
        follow_up_dt = parse_follow_up_datetime(task.get('follow_up_date'))
        if follow_up_dt:
            time_until_due = (follow_up_dt - datetime.now()).total_seconds()
            # Due within next hour but not overdue
            if 0 < time_until_due <= 3600:
                due_soon.append({
                    'id': task.get('id'),
                    'title': task.get('title'),
                    'follow_up_date': task.get('follow_up_date'),
                    'customer_name': task.get('customer_name'),
                    'priority': task.get('priority'),
                    'minutesUntilDue': time_until_due / 60
                })
    
    # Find tasks due today (but not overdue or due soon)
    due_today = []
    for task in active_tasks:
        if is_due_today(task.get('follow_up_date')) and not is_overdue(task.get('follow_up_date'), task.get('status')):
            follow_up_dt = parse_follow_up_datetime(task.get('follow_up_date'))
            if follow_up_dt:
                time_until_due = (follow_up_dt - datetime.now()).total_seconds()
                # Only include if more than 1 hour away (otherwise it's in due_soon)
                if time_until_due > 3600:
                    due_today.append({
                        'id': task.get('id'),
                        'title': task.get('title'),
                        'follow_up_date': task.get('follow_up_date'),
                        'customer_name': task.get('customer_name'),
                        'priority': task.get('priority')
                    })
    
    return jsonify({
        'overdue': overdue,
        'dueSoon': due_soon,
        'dueToday': due_today
    })

@app.route('/api/settings', methods=['GET'])
def get_settings():
    settings = load_settings()
    settings_safe = settings.copy()
    if settings_safe.get('api_key'):
        settings_safe['api_key'] = '***' + settings_safe['api_key'][-4:]
    return jsonify(settings_safe)

@app.route('/api/settings', methods=['POST'])
def update_settings():
    new_settings = request.json
    current_settings = load_settings()
    
    if new_settings.get('api_key') and not new_settings['api_key'].startswith('***'):
        current_settings['api_key'] = new_settings['api_key']
    
    # Handle AI provider selection
    if 'ai_provider' in new_settings:
        current_settings['ai_provider'] = new_settings['ai_provider']
        
        # No model initialization needed anymore
    
    for key in ['notifications_enabled', 'check_interval']:
        if key in new_settings:
            current_settings[key] = new_settings[key]
    
    save_settings(current_settings)
    return jsonify({'success': True})

@app.route('/api/export', methods=['GET'])
def export_tasks():
    tasks = load_tasks()
    return jsonify(tasks)

@app.route('/api/import', methods=['POST'])
def import_tasks():
    imported_tasks = request.json
    if not isinstance(imported_tasks, list):
        return jsonify({'error': 'Invalid format'}), 400
    
    current_tasks = load_tasks()
    for task in imported_tasks:
        if 'id' not in task:
            task['id'] = str(uuid.uuid4())
        if not any(t['id'] == task['id'] for t in current_tasks):
            current_tasks.append(task)
    
    save_tasks(current_tasks)
    return jsonify({'imported': len(imported_tasks)})

# Template endpoints
@app.route('/api/templates', methods=['GET'])
def get_templates():
    templates_data = load_templates()
    return jsonify(templates_data.get('templates', []))

@app.route('/api/templates', methods=['POST'])
def create_template():
    template = request.json
    if 'id' not in template:
        template['id'] = str(uuid.uuid4())
    templates_data = load_templates()
    if 'templates' not in templates_data:
        templates_data['templates'] = []
    templates_data['templates'].append(template)
    save_templates(templates_data)
    return jsonify(template), 201

@app.route('/api/templates/<template_identifier>', methods=['DELETE'])
def delete_template(template_identifier):
    templates_data = load_templates()
    # Support deletion by both ID and name
    templates_data['templates'] = [
        t for t in templates_data['templates'] 
        if t.get('id') != template_identifier and t.get('name') != template_identifier
    ]
    save_templates(templates_data)
    return '', 204

# Topics API endpoints
@app.route('/api/topics', methods=['GET'])
def get_objectives():
    objectives = load_objectives()
    return jsonify(objectives)

@app.route('/api/topics', methods=['POST'])
def create_objective():
    objective = request.json
    objective['id'] = str(uuid.uuid4())
    objective['created_at'] = datetime.now().isoformat()
    objective['updated_at'] = datetime.now().isoformat()
    
    # Set default status if not provided
    if 'status' not in objective:
        objective['status'] = 'Active'
    
    # Initialize key results if not provided
    if 'key_results' not in objective:
        objective['key_results'] = []
    else:
        # Add IDs to key results if not present
        for kr in objective['key_results']:
            if 'id' not in kr:
                kr['id'] = str(uuid.uuid4())
            if 'progress' not in kr:
                kr['progress'] = 0
            if 'status' not in kr:
                kr['status'] = 'Not Started'
    
    # OKR specific fields
    if 'objective_type' not in objective:
        objective['objective_type'] = 'aspirational'  # or 'committed'
    if 'confidence' not in objective:
        objective['confidence'] = 0.5  # 50% confidence by default
    if 'period' not in objective:
        objective['period'] = 'Q1'  # Default quarter
    
    objectives = load_objectives()
    objectives.append(objective)
    save_objectives(objectives)
    return jsonify(objective), 201

@app.route('/api/topics/<topic_id>', methods=['GET'])
def get_objective(topic_id):
    objectives = load_objectives()
    objective = next((o for o in objectives if o['id'] == topic_id), None)
    if objective:
        # Get tasks associated with this objective
        tasks = load_tasks()
        objective_tasks = [t for t in tasks if t.get('topic_id') == topic_id]
        objective['tasks'] = objective_tasks
        objective['task_count'] = len(objective_tasks)
        objective['open_tasks'] = len([t for t in objective_tasks if t.get('status') not in ['Completed', 'Cancelled']])
        return jsonify(objective)
    return jsonify({'error': 'Objective not found'}), 404

@app.route('/api/topics/<topic_id>', methods=['PUT'])
def update_objective(topic_id):
    objectives = load_objectives()
    objective_index = next((i for i, o in enumerate(objectives) if o['id'] == topic_id), None)
    
    if objective_index is not None:
        updated_objective = request.json
        updated_objective['id'] = topic_id
        updated_objective['updated_at'] = datetime.now().isoformat()
        
        # Ensure key results have IDs
        if 'key_results' in updated_objective:
            for kr in updated_objective['key_results']:
                if 'id' not in kr:
                    kr['id'] = str(uuid.uuid4())
                if 'progress' not in kr:
                    kr['progress'] = 0
                if 'status' not in kr:
                    kr['status'] = 'Not Started'
        
        # Calculate overall OKR score based on key results
        if 'key_results' in updated_objective and len(updated_objective['key_results']) > 0:
            total_progress = sum(kr.get('progress', 0) for kr in updated_objective['key_results'])
            updated_objective['okr_score'] = total_progress / len(updated_objective['key_results'])
        else:
            updated_objective['okr_score'] = 0
        
        objectives[objective_index] = updated_objective
        save_objectives(objectives)
        return jsonify(updated_objective)
    
    return jsonify({'error': 'Objective not found'}), 404

# DELETE endpoint moved below to avoid duplication

@app.route('/api/topics/<topic_id>/tasks', methods=['GET'])
def get_objective_tasks(topic_id):
    tasks = load_tasks()
    topic_tasks = [t for t in tasks if t.get('topic_id') == topic_id]
    return jsonify(topic_tasks)

@app.route('/api/topics/<topic_id>/notes', methods=['PUT'])
def update_objective_notes(topic_id):
    objectives = load_objectives()
    objective_index = next((i for i, o in enumerate(objectives) if o['id'] == topic_id), None)
    
    if objective_index is not None:
        notes_data = request.json
        objectives[objective_index]['notes'] = notes_data.get('notes', '')
        objectives[objective_index]['updated_at'] = datetime.now().isoformat()
        
        save_objectives(objectives)
        return jsonify({'success': True})
    
    return jsonify({'error': 'Objective not found'}), 404

@app.route('/api/topics/<topic_id>', methods=['DELETE'])
def delete_objective(topic_id):
    objectives = load_objectives()
    objective_index = next((i for i, o in enumerate(objectives) if o['id'] == topic_id), None)
    
    if objective_index is not None:
        # Remove the objective
        deleted_objective = objectives.pop(objective_index)
        save_objectives(objectives)
        
        # Remove objective association from tasks
        tasks = load_tasks()
        tasks_updated = False
        for task in tasks:
            if task.get('topic_id') == topic_id:
                del task['topic_id']
                tasks_updated = True
        
        if tasks_updated:
            save_tasks(tasks)
        
        return jsonify({'success': True, 'deleted': deleted_objective})
    
    return jsonify({'error': 'Objective not found'}), 404

# Projects (Topics) endpoints
@app.route('/api/projects', methods=['GET'])
def get_projects():
    projects = load_projects()
    return jsonify(projects)

@app.route('/api/projects', methods=['POST'])
def create_project():
    project = request.json
    project['id'] = str(uuid.uuid4())
    project['created_at'] = datetime.now().isoformat()
    project['updated_at'] = datetime.now().isoformat()
    
    # Set default values
    if 'status' not in project:
        project['status'] = 'Planning'
    if 'notes' not in project:
        project['notes'] = ''
    
    projects = load_projects()
    projects.append(project)
    save_projects(projects)
    
    return jsonify(project), 201

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    projects = load_projects()
    project = next((p for p in projects if p['id'] == project_id), None)
    
    if project:
        return jsonify(project)
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        updated_data = request.json
        projects[project_index].update(updated_data)
        projects[project_index]['updated_at'] = datetime.now().isoformat()
        
        save_projects(projects)
        return jsonify(projects[project_index])
    
    return jsonify({'error': 'Project not found'}), 404

# DELETE endpoint moved below to avoid duplication

@app.route('/api/projects/<project_id>/tasks', methods=['GET'])
def get_project_tasks(project_id):
    tasks = load_tasks()
    project_tasks = [t for t in tasks if t.get('project_id') == project_id]
    return jsonify(project_tasks)

@app.route('/api/projects/<project_id>/notes', methods=['PUT'])
def update_project_notes(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        notes_data = request.json
        projects[project_index]['notes'] = notes_data.get('notes', '')
        projects[project_index]['updated_at'] = datetime.now().isoformat()
        
        save_projects(projects)
        return jsonify({'success': True})
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        # Remove the project
        deleted_project = projects.pop(project_index)
        save_projects(projects)
        
        # Remove project association from tasks
        tasks = load_tasks()
        tasks_updated = False
        for task in tasks:
            if task.get('project_id') == project_id:
                del task['project_id']
                tasks_updated = True
        
        if tasks_updated:
            save_tasks(tasks)
        
        return jsonify({'success': True, 'deleted': deleted_project})
    
    return jsonify({'error': 'Project not found'}), 404

# Comments endpoints
@app.route('/api/tasks/<task_id>/comments', methods=['POST'])
def add_comment(task_id):
    comment = request.json
    comment['id'] = str(uuid.uuid4())
    comment['timestamp'] = datetime.now().isoformat()
    
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            if 'comments' not in task:
                task['comments'] = []
            task['comments'].append(comment)
            
            # Add to history
            if 'history' not in task:
                task['history'] = []
            task['history'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'comment_added',
                'field': 'comments',
                'old_value': None,
                'new_value': comment['text']
            })
            
            save_tasks(tasks)
            return jsonify(comment), 201
    
    return jsonify({'error': 'Task not found'}), 404

# Attachments endpoints
@app.route('/api/tasks/<task_id>/attachments', methods=['POST'])
def upload_attachment(task_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Create attachment directory
    task_dir = os.path.join(ATTACHMENTS_DIR, task_id)
    os.makedirs(task_dir, exist_ok=True)
    
    # Save file with unique ID
    file_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    file_path = os.path.join(task_dir, f"{file_id}-{filename}")
    file.save(file_path)
    
    # Update task with attachment info
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            if 'attachments' not in task:
                task['attachments'] = []
            
            attachment = {
                'id': file_id,
                'filename': filename,
                'size': os.path.getsize(file_path),
                'uploaded_at': datetime.now().isoformat()
            }
            task['attachments'].append(attachment)
            
            # Add to history
            if 'history' not in task:
                task['history'] = []
            task['history'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'attachment_added',
                'field': 'attachments',
                'old_value': None,
                'new_value': filename
            })
            
            save_tasks(tasks)
            return jsonify(attachment), 201
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>/attachments/<attachment_id>', methods=['GET'])
def download_attachment(task_id, attachment_id):
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            for attachment in task.get('attachments', []):
                if attachment['id'] == attachment_id:
                    file_path = os.path.join(ATTACHMENTS_DIR, task_id, f"{attachment_id}-{attachment['filename']}")
                    if os.path.exists(file_path):
                        return send_file(file_path, as_attachment=True, download_name=attachment['filename'])
    
    return jsonify({'error': 'Attachment not found'}), 404

@app.route('/api/tasks/<task_id>/attachments/<attachment_id>', methods=['DELETE'])
def delete_attachment(task_id, attachment_id):
    """Delete an attachment from a task"""
    tasks = load_tasks()
    
    for task in tasks:
        if task['id'] == task_id:
            # Find and remove the attachment from the task
            attachments = task.get('attachments', [])
            attachment_to_delete = None
            
            for i, attachment in enumerate(attachments):
                if attachment['id'] == attachment_id:
                    attachment_to_delete = attachment
                    attachments.pop(i)
                    break
            
            if attachment_to_delete:
                # Delete the physical file
                file_path = os.path.join(ATTACHMENTS_DIR, task_id, f"{attachment_id}-{attachment_to_delete['filename']}")
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        print(f"Error deleting file: {e}")
                
                # Add to history
                if 'history' not in task:
                    task['history'] = []
                
                task['history'].append({
                    'timestamp': datetime.now().isoformat(),
                    'action': 'attachment_deleted',
                    'field': 'attachments',
                    'old_value': attachment_to_delete['filename'],
                    'new_value': None
                })
                
                # Save updated tasks
                save_tasks(tasks)
                
                return jsonify({'success': True, 'message': 'Attachment deleted successfully'})
            else:
                return jsonify({'error': 'Attachment not found'}), 404
    
    return jsonify({'error': 'Task not found'}), 404

# Similar tasks endpoint
@app.route('/api/tasks/similar', methods=['POST'])
def get_similar_tasks():
    data = request.json
    similar = find_similar_tasks(
        data.get('title', ''),
        data.get('description', ''),
        data.get('customer', '')
    )
    return jsonify(similar)

# Calendar API endpoint removed - feature disabled

# Dashboard layout endpoints
@app.route('/api/dashboard/layout', methods=['GET'])
def get_dashboard_layout():
    user_id = request.args.get('user_id', 'default')
    layouts = load_dashboard_layouts()
    return jsonify(layouts.get(user_id, {}))

@app.route('/api/dashboard/layout', methods=['POST'])
def save_dashboard_layout_endpoint():
    data = request.json
    user_id = data.get('user_id', 'default')
    layout = data.get('layout', {})
    save_dashboard_layout(user_id, layout)
    return jsonify({'success': True})

# AI text enhancement endpoint
@app.route('/api/ai/enhance-text', methods=['POST'])
def enhance_text():
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    data = request.json
    text = data.get('text', '')
    enhancement_type = data.get('type', 'improve')  # improve, grammar, professional
    task_context = data.get('task_context', None)  # Optional task context
    
    prompts = {
        'improve': 'Improve the clarity and readability of this text while maintaining its meaning. Return ONLY the improved text, no explanations or meta-text:',
        'grammar': 'Fix any grammar and spelling errors in this text. Return ONLY the corrected text, no explanations:',
        'professional': 'Rewrite this text in a more professional tone. Return ONLY the rewritten text, no explanations:'
    }
    
    # Build prompt with optional context
    prompt = prompts.get(enhancement_type, prompts['improve'])
    
    # Add task context if provided
    if task_context:
        prompt += f"\n\nContext for this text (for reference only, do not include in enhanced text):\n"
        prompt += f"Task: {task_context.get('title', 'N/A')}\n"
        if task_context.get('customer_name'):
            prompt += f"Customer: {task_context['customer_name']}\n"
        if task_context.get('priority'):
            prompt += f"Priority: {task_context['priority']}\n"
        if task_context.get('comments') and len(task_context['comments']) > 0:
            prompt += f"Recent comment: {task_context['comments'][-1].get('text', '')}\n"
    
    prompt += f"\n\nText to enhance:\n{text}"
    
    result = call_ai_api(settings, prompt, task_type='enhancement', max_tokens=500)
    
    if result['success']:
        return jsonify({'enhanced_text': result['text']})
    else:
        return jsonify({'error': result.get('error', 'Unknown error occurred')}), 500

@app.route('/api/ai/enhance-objective', methods=['POST'])
def enhance_objective():
    """Enhance an OKR objective to be more ambitious and clear"""
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    data = request.json
    current_text = data.get('text', '')
    objective_type = data.get('type', 'aspirational')
    period = data.get('period', 'Q1')
    
    if not current_text:
        return jsonify({'error': 'No text provided'}), 400
    
    # Build prompt for enhancing objective
    prompt = f"""Transform this objective into a clear, ambitious OKR objective.

Current objective: {current_text}
Type: {objective_type} ({"must achieve" if objective_type == "committed" else "stretch goal"})
Period: {period}

Requirements:
- Make it qualitative and inspirational
- Make it ambitious but achievable within the period
- Keep it concise (one sentence)
- Start with an action verb
- Focus on outcomes, not activities
- Make it memorable and motivating

Return ONLY the enhanced objective text, nothing else."""
    
    result = call_ai_api(settings, prompt, max_tokens=100)
    
    if result['success']:
        return jsonify({'enhanced_text': result['text'].strip()})
    else:
        return jsonify({'error': result.get('error', 'Failed to enhance objective')}), 500

@app.route('/api/ai/enhance-why-matters', methods=['POST'])
def enhance_why_matters():
    """Generate or enhance the 'why this matters' description for an OKR"""
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    data = request.json
    objective = data.get('objective', '')
    current_text = data.get('current_text', '')
    objective_type = data.get('type', 'aspirational')
    period = data.get('period', 'Q1')
    
    if not objective:
        return jsonify({'error': 'No objective provided'}), 400
    
    # Build prompt
    if current_text:
        prompt = f"""Enhance this explanation of why an OKR objective matters.

Objective: {objective}
Current explanation: {current_text}
Type: {objective_type}
Period: {period}

Make it more compelling by:
- Clearly explaining the business impact
- Highlighting benefits to customers/users
- Connecting to larger strategic goals
- Creating urgency and motivation
- Being specific about outcomes

Keep it to 2-3 sentences. Return ONLY the enhanced explanation."""
    else:
        prompt = f"""Explain why this OKR objective matters.

Objective: {objective}
Type: {objective_type}
Period: {period}

Write a compelling 2-3 sentence explanation that:
- Clearly states the business impact
- Highlights benefits to customers/users
- Connects to strategic goals
- Creates urgency and motivation
- Is specific about expected outcomes

Return ONLY the explanation text."""
    
    result = call_ai_api(settings, prompt, max_tokens=200)
    
    if result['success']:
        return jsonify({'enhanced_text': result['text'].strip()})
    else:
        return jsonify({'error': result.get('error', 'Failed to enhance description')}), 500

@app.route('/api/ai/task-summary/<task_id>', methods=['POST'])
def task_summary(task_id):
    """Generate executive or in-depth summary of a specific task"""
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    # Get summary type from request
    data = request.json
    summary_type = data.get('type', 'executive')  # 'executive' or 'detailed'
    
    # Load the specific task
    tasks = load_tasks()
    task = next((t for t in tasks if t['id'] == task_id), None)
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    # Build comprehensive task information
    task_info = f"Task Title: {task.get('title', 'Untitled')}\n"
    task_info += f"Customer: {task.get('customer_name', 'N/A')}\n"
    task_info += f"Status: {task.get('status', 'Unknown')}\n"
    task_info += f"Priority: {task.get('priority', 'Medium')}\n"
    task_info += f"Category: {task.get('category', 'N/A')}\n"
    
    if task.get('assigned_to'):
        task_info += f"Assigned to: {task.get('assigned_to')}\n"
    
    if task.get('follow_up_date'):
        formatted_date = format_follow_up_display(task.get('follow_up_date'))
        task_info += f"Due Date: {formatted_date or task.get('follow_up_date')}\n"
        # Calculate if overdue
        if is_overdue(task.get('follow_up_date'), task.get('status')):
            task_info += "Status Note: OVERDUE\n"
    
    if task.get('description'):
        task_info += f"\nDescription:\n{task.get('description')}\n"
    
    # Add dependencies information
    if task.get('dependencies') and len(task['dependencies']) > 0:
        task_info += f"\nDependencies ({len(task['dependencies'])} tasks):\n"
        for dep_id in task['dependencies'][:5]:  # Limit to first 5
            dep_task = next((t for t in tasks if t['id'] == dep_id), None)
            if dep_task:
                task_info += f"  - {dep_task.get('title', 'Unknown')} (Status: {dep_task.get('status', 'Unknown')})\n"
    
    # Add blocks information
    if task.get('blocks') and len(task['blocks']) > 0:
        task_info += f"\nBlocks ({len(task['blocks'])} tasks):\n"
        for block_id in task['blocks'][:5]:  # Limit to first 5
            block_task = next((t for t in tasks if t['id'] == block_id), None)
            if block_task:
                task_info += f"  - {block_task.get('title', 'Unknown')}\n"
    
    # Add comments
    if task.get('comments') and len(task['comments']) > 0:
        task_info += f"\nComments ({len(task['comments'])} total):\n"
        for comment in task['comments']:
            task_info += f"  [{comment.get('timestamp', 'Unknown time')}]: {comment.get('text', '')}\n"
    
    # Add attachments information
    if task.get('attachments') and len(task['attachments']) > 0:
        task_info += f"\nAttachments ({len(task['attachments'])} files):\n"
        for attachment in task['attachments']:
            task_info += f"  - {attachment.get('filename', 'Unknown')} ({attachment.get('size', 0)} bytes)\n"
    
    # Add history/timeline for detailed summary
    if summary_type == 'detailed' and task.get('history'):
        task_info += f"\nActivity Timeline ({len(task['history'])} events):\n"
        for event in task['history'][-10:]:  # Last 10 events
            task_info += f"  [{event.get('timestamp', '')}] {event.get('action', '')}: "
            task_info += f"{event.get('field', '')} changed"
            if event.get('old_value') and event.get('new_value'):
                task_info += f" from '{event['old_value']}' to '{event['new_value']}'"
            task_info += "\n"
    
    # Create appropriate prompt based on summary type
    if summary_type == 'executive':
        prompt = f"""Create a concise executive summary of this task. Focus on:
1. Current status and urgency
2. Key blockers or dependencies
3. Main action items needed
4. Critical dates and deadlines

Keep it brief (3-4 sentences) and highlight only the most important information.

{task_info}"""
        max_tokens = 300
    else:  # detailed
        prompt = f"""Create a comprehensive summary of this task. Include:
1. Complete overview of the task and its objectives
2. Current status and progress analysis
3. All dependencies and their impact
4. Timeline of key events and changes
5. Comments analysis and key decisions made
6. Next steps and recommendations
7. Risk assessment if applicable

Provide a thorough analysis while maintaining clarity.

{task_info}"""
        max_tokens = 800
    
    result = call_ai_api(settings, prompt, task_type='summarization', max_tokens=max_tokens)
    
    if result['success']:
        return jsonify({'summary': result['text'], 'type': summary_type})
    else:
        return jsonify({'error': result.get('error', 'Unknown error occurred')}), 500

# System notifications disabled - using browser notifications only
# The check_notifications function and related code have been commented out
# Browser notifications are handled client-side in dashboard.js

'''
# Track which tasks have been notified to avoid spam
notified_tasks = {
    'overdue': set(),
    'due_today': set(),
    'due_soon': set()
}

def check_notifications():
    import sys
    global notified_tasks
    
    while True:
        try:
            settings = load_settings()
            if settings.get('notifications_enabled'):
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking for notifications...", file=sys.stderr)
                tasks = load_tasks()
                
                # Debug: Show task follow-up times
                for task in tasks:
                    if task.get('follow_up_date') and task.get('status') != 'Completed':
                        follow_up_dt = parse_follow_up_datetime(task.get('follow_up_date'))
                        if follow_up_dt:
                            is_od = is_overdue(task.get('follow_up_date'), task.get('status'))
                            print(f"  Task '{task.get('title')}': Due {follow_up_dt.strftime('%Y-%m-%d %H:%M')} - Overdue: {is_od}", file=sys.stderr)
                
                # Filter to only show new overdue tasks
                all_overdue = [t for t in tasks if is_overdue(t.get('follow_up_date'), t.get('status'))]
                overdue = [t for t in all_overdue if t.get('id') not in notified_tasks['overdue']]
                
                all_due_today = [t for t in tasks if is_due_today(t.get('follow_up_date')) and t.get('status') != 'Completed']
                due_today = [t for t in all_due_today if t.get('id') not in notified_tasks['due_today']]
                
                # Check for tasks due within the next hour
                all_due_soon = []
                for task in tasks:
                    if task.get('status') == 'Completed':
                        continue
                    follow_up_dt = parse_follow_up_datetime(task.get('follow_up_date'))
                    if follow_up_dt:
                        time_until_due = (follow_up_dt - datetime.now()).total_seconds()
                        # Due within next hour but not overdue
                        if 0 < time_until_due <= 3600:
                            all_due_soon.append(task)
                
                due_soon = [t for t in all_due_soon if t.get('id') not in notified_tasks['due_soon']]
                
                print(f"  Found: {len(overdue)} new overdue (total: {len(all_overdue)}), "
                      f"{len(due_today)} new due today (total: {len(all_due_today)}), "
                      f"{len(due_soon)} new due soon (total: {len(all_due_soon)})", file=sys.stderr)
                
                # Clean up notified tasks that are no longer in their respective states
                # Remove from overdue list if task is no longer overdue
                notified_tasks['overdue'] = {tid for tid in notified_tasks['overdue'] 
                                            if any(t.get('id') == tid for t in all_overdue)}
                # Remove from due_today list if task is no longer due today
                notified_tasks['due_today'] = {tid for tid in notified_tasks['due_today']
                                              if any(t.get('id') == tid for t in all_due_today)}
                # Remove from due_soon list if task is no longer due soon
                notified_tasks['due_soon'] = {tid for tid in notified_tasks['due_soon']
                                             if any(t.get('id') == tid for t in all_due_soon)}
                
                # Try to send notifications with error handling
                try:
                    # On Windows, ensure the app_icon is None to avoid issues
                    if overdue:
                        notification.notify(
                            title='Overdue Tasks',
                            message=f'You have {len(overdue)} new overdue task(s)',
                            app_name='Task Manager',
                            app_icon=None,  # Important for Windows
                            timeout=10
                        )
                        # Mark these tasks as notified
                        for task in overdue:
                            notified_tasks['overdue'].add(task.get('id'))
                            print(f"  Notified for overdue: {task.get('title')}", file=sys.stderr)
                    
                    if due_today:
                        notification.notify(
                            title='Tasks Due Today',
                            message=f'You have {len(due_today)} task(s) due today',
                            app_name='Task Manager',
                            app_icon=None,  # Important for Windows
                            timeout=10
                        )
                        # Mark these tasks as notified
                        for task in due_today:
                            notified_tasks['due_today'].add(task.get('id'))
                            print(f"  Notified for due today: {task.get('title')}", file=sys.stderr)
                    
                    if due_soon:
                        notification.notify(
                            title='Tasks Due Soon',
                            message=f'You have {len(due_soon)} task(s) due within the next hour',
                            app_name='Task Manager',
                            app_icon=None,  # Important for Windows
                            timeout=10
                        )
                        # Mark these tasks as notified
                        for task in due_soon:
                            notified_tasks['due_soon'].add(task.get('id'))
                            print(f"  Notified for due soon: {task.get('title')}", file=sys.stderr)
                except Exception as e:
                    # Notifications might not work in WSL or certain environments
                    print(f"Note: Desktop notifications not available ({str(e)})", file=sys.stderr)
                    # Continue running without notifications
                    pass
            
            time.sleep(settings.get('check_interval', 60) * 60)
        except Exception as e:
            print(f"Error in notification thread: {str(e)}", file=sys.stderr)
            time.sleep(60)  # Wait a minute before retrying
'''

@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Route not found', 'error': str(error)}), 404

@app.route('/favicon.ico')
def favicon():
    return '', 204

# System notifications disabled - using browser notifications only
# notification_thread = threading.Thread(target=check_notifications, daemon=True)
# notification_thread.start()

if __name__ == '__main__':
    
    # Try different ports if 5000 is in use
    import socket
    import webbrowser
    ports_to_try = [5000, 5001, 8080, 8000, 3000]
    port = None
    
    for p in ports_to_try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', p))
        sock.close()
        if result != 0:  # Port is available
            port = p
            break
    
    if port is None:
        port = 5000  # Default fallback
    
    print("="*50)
    print("   TASK MANAGER APPLICATION")
    print("="*50)
    print(f"Starting server on port {port}...")
    print(f"Dashboard: http://localhost:{port}/")
    print(f"Tasks: http://localhost:{port}/tasks")
    print(f"Settings: http://localhost:{port}/settings")
    print("="*50)
    print("Press Ctrl+C to stop the server")
    print()
    
    # Open browser automatically after a short delay
    # Only open browser in the main process, not in the reloader process
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        def open_browser():
            time.sleep(1.5)
            webbrowser.open(f'http://localhost:{port}')
        
        browser_thread = threading.Thread(target=open_browser, daemon=True)
        browser_thread.start()
    
    app.run(debug=False, port=port, host='127.0.0.1')