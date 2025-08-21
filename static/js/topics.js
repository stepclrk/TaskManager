// Topics management with OKR functionality
let topics = [];
let currentTopic = null;
let keyResultCounter = 0;
let hasApiKey = false;

document.addEventListener('DOMContentLoaded', function() {
    checkApiKey();
    loadTopics().then(() => {
        // Check if we need to edit a specific topic
        const editTopicId = sessionStorage.getItem('editTopicId');
        if (editTopicId) {
            sessionStorage.removeItem('editTopicId');
            setTimeout(() => {
                editTopic(editTopicId);
            }, 100);
        }
    });
    
    document.getElementById('addTopicBtn').addEventListener('click', showAddTopicModal);
    document.getElementById('topicForm').addEventListener('submit', saveTopic);
    document.getElementById('enhanceObjectiveBtn').addEventListener('click', enhanceObjective);
    document.getElementById('enhanceWhyBtn').addEventListener('click', enhanceWhyMatters);
    
    // Set current quarter as default
    const currentMonth = new Date().getMonth();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    document.getElementById('topicPeriod').value = `Q${currentQuarter}`;
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('topicModal');
        if (event.target == modal) {
            closeTopicModal();
        }
    }
});

async function checkApiKey() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        
        hasApiKey = settings.api_key && settings.api_key !== '';
        
        // Show/hide AI buttons based on API key
        const enhanceObjectiveBtn = document.getElementById('enhanceObjectiveBtn');
        const enhanceWhyBtn = document.getElementById('enhanceWhyBtn');
        
        if (enhanceObjectiveBtn) {
            enhanceObjectiveBtn.style.display = hasApiKey ? 'inline-block' : 'none';
        }
        if (enhanceWhyBtn) {
            enhanceWhyBtn.style.display = hasApiKey ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('Error checking API key:', error);
        hasApiKey = false;
    }
}

async function loadTopics() {
    try {
        const response = await fetch('/api/topics');
        topics = await response.json();
        displayTopics();
        return true;
    } catch (error) {
        console.error('Error loading topics:', error);
        return false;
    }
}

function displayTopics() {
    const container = document.getElementById('topicsContainer');
    
    if (topics.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>No Objectives Yet</h3>
                <p>Create your first OKR to set ambitious goals and track measurable outcomes</p>
                <button class="btn btn-primary" onclick="showAddTopicModal()">Create Objective</button>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    topics.forEach(topic => {
        const today = new Date().toISOString().split('T')[0];
        const isOverdue = topic.target_date && topic.target_date < today && topic.status !== 'Completed';
        
        // Calculate OKR score
        const okrScore = topic.okr_score || 0;
        const scoreClass = okrScore < 0.3 ? 'score-low' : okrScore < 0.7 ? 'score-medium' : 'score-high';
        
        // Get key results summary
        const keyResults = topic.key_results || [];
        const completedKRs = keyResults.filter(kr => kr.progress >= 1).length;
        
        html += `
            <div class="topic-card" onclick="openTopic('${topic.id}')">
                <div class="topic-actions" onclick="event.stopPropagation()">
                    <button class="edit-topic-btn" onclick="editTopic('${topic.id}')">Edit</button>
                    <button class="delete-topic-btn" onclick="deleteTopic('${topic.id}')">Delete</button>
                </div>
                
                <div class="topic-header">
                    <div>
                        <span class="objective-type-badge type-${topic.objective_type || 'aspirational'}">${topic.objective_type || 'aspirational'}</span>
                        <span style="margin-left: 10px; color: #666;">${topic.period || 'Q1'}</span>
                    </div>
                </div>
                
                <div class="topic-title" style="margin: 10px 0;">${escapeHtml(topic.title)}</div>
                
                <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                    <span class="topic-status status-${(topic.status || 'active').toLowerCase().replace(' ', '-')}">${topic.status || 'Active'}</span>
                    <span class="okr-score ${scoreClass}">${Math.round(okrScore * 100)}%</span>
                    <span class="confidence-indicator">
                        🎯 ${Math.round((topic.confidence || 0.5) * 100)}% confidence
                    </span>
                </div>
                
                <div class="topic-description" style="margin-bottom: 15px;">
                    ${escapeHtml(topic.description || 'No description')}
                </div>
                
                ${keyResults.length > 0 ? `
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
                        <strong style="font-size: 0.85em; color: #666;">Key Results: ${completedKRs}/${keyResults.length} completed</strong>
                        <div style="background: #e0e0e0; height: 8px; border-radius: 4px; margin-top: 5px;">
                            <div style="background: linear-gradient(90deg, #3498db, #2980b9); height: 100%; width: ${okrScore * 100}%; border-radius: 4px;"></div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="topic-meta">
                    <div class="topic-stats">
                        <div class="stat-item">
                            <span class="stat-label">Tasks:</span>
                            <span class="stat-value">${topic.task_count || 0}</span>
                        </div>
                        ${topic.owner ? `
                            <div class="stat-item">
                                <span class="stat-label">Owner:</span>
                                <span class="stat-value">${escapeHtml(topic.owner)}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="topic-date ${isOverdue ? 'overdue' : ''}">
                        📅 ${topic.target_date || 'No target date'}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function openTopic(topicId) {
    window.location.href = `/topics/${topicId}`;
}

function showAddTopicModal() {
    currentTopic = null;
    document.getElementById('modalTitle').textContent = 'New Objective';
    document.getElementById('topicForm').reset();
    document.getElementById('topicStatus').value = 'Active';
    document.getElementById('objectiveType').value = 'aspirational';
    document.getElementById('topicConfidence').value = 50;
    updateConfidenceLabel(50);
    document.getElementById('keyResultsList').innerHTML = '';
    keyResultCounter = 0;
    
    // Set current quarter as default
    const currentMonth = new Date().getMonth();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    document.getElementById('topicPeriod').value = `Q${currentQuarter}`;
    
    document.getElementById('topicModal').style.display = 'block';
}

function editTopic(topicId) {
    event.stopPropagation();
    currentTopic = topics.find(t => t.id === topicId);
    
    if (currentTopic) {
        document.getElementById('modalTitle').textContent = 'Edit Objective';
        document.getElementById('topicTitle').value = currentTopic.title;
        document.getElementById('topicDescription').value = currentTopic.description || '';
        document.getElementById('topicStatus').value = currentTopic.status || 'Active';
        document.getElementById('topicTargetDate').value = currentTopic.target_date || '';
        document.getElementById('objectiveType').value = currentTopic.objective_type || 'aspirational';
        document.getElementById('topicPeriod').value = currentTopic.period || 'Q1';
        document.getElementById('topicConfidence').value = (currentTopic.confidence || 0.5) * 100;
        document.getElementById('topicOwner').value = currentTopic.owner || '';
        updateConfidenceLabel((currentTopic.confidence || 0.5) * 100);
        
        // Populate key results
        if (currentTopic.key_results && currentTopic.key_results.length > 0) {
            populateKeyResults(currentTopic.key_results);
        } else {
            document.getElementById('keyResultsList').innerHTML = '';
        }
        
        document.getElementById('topicModal').style.display = 'block';
    }
}

async function saveTopic(e) {
    e.preventDefault();
    
    const keyResults = getKeyResults();
    
    const topicData = {
        title: document.getElementById('topicTitle').value,
        description: document.getElementById('topicDescription').value,
        status: document.getElementById('topicStatus').value,
        target_date: document.getElementById('topicTargetDate').value,
        objective_type: document.getElementById('objectiveType').value,
        period: document.getElementById('topicPeriod').value,
        confidence: parseFloat(document.getElementById('topicConfidence').value) / 100,
        owner: document.getElementById('topicOwner').value,
        key_results: keyResults
    };
    
    try {
        let response;
        
        if (currentTopic) {
            // Preserve existing key result IDs if updating
            if (currentTopic.key_results) {
                topicData.key_results.forEach((kr, index) => {
                    if (currentTopic.key_results[index] && currentTopic.key_results[index].id) {
                        kr.id = currentTopic.key_results[index].id;
                    }
                });
            }
            
            // Update existing topic
            response = await fetch(`/api/topics/${currentTopic.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(topicData)
            });
        } else {
            // Create new topic
            response = await fetch('/api/topics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(topicData)
            });
        }
        
        if (response.ok) {
            await loadTopics();
            closeTopicModal();
        } else {
            alert('Error saving objective');
        }
    } catch (error) {
        console.error('Error saving objective:', error);
        alert('Error saving objective');
    }
}

async function deleteTopic(topicId) {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this objective? Tasks will not be deleted but will no longer be associated with this objective.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/topics/${topicId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadTopics();
        } else {
            alert('Error deleting objective');
        }
    } catch (error) {
        console.error('Error deleting topic:', error);
        alert('Error deleting topic');
    }
}

function closeTopicModal() {
    document.getElementById('topicModal').style.display = 'none';
    currentTopic = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// OKR specific functions
function updateConfidenceLabel(value) {
    document.getElementById('confidenceLabel').textContent = `${value}%`;
}

function addKeyResult() {
    keyResultCounter++;
    const container = document.getElementById('keyResultsList');
    const krDiv = document.createElement('div');
    krDiv.className = 'key-result-item';
    krDiv.id = `kr-${keyResultCounter}`;
    
    krDiv.innerHTML = `
        <button type="button" class="remove-kr-btn" onclick="removeKeyResult('kr-${keyResultCounter}')">×</button>
        <input type="text" placeholder="Key Result: e.g., 'Increase user engagement by 25%'" class="kr-title" required>
        <div class="kr-metrics">
            <div>
                <label style="font-size: 0.85em;">Start Value</label>
                <input type="number" placeholder="0" class="kr-start" value="0">
            </div>
            <div>
                <label style="font-size: 0.85em;">Target Value</label>
                <input type="number" placeholder="100" class="kr-target" value="100" required>
            </div>
            <div>
                <label style="font-size: 0.85em;">Current Value</label>
                <input type="number" placeholder="0" class="kr-current" value="0">
            </div>
        </div>
    `;
    
    container.appendChild(krDiv);
}

function removeKeyResult(krId) {
    const element = document.getElementById(krId);
    if (element) {
        element.remove();
    }
}

function getKeyResults() {
    const keyResults = [];
    const krItems = document.querySelectorAll('.key-result-item');
    
    krItems.forEach(item => {
        const title = item.querySelector('.kr-title').value;
        const startValue = parseFloat(item.querySelector('.kr-start').value) || 0;
        const targetValue = parseFloat(item.querySelector('.kr-target').value) || 100;
        const currentValue = parseFloat(item.querySelector('.kr-current').value) || 0;
        
        if (title) {
            const progress = targetValue > startValue ? 
                (currentValue - startValue) / (targetValue - startValue) : 0;
            
            keyResults.push({
                title: title,
                start_value: startValue,
                target_value: targetValue,
                current_value: currentValue,
                progress: Math.min(Math.max(progress, 0), 1), // Clamp between 0 and 1
                status: progress >= 1 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started'
            });
        }
    });
    
    return keyResults;
}

function populateKeyResults(keyResults) {
    const container = document.getElementById('keyResultsList');
    container.innerHTML = '';
    keyResultCounter = 0;
    
    keyResults.forEach(kr => {
        keyResultCounter++;
        const krDiv = document.createElement('div');
        krDiv.className = 'key-result-item';
        krDiv.id = `kr-${keyResultCounter}`;
        
        krDiv.innerHTML = `
            <button type="button" class="remove-kr-btn" onclick="removeKeyResult('kr-${keyResultCounter}')">×</button>
            <input type="text" placeholder="Key Result" class="kr-title" value="${escapeHtml(kr.title)}" required>
            <div class="kr-metrics">
                <div>
                    <label style="font-size: 0.85em;">Start Value</label>
                    <input type="number" placeholder="0" class="kr-start" value="${kr.start_value || 0}">
                </div>
                <div>
                    <label style="font-size: 0.85em;">Target Value</label>
                    <input type="number" placeholder="100" class="kr-target" value="${kr.target_value || 100}" required>
                </div>
                <div>
                    <label style="font-size: 0.85em;">Current Value</label>
                    <input type="number" placeholder="0" class="kr-current" value="${kr.current_value || 0}">
                </div>
            </div>
        `;
        
        container.appendChild(krDiv);
    });
}

// AI Enhancement Functions
async function enhanceObjective() {
    const currentText = document.getElementById('topicTitle').value;
    
    if (!currentText.trim()) {
        alert('Please enter an objective first');
        return;
    }
    
    const btn = document.getElementById('enhanceObjectiveBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="ai-loading">⟳</span> Enhancing...';
    
    try {
        const response = await fetch('/api/ai/enhance-objective', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: currentText,
                type: document.getElementById('objectiveType').value,
                period: document.getElementById('topicPeriod').value
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.enhanced_text) {
            document.getElementById('topicTitle').value = data.enhanced_text;
            
            // Flash success
            btn.style.background = '#27ae60';
            btn.innerHTML = '✓ Enhanced';
            setTimeout(() => {
                btn.style.background = '';
                btn.innerHTML = originalText;
            }, 2000);
        } else {
            alert(data.error || 'Failed to enhance objective');
            btn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Error enhancing objective:', error);
        alert('Error enhancing objective');
        btn.innerHTML = originalText;
    } finally {
        btn.disabled = false;
    }
}

async function enhanceWhyMatters() {
    const objective = document.getElementById('topicTitle').value;
    const currentText = document.getElementById('topicDescription').value;
    
    if (!objective.trim()) {
        alert('Please enter an objective first');
        return;
    }
    
    const btn = document.getElementById('enhanceWhyBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="ai-loading">⟳</span> Enhancing...';
    
    try {
        const response = await fetch('/api/ai/enhance-why-matters', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                objective: objective,
                current_text: currentText,
                type: document.getElementById('objectiveType').value,
                period: document.getElementById('topicPeriod').value
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.enhanced_text) {
            document.getElementById('topicDescription').value = data.enhanced_text;
            
            // Flash success
            btn.style.background = '#27ae60';
            btn.innerHTML = '✓ Enhanced';
            setTimeout(() => {
                btn.style.background = '';
                btn.innerHTML = originalText;
            }, 2000);
        } else {
            alert(data.error || 'Failed to enhance description');
            btn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Error enhancing why it matters:', error);
        alert('Error enhancing description');
        btn.innerHTML = originalText;
    } finally {
        btn.disabled = false;
    }
}