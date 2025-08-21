let calendar;
let currentTaskId = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    
    // Button event listeners
    document.getElementById('todayBtn').addEventListener('click', () => {
        calendar.today();
    });
    
    document.getElementById('monthViewBtn').addEventListener('click', () => {
        setActiveViewButton('monthViewBtn');
        calendar.changeView('dayGridMonth');
    });
    
    document.getElementById('weekViewBtn').addEventListener('click', () => {
        setActiveViewButton('weekViewBtn');
        calendar.changeView('timeGridWeek');
    });
    
    document.getElementById('listViewBtn').addEventListener('click', () => {
        setActiveViewButton('listViewBtn');
        calendar.changeView('listWeek');
    });
    
    // Modal event listeners
    document.querySelector('#taskDetailModal .close').addEventListener('click', closeDetailModal);
    document.getElementById('closeDetailBtn').addEventListener('click', closeDetailModal);
    document.getElementById('editTaskFromCalendar').addEventListener('click', editTask);
});

function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: ''
        },
        height: 'auto',
        events: fetchEvents,
        eventClick: handleEventClick,
        eventDrop: handleEventDrop,
        editable: true,
        droppable: true,
        eventDidMount: function(info) {
            // Add tooltip
            info.el.setAttribute('title', `${info.event.title}\nCustomer: ${info.event.extendedProps.customer || 'N/A'}\nStatus: ${info.event.extendedProps.status || 'N/A'}`);
        },
        eventClassNames: function(arg) {
            const classes = [];
            const today = new Date();
            const eventDate = new Date(arg.event.start);
            
            if (eventDate < today && arg.event.extendedProps.status !== 'Completed') {
                classes.push('overdue-event');
            }
            
            return classes;
        }
    });
    
    calendar.render();
}

async function fetchEvents(fetchInfo, successCallback, failureCallback) {
    try {
        const response = await fetch('/api/calendar/events');
        const events = await response.json();
        successCallback(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        failureCallback(error);
    }
}

function handleEventClick(info) {
    currentTaskId = info.event.id;
    
    // Populate modal with task details
    document.getElementById('taskDetailTitle').textContent = info.event.title;
    document.getElementById('taskDetailCustomer').textContent = info.event.extendedProps.customer || 'N/A';
    document.getElementById('taskDetailStatus').textContent = info.event.extendedProps.status || 'N/A';
    document.getElementById('taskDetailDate').textContent = info.event.start.toLocaleDateString();
    document.getElementById('taskDetailDescription').textContent = info.event.extendedProps.description || 'No description';
    
    // Show modal
    document.getElementById('taskDetailModal').style.display = 'block';
}

async function handleEventDrop(info) {
    const taskId = info.event.id;
    const newDate = info.event.start.toISOString().split('T')[0];
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                follow_up_date: newDate
            })
        });
        
        if (!response.ok) {
            // Revert the change if update failed
            info.revert();
            alert('Failed to update task date');
        } else {
            // Show success feedback
            showSuccessFeedback('Task date updated');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        info.revert();
        alert('Error updating task date');
    }
}

function closeDetailModal() {
    document.getElementById('taskDetailModal').style.display = 'none';
    currentTaskId = null;
}

function editTask() {
    if (currentTaskId) {
        // Store the task ID and redirect to tasks page
        sessionStorage.setItem('openTaskId', currentTaskId);
        window.location.href = '/tasks';
    }
}

function setActiveViewButton(buttonId) {
    document.querySelectorAll('.view-buttons button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(buttonId).classList.add('active');
}

function showSuccessFeedback(message) {
    const feedback = document.createElement('div');
    feedback.className = 'success-feedback';
    feedback.textContent = message;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.remove();
    }, 3000);
}