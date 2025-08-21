from flask import Flask, jsonify, request, render_template, send_from_directory, send_file
from flask_cors import CORS
import json
import os
from datetime import datetime, date, timedelta
import uuid
import threading
import time
from plyer import notification
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

@app.route('/calendar')
def calendar_page():
    try:
        return render_template('calendar.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading calendar page:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

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
                
            for field, new_value in task_data.items():
                if field not in ['history', 'comments', 'attachments'] and tasks[i].get(field) != new_value:
                    tasks[i]['history'].append({
                        'timestamp': datetime.now().isoformat(),
                        'action': 'modified',
                        'field': field,
                        'old_value': tasks[i].get(field),
                        'new_value': new_value
                    })
            
            tasks[i].update(task_data)
            save_tasks(tasks)
            return jsonify(tasks[i])
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
    today = date.today().isoformat()
    
    summary = {
        'total': len(tasks),
        'open': len([t for t in tasks if t.get('status') != 'Completed']),
        'due_today': len([t for t in tasks if t.get('follow_up_date') == today]),
        'overdue': len([t for t in tasks if t.get('follow_up_date') and t.get('follow_up_date') < today and t.get('status') != 'Completed']),
        'urgent': [t for t in tasks if t.get('priority') == 'Urgent' and t.get('status') != 'Completed'],
        'by_customer': {},
        'upcoming': []
    }
    
    for task in tasks:
        customer = task.get('customer_name', 'Unassigned')
        if customer not in summary['by_customer']:
            summary['by_customer'][customer] = []
        summary['by_customer'][customer].append(task)
    
    upcoming = [t for t in tasks if t.get('follow_up_date') and t.get('follow_up_date') > today]
    summary['upcoming'] = sorted(upcoming, key=lambda x: x.get('follow_up_date', ''))[:5]
    
    return jsonify(summary)

@app.route('/api/ai/summary', methods=['POST'])
def ai_summary():
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    tasks = load_tasks()
    open_tasks = [t for t in tasks if t.get('status') != 'Completed']
    
    if not open_tasks:
        return jsonify({'summary': 'No open tasks to summarize.'})
    
    task_descriptions = []
    for task in open_tasks[:20]:
        task_descriptions.append(f"- {task.get('title', 'Untitled')}: {task.get('description', 'No description')} (Priority: {task.get('priority', 'Medium')}, Customer: {task.get('customer_name', 'N/A')})")
    
    prompt = f"Please provide a brief executive summary of these open tasks:\n\n" + "\n".join(task_descriptions)
    
    result = call_ai_api(settings, prompt, task_type='summarization', max_tokens=500)
    
    if result['success']:
        return jsonify({'summary': result['text']})
    else:
        return jsonify({'error': result.get('error', 'Unknown error occurred')}), 500

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
    
    prompt = f"{tone_instructions.get(tone, tone_instructions['polite'])}. {format_instruction}\n\nWrite a follow-up message for this task:\n\nTitle: {task.get('title')}\nDescription: {task.get('description')}\nCustomer: {task.get('customer_name')}\nPriority: {task.get('priority')}"
    
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
    return jsonify(load_templates())

@app.route('/api/templates', methods=['POST'])
def create_template():
    template = request.json
    template['id'] = str(uuid.uuid4())
    templates_data = load_templates()
    templates_data['templates'].append(template)
    save_templates(templates_data)
    return jsonify(template), 201

@app.route('/api/templates/<template_id>', methods=['DELETE'])
def delete_template(template_id):
    templates_data = load_templates()
    templates_data['templates'] = [t for t in templates_data['templates'] if t['id'] != template_id]
    save_templates(templates_data)
    return '', 204

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

# Calendar events endpoint
@app.route('/api/calendar/events', methods=['GET'])
def get_calendar_events():
    tasks = load_tasks()
    events = []
    
    for task in tasks:
        if task.get('follow_up_date'):
            event = {
                'id': task['id'],
                'title': task.get('title', 'Untitled'),
                'start': task['follow_up_date'],
                'end': task['follow_up_date'],
                'color': '#e74c3c' if task.get('priority') == 'Urgent' else
                        '#e67e22' if task.get('priority') == 'High' else
                        '#3498db' if task.get('priority') == 'Medium' else
                        '#95a5a6',
                'extendedProps': {
                    'customer': task.get('customer_name', ''),
                    'status': task.get('status', ''),
                    'description': task.get('description', '')
                }
            }
            events.append(event)
    
    return jsonify(events)

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
    
    prompts = {
        'improve': 'Improve the clarity and readability of this text while maintaining its meaning:',
        'grammar': 'Fix any grammar and spelling errors in this text:',
        'professional': 'Rewrite this text in a more professional tone:'
    }
    
    prompt = f"{prompts.get(enhancement_type, prompts['improve'])}\n\n{text}"
    
    result = call_ai_api(settings, prompt, task_type='enhancement', max_tokens=500)
    
    if result['success']:
        return jsonify({'enhanced_text': result['text']})
    else:
        return jsonify({'error': result.get('error', 'Unknown error occurred')}), 500

def check_notifications():
    while True:
        settings = load_settings()
        if settings.get('notifications_enabled'):
            tasks = load_tasks()
            today = date.today().isoformat()
            
            overdue = [t for t in tasks if t.get('follow_up_date') and t.get('follow_up_date') < today and t.get('status') != 'Completed']
            due_today = [t for t in tasks if t.get('follow_up_date') == today and t.get('status') != 'Completed']
            
            if overdue:
                notification.notify(
                    title='Overdue Tasks',
                    message=f'You have {len(overdue)} overdue task(s)',
                    app_name='Task Manager',
                    timeout=10
                )
            
            if due_today:
                notification.notify(
                    title='Tasks Due Today',
                    message=f'You have {len(due_today)} task(s) due today',
                    app_name='Task Manager',
                    timeout=10
                )
        
        time.sleep(settings.get('check_interval', 60) * 60)

@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Route not found', 'error': str(error)}), 404

@app.route('/favicon.ico')
def favicon():
    return '', 204

if __name__ == '__main__':
    notification_thread = threading.Thread(target=check_notifications, daemon=True)
    notification_thread.start()
    
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
    def open_browser():
        time.sleep(1.5)
        webbrowser.open(f'http://localhost:{port}')
    
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    app.run(debug=True, port=port, host='127.0.0.1')