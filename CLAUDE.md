# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Running the Application

**Windows (preferred):**
```bash
run_task_manager.bat
```

**Manual start:**
```bash
# Install dependencies (if needed)
pip install -r requirements.txt

# Run with production server (Waitress)
python -m waitress --port=8080 --threads=4 app:app

# Run with development server (Flask)
python app.py
```

### Development Tasks

**Install/update dependencies:**
```bash
pip install -r requirements.txt
```

**Update specific dependency:**
```bash
update_dependencies.bat
```

## Architecture

### Backend Structure
- **app.py**: Main Flask application with all API endpoints. Handles routing, CRUD operations, file management, and AI integration
- **ai_helper.py**: Anthropic Claude API integration module for AI features (summaries, follow-ups, text enhancement)
- **Data Storage**: JSON-based file storage in `data/` directory:
  - `tasks.json`: Task data with full history
  - `config.json`: Categories, statuses, priorities, tags
  - `settings.json`: User settings and API keys
  - `templates.json`: Task templates
  - `objectives.json`: Objectives/topics data
  - `projects.json`: Project management data
  - `ai_summary_cache.json`: Cached AI responses
  - `dashboard_layouts.json`: Dashboard widget configurations

### Frontend Architecture
- **Templates**: Server-side rendered HTML templates using Jinja2
- **JavaScript Modules** in `static/js/`:
  - `tasks.js` / `tasks_enhanced.js`: Main task management UI logic
  - `dashboard.js`: Dashboard widgets and AI summaries
  - `objectives.js` / `objective_workspace.js`: OKR management
  - `projects.js` / `project_workspace.js`: Project management
  - `reports.js`: Analytics and reporting
  - `settings.js`: Configuration management
  - `enhanced_features.js`: Advanced features (kanban, dependencies)

### Key Features Implementation
- **Kanban Board**: Drag-and-drop functionality implemented in `tasks_enhanced.js`
- **AI Integration**: Server-side API calls through `/api/ai/*` endpoints
- **File Attachments**: Stored in `data/attachments/` with UUID-based naming
- **Task Dependencies**: Managed through task relationships in the data model
- **Real-time Notifications**: Uses `plyer` library for desktop notifications

### API Endpoints Pattern
- `/api/tasks/*`: Task CRUD operations
- `/api/config/*`: Configuration management
- `/api/settings/*`: User settings
- `/api/templates/*`: Template management
- `/api/ai/*`: AI feature endpoints
- `/api/objectives/*`: Objectives/OKR management
- `/api/projects/*`: Project management

### Data Model
Tasks contain:
- Core fields: id, title, customer, description, category, status, priority
- Dates: created_at, updated_at, follow_up_date
- Relations: tags[], dependencies[], attachments[]
- History: comments[], history[]
- AI: ai_summary, ai_summary_timestamp

## Development Guidelines

### When modifying task functionality:
1. Update both `app.py` for backend logic and corresponding JavaScript file for frontend
2. Maintain data compatibility - preserve existing JSON structure
3. Test import/export functionality after data model changes

### When adding new features:
1. Follow existing patterns for API endpoints in `app.py`
2. Create corresponding JavaScript module in `static/js/`
3. Add HTML template if new page needed
4. Update navigation in relevant templates

### AI Integration:
- All AI API calls go through `ai_helper.py`
- Cache AI responses in `ai_summary_cache.json` to reduce API calls
- Handle API key absence gracefully - features should degrade without breaking

### File Management:
- Attachments stored with UUID names in `data/attachments/`
- Always use `secure_filename()` for uploaded files
- Maintain attachment references in task data

### Error Handling:
- Backend returns consistent JSON error responses
- Frontend shows user-friendly error messages
- Log errors but don't expose sensitive information

### Testing Approach:
- No formal test suite currently exists
- Test manually through the UI
- Verify data persistence by checking JSON files
- Test import/export functionality for data integrity