// Quick Action Buttons Module
let quickActionMenuOpen = false;

function initQuickActions() {
    // Create the quick actions container
    const container = document.createElement('div');
    container.className = 'quick-actions-container';
    container.innerHTML = `
        <div class="quick-action-backdrop" onclick="toggleQuickActionMenu()"></div>
        <div class="quick-action-menu" id="quickActionMenu">
            <div class="quick-action-item">
                <span class="quick-action-label">New Task</span>
                <button class="quick-action-btn task" onclick="quickCreateTask()" title="Create new task">
                    ✓
                </button>
            </div>
            <div class="quick-action-item">
                <span class="quick-action-label">New Project</span>
                <button class="quick-action-btn project" onclick="quickCreateProject()" title="Create new project">
                    📁
                </button>
            </div>
            <div class="quick-action-item">
                <span class="quick-action-label">New Objective</span>
                <button class="quick-action-btn objective" onclick="quickCreateObjective()" title="Create new objective">
                    🎯
                </button>
            </div>
        </div>
        <button class="quick-action-main-btn" id="quickActionMainBtn" onclick="toggleQuickActionMenu()" title="Quick actions">
            +
        </button>
    `;
    
    document.body.appendChild(container);
    
    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        const container = document.querySelector('.quick-actions-container');
        if (container && !container.contains(event.target) && quickActionMenuOpen) {
            toggleQuickActionMenu();
        }
    });
}

function toggleQuickActionMenu() {
    const menu = document.getElementById('quickActionMenu');
    const mainBtn = document.getElementById('quickActionMainBtn');
    const backdrop = document.querySelector('.quick-action-backdrop');
    
    quickActionMenuOpen = !quickActionMenuOpen;
    
    if (quickActionMenuOpen) {
        menu.classList.add('show');
        mainBtn.classList.add('active');
        backdrop.classList.add('show');
    } else {
        menu.classList.remove('show');
        mainBtn.classList.remove('active');
        backdrop.classList.remove('show');
    }
}

function quickCreateTask() {
    // Close the quick action menu
    toggleQuickActionMenu();
    
    // Check if we're on the tasks page
    if (window.location.pathname === '/tasks') {
        // If we're on the tasks page, use the existing openTaskModal function if available
        if (typeof openTaskModal === 'function') {
            openTaskModal();
        } else if (typeof openTask === 'function') {
            openTask();
        } else {
            // Fallback: try to click the add task button
            const addBtn = document.querySelector('#addTaskBtn, .add-task-btn, button[onclick*="openTask"]');
            if (addBtn) addBtn.click();
        }
    } else {
        // Store a flag in sessionStorage to open the task modal after navigation
        sessionStorage.setItem('openNewTask', 'true');
        window.location.href = '/tasks';
    }
}

function quickCreateProject() {
    // Close the quick action menu
    toggleQuickActionMenu();
    
    // Check if we're on the projects page
    if (window.location.pathname === '/projects') {
        // If we're on the projects page, use the existing openModal function
        if (typeof openModal === 'function') {
            openModal();
        } else {
            // Fallback: try to click the add project button
            const addBtn = document.querySelector('#addProjectBtn, .add-project-btn, button[onclick*="openModal"]');
            if (addBtn) addBtn.click();
        }
    } else {
        // Store a flag in sessionStorage to open the project modal after navigation
        sessionStorage.setItem('openNewProject', 'true');
        window.location.href = '/projects';
    }
}

function quickCreateObjective() {
    // Close the quick action menu
    toggleQuickActionMenu();
    
    // Check if we're on the objectives page
    if (window.location.pathname === '/objectives') {
        // If we're on the objectives page, use the existing function
        if (typeof openObjectiveModal === 'function') {
            openObjectiveModal();
        } else if (typeof openModal === 'function') {
            openModal();
        } else {
            // Fallback: try to click the add objective button
            const addBtn = document.querySelector('#addObjectiveBtn, .add-objective-btn, button[onclick*="Objective"]');
            if (addBtn) addBtn.click();
        }
    } else {
        // Store a flag in sessionStorage to open the objective modal after navigation
        sessionStorage.setItem('openNewObjective', 'true');
        window.location.href = '/objectives';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Don't show on login or certain pages
    const excludedPaths = ['/login', '/logout', '/api'];
    const currentPath = window.location.pathname;
    
    if (!excludedPaths.some(path => currentPath.startsWith(path))) {
        initQuickActions();
    }
    
    // Check for navigation flags
    if (sessionStorage.getItem('openNewTask') === 'true') {
        sessionStorage.removeItem('openNewTask');
        setTimeout(() => {
            if (typeof openTaskModal === 'function') {
                openTaskModal();
            } else if (typeof openTask === 'function') {
                openTask();
            } else {
                const addBtn = document.querySelector('#addTaskBtn, .add-task-btn, button[onclick*="openTask"]');
                if (addBtn) addBtn.click();
            }
        }, 500);
    }
    
    if (sessionStorage.getItem('openNewProject') === 'true') {
        sessionStorage.removeItem('openNewProject');
        setTimeout(() => {
            if (typeof openModal === 'function') {
                openModal();
            } else {
                const addBtn = document.querySelector('#addProjectBtn, .add-project-btn, button[onclick*="openModal"]');
                if (addBtn) addBtn.click();
            }
        }, 500);
    }
    
    if (sessionStorage.getItem('openNewObjective') === 'true') {
        sessionStorage.removeItem('openNewObjective');
        setTimeout(() => {
            if (typeof openObjectiveModal === 'function') {
                openObjectiveModal();
            } else if (typeof openModal === 'function') {
                openModal();
            } else {
                const addBtn = document.querySelector('#addObjectiveBtn, .add-objective-btn, button[onclick*="Objective"]');
                if (addBtn) addBtn.click();
            }
        }, 500);
    }
});