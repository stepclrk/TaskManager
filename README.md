# Task Manager Application

A powerful, feature-rich task management system built with Flask and modern web technologies. This application provides comprehensive task tracking, AI-powered assistance, and advanced organizational features for individuals and teams.

## Features

### Core Task Management
- **Create, Read, Update, Delete (CRUD)** - Full task lifecycle management
- **Rich Text Descriptions** - Format task descriptions with the built-in rich text editor
- **Task Categorization** - Organize tasks by category, priority, status, and tags
- **Due Date Tracking** - Set and monitor follow-up dates with overdue alerts
- **Customer Association** - Link tasks to specific customers or clients

### Views & Organization
- **Multiple View Modes**
  - List View - Traditional task list display
  - Kanban Board - Drag-and-drop cards organized by status, category, priority, or customer
- **Advanced Filtering** - Search and filter tasks by any field
- **Task Templates** - Create reusable templates for common task types
- **Bulk Import/Export** - JSON-based data import and export functionality

### AI-Powered Features (Claude Integration)
- **AI Task Summaries** - Generate executive or detailed summaries of individual tasks
- **Dashboard Intelligence** - AI-generated overview of all open tasks
- **Follow-up Message Generation** - Create professional follow-up messages in various tones
- **Text Enhancement** - Improve task descriptions with AI assistance
- **Smart Context** - AI features consider task history, comments, and dependencies

### Collaboration & Tracking
- **Comments System** - Add timestamped comments to tasks
- **File Attachments** - Upload and manage files associated with tasks
- **Task Dependencies** - Define relationships between tasks
- **Activity History** - Complete audit trail of all task modifications
- **Task Dependencies** - Track which tasks depend on or block others

### User Experience
- **Desktop Notifications** - Get alerts for due and overdue tasks
- **Similar Task Detection** - Automatic detection of potential duplicate tasks
- **Customizable Settings** - Configure categories, statuses, priorities, and tags
- **Dark/Light Theme** - (Planned feature)
- **Responsive Design** - Works on desktop and mobile devices

## Installation

### Prerequisites
- Python 3.7 or higher
- pip (Python package manager)

### Quick Start

1. **Clone or download the repository**
   ```bash
   git clone https://github.com/yourusername/TaskManager.git
   cd TaskManager
   ```

2. **Run the application using the batch file (Windows)**
   ```bash
   run_task_manager.bat
   ```
   
   The batch file will:
   - Check for Python installation
   - Install required dependencies automatically
   - Create necessary data directories
   - Start the application
   - Open your browser to the application

3. **Manual Installation (All Platforms)**
   ```bash
   # Install dependencies
   pip install -r requirements.txt
   
   # Run the application
   python app.py
   ```

## Configuration

### API Key Setup (for AI Features)
1. Navigate to Settings in the application
2. Enter your Anthropic (Claude) API key
3. Save the settings
4. AI features will automatically become available

### Customization
- **Categories** - Add custom categories in Settings
- **Statuses** - Define your own workflow statuses
- **Priorities** - Customize priority levels
- **Tags** - Create tags for better organization
- **Templates** - Build reusable task templates

## Usage Guide

### Creating Tasks
1. Click the "Add Task" button or press the "+" icon
2. Fill in task details:
   - Title (required)
   - Customer name
   - Description (supports rich text formatting)
   - Category, Priority, Status
   - Due date
   - Tags
3. Optionally start from a template
4. Save the task

### Managing Tasks
- **Edit** - Click on any task to edit its details
- **Delete** - Use the delete button with confirmation
- **Drag & Drop** - In Kanban view, drag tasks between columns
- **Add Comments** - Use the Comments tab in task details
- **Upload Files** - Attach relevant documents to tasks
- **Set Dependencies** - Define task relationships in the Dependencies tab

### AI Features
- **Generate Summary** - Available in task edit mode for saved tasks
- **Follow-up Messages** - Generate professional communications
- **Enhance Text** - Improve task descriptions with AI
- **Dashboard Summary** - Get AI-powered insights on the dashboard

### Keyboard Shortcuts
- `Ctrl + S` - Save current task (when in edit mode)
- `Esc` - Close modal windows
- `Ctrl + F` - Focus search box

## File Structure
```
TaskManager/
├── app.py                  # Main Flask application
├── ai_helper.py           # AI integration module
├── run_task_manager.bat   # Windows launcher script
├── requirements.txt       # Python dependencies
├── data/                  # Data storage directory
│   ├── tasks.json        # Task data
│   ├── config.json       # Application configuration
│   ├── settings.json     # User settings
│   └── templates.json    # Task templates
├── attachments/          # Uploaded file storage
├── static/               # Static assets
│   ├── css/             # Stylesheets
│   └── js/              # JavaScript files
└── templates/           # HTML templates
```

## Data Storage
- All data is stored locally in JSON files
- No external database required
- Automatic data persistence
- Easy backup - just copy the `data/` directory

## Security Notes
- API keys are stored locally in `settings.json`
- File uploads are sanitized and stored securely
- No data is sent to external servers (except AI API calls)
- All AI API calls are made server-side to protect your API key

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - The application automatically tries multiple ports (5000, 5001, 8080, 8000, 3000)
   - If all fail, close other applications using these ports

2. **Dependencies Not Installing**
   - Run `pip install --upgrade pip` first
   - Try installing dependencies manually: `pip install Flask Flask-CORS anthropic plyer`

3. **AI Features Not Working**
   - Verify your API key is correct in Settings
   - Check your internet connection
   - Ensure your API key has sufficient credits

4. **Templates Not Loading**
   - Clear browser cache
   - Check browser console for errors
   - Verify `templates.json` exists in the `data/` directory

## Browser Compatibility
- Chrome (Recommended)
- Firefox
- Edge
- Safari
- Opera

## Contributing
Feel free to fork this project and submit pull requests with improvements.

## License
This project is open source and available under the MIT License.

## Support
For issues, questions, or suggestions, please create an issue in the GitHub repository.

## Future Enhancements
- [ ] Multi-user support
- [ ] Cloud synchronization
- [ ] Mobile applications
- [ ] Calendar integration
- [ ] Email notifications
- [ ] Recurring tasks
- [ ] Time tracking
- [ ] Gantt chart view
- [ ] Data analytics dashboard
- [ ] Webhook integrations

## Version History
- **v1.0.0** - Initial release with core task management features
- **v1.1.0** - Added AI integration with Claude
- **v1.2.0** - Implemented file attachments and dependencies
- **v1.3.0** - Enhanced UI with Kanban board and drag-and-drop

---

Built with ❤️ using Flask, JavaScript, and Claude AI