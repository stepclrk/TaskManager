# Task Management Tool - Setup Guide

## Quick Start

1. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the application**
   ```bash
   python app.py
   ```

3. **Open in browser**
   Navigate to: `http://localhost:5000`

## First Time Setup

### 1. Configure API Key (for AI features)
- Go to Settings page
- Enter your Anthropic Claude API key
- Save the settings

### 2. Customize Categories and Statuses
- Navigate to Settings
- Add or remove categories, statuses, priorities, and tags as needed
- Click "Save All Configuration"

### 3. Create Your First Task
- Go to Tasks page
- Click "Add Task"
- Fill in the details
- Save the task

## Features Overview

### Dashboard
- View summary statistics
- See urgent and overdue tasks
- Generate AI summaries of open tasks

### Tasks Page
- Switch between List and Kanban views
- Group tasks by different criteria
- Search and filter tasks
- Export/Import functionality

### Settings
- Configure API keys
- Customize categories and statuses
- Set notification preferences

## Troubleshooting

### If notifications don't work:
- Ensure the application is running
- Check that notifications are enabled in Settings
- On Windows, check system notification settings

### If AI features don't work:
- Verify your API key is correctly entered
- Check your internet connection
- Ensure you have API credits available

### If the application won't start:
- Check that all dependencies are installed
- Verify Python version is 3.7 or higher
- Ensure port 5000 is not in use