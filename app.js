// Wellness Journal App
// Data stored in localStorage with export/import for backup

const STORAGE_KEY = 'wellness_journal_data';
const PEPTIDES_KEY = 'wellness_journal_peptides';

// State
let entries = [];
let savedPeptides = [];
let currentPeptides = [];
let charts = {};
let selectedRange = 7;
let editingEntryId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeTabs();
    initializeForm();
    initializeModal();
    initializeAnalytics();
    updateDateDisplay();
    setDefaultDate();
    renderHistory();
    updateWelcomeScreen();
});

// Welcome Screen
function updateWelcomeScreen() {
    // Update greeting based on time of day
    const greeting = document.getElementById('welcomeGreeting');
    const hour = new Date().getHours();
    let timeGreeting;

    if (hour < 12) {
        timeGreeting = 'Good morning';
    } else if (hour < 17) {
        timeGreeting = 'Good afternoon';
    } else {
        timeGreeting = 'Good evening';
    }

    if (entries.length === 0) {
        greeting.textContent = `Welcome, Martha!`;
    } else {
        greeting.textContent = `${timeGreeting}, Martha!`;
    }

    // Update entries count
    const entriesText = document.getElementById('welcomeEntries');
    if (entries.length === 0) {
        entriesText.textContent = 'Start tracking your wellness journey';
    } else if (entries.length === 1) {
        entriesText.textContent = '1 entry recorded';
    } else {
        entriesText.textContent = `${entries.length} entries recorded`;
    }
}

function startApp(tab) {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    switchTab(tab);

    // Check backup reminder when entering the app
    checkBackupReminder();
}

function showWelcome() {
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('welcomeScreen').classList.remove('hidden');
    updateWelcomeScreen();
}

window.startApp = startApp;
window.showWelcome = showWelcome;

// Data Management
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    entries = stored ? JSON.parse(stored) : [];

    const storedPeptides = localStorage.getItem(PEPTIDES_KEY);
    savedPeptides = storedPeptides ? JSON.parse(storedPeptides) : [
        { name: 'BPC-157', dosage: 250, unit: 'mcg', site: 'Abdomen' },
        { name: 'TB-500', dosage: 2.5, unit: 'mg', site: 'Thigh' }
    ];

    // Initialize current peptides from saved
    currentPeptides = savedPeptides.map(p => ({ ...p, administered: false }));
    renderPeptideList();
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    localStorage.setItem(PEPTIDES_KEY, JSON.stringify(savedPeptides));
    updateLastSaved();
}

function updateLastSaved() {
    localStorage.setItem('wellness_journal_last_saved', new Date().toISOString());
}

// Export/Import Functions
function exportData() {
    const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        entries: entries,
        savedPeptides: savedPeptides
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellness-journal-backup-${formatDateForFile(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem('wellness_journal_last_backup', new Date().toISOString());
    showToast('Data exported successfully!');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.entries || !Array.isArray(data.entries)) {
                throw new Error('Invalid backup file format');
            }

            // Merge or replace?
            const existingCount = entries.length;
            const importCount = data.entries.length;

            if (existingCount > 0) {
                if (confirm(`You have ${existingCount} existing entries. Import will add ${importCount} entries from backup.\n\nDuplicates (same date) will be skipped.\n\nContinue?`)) {
                    mergeEntries(data.entries);
                    if (data.savedPeptides) {
                        savedPeptides = data.savedPeptides;
                        currentPeptides = savedPeptides.map(p => ({ ...p, administered: false }));
                        renderPeptideList();
                    }
                    saveData();
                    renderHistory();
                    updateAnalytics();
                    showToast('Data imported successfully!');
                }
            } else {
                entries = data.entries;
                if (data.savedPeptides) {
                    savedPeptides = data.savedPeptides;
                    currentPeptides = savedPeptides.map(p => ({ ...p, administered: false }));
                    renderPeptideList();
                }
                saveData();
                renderHistory();
                updateAnalytics();
                showToast('Data imported successfully!');
            }
        } catch (err) {
            showToast('Error reading backup file');
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function mergeEntries(newEntries) {
    const existingDates = new Set(entries.map(e => e.date));
    let added = 0;

    newEntries.forEach(entry => {
        if (!existingDates.has(entry.date)) {
            entries.push(entry);
            added++;
        }
    });

    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    showToast(`Added ${added} new entries`);
}

function checkBackupReminder() {
    const lastBackup = localStorage.getItem('wellness_journal_last_backup');
    const entriesCount = entries.length;

    if (entriesCount >= 7 && !lastBackup) {
        setTimeout(() => {
            showToast('Tip: Export your data to keep a backup!');
        }, 2000);
    } else if (lastBackup) {
        const daysSinceBackup = Math.floor((new Date() - new Date(lastBackup)) / (1000 * 60 * 60 * 24));
        if (daysSinceBackup >= 14 && entriesCount > 0) {
            setTimeout(() => {
                showToast('Reminder: Back up your data!');
            }, 2000);
        }
    }
}

// Tab Navigation
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update content
    document.getElementById('entryTab').classList.toggle('hidden', tabName !== 'entry');
    document.getElementById('analyticsTab').classList.toggle('hidden', tabName !== 'analytics');
    document.getElementById('historyTab').classList.toggle('hidden', tabName !== 'history');

    // Update analytics when switching to that tab
    if (tabName === 'analytics') {
        updateAnalytics();
    }
}

// Form Handling
function initializeForm() {
    const form = document.getElementById('entryForm');
    const sliders = ['wellness', 'energy', 'pain', 'sleep', 'mobility'];

    sliders.forEach(name => {
        const slider = document.getElementById(`${name}Score`);
        const value = document.getElementById(`${name}Value`);

        slider.addEventListener('input', () => {
            value.textContent = slider.value;
        });
    });

    form.addEventListener('submit', handleSubmit);

    // Add peptide button
    document.getElementById('addPeptideBtn').addEventListener('click', () => {
        showPeptideModal();
    });
}

function setDefaultDate() {
    const dateInput = document.getElementById('entryDate');
    dateInput.value = formatDateForInput(new Date());
}

function handleSubmit(e) {
    e.preventDefault();

    const date = document.getElementById('entryDate').value;
    const wellness = parseInt(document.getElementById('wellnessScore').value);
    const energy = parseInt(document.getElementById('energyScore').value);
    const pain = parseInt(document.getElementById('painScore').value);
    const sleep = parseInt(document.getElementById('sleepScore').value);
    const mobility = parseInt(document.getElementById('mobilityScore').value);
    const notes = document.getElementById('notes').value.trim();

    const administeredPeptides = currentPeptides
        .filter(p => p.administered)
        .map(p => ({
            name: p.name,
            dosage: p.dosage,
            unit: p.unit,
            site: p.site
        }));

    const entry = {
        id: editingEntryId || generateId(),
        date,
        scores: { wellness, energy, pain, sleep, mobility },
        peptides: administeredPeptides,
        notes,
        createdAt: editingEntryId ? entries.find(e => e.id === editingEntryId)?.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (editingEntryId) {
        const index = entries.findIndex(e => e.id === editingEntryId);
        if (index !== -1) {
            entries[index] = entry;
        }
        editingEntryId = null;
        showToast('Entry updated!');
    } else {
        // Check for existing entry on same date
        const existingIndex = entries.findIndex(e => e.date === date);
        if (existingIndex !== -1) {
            if (confirm('An entry already exists for this date. Replace it?')) {
                entry.id = entries[existingIndex].id;
                entry.createdAt = entries[existingIndex].createdAt;
                entries[existingIndex] = entry;
            } else {
                return;
            }
        } else {
            entries.push(entry);
        }
        showToast('Entry saved!');
    }

    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    saveData();
    resetForm();
    renderHistory();
    updateAnalytics();
}

function resetForm() {
    document.getElementById('entryForm').reset();
    setDefaultDate();

    ['wellness', 'energy', 'pain', 'sleep', 'mobility'].forEach(name => {
        document.getElementById(`${name}Score`).value = 5;
        document.getElementById(`${name}Value`).textContent = '5';
    });

    currentPeptides.forEach(p => p.administered = false);
    renderPeptideList();
    editingEntryId = null;
}

// Peptide Management
function renderPeptideList() {
    const container = document.getElementById('peptideList');
    container.innerHTML = '';

    currentPeptides.forEach((peptide, index) => {
        const item = document.createElement('div');
        item.className = 'peptide-item';
        item.innerHTML = `
            <input type="checkbox" class="peptide-checkbox"
                ${peptide.administered ? 'checked' : ''}
                onchange="togglePeptide(${index})">
            <div class="peptide-info">
                <div class="peptide-name">${peptide.name}</div>
                <div class="peptide-details">${peptide.dosage} ${peptide.unit}${peptide.site ? ' • ' + peptide.site : ''}</div>
            </div>
            <button type="button" class="remove-peptide" onclick="removePeptide(${index})">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        `;
        container.appendChild(item);
    });
}

function togglePeptide(index) {
    currentPeptides[index].administered = !currentPeptides[index].administered;
}

function removePeptide(index) {
    currentPeptides.splice(index, 1);
    savedPeptides.splice(index, 1);
    saveData();
    renderPeptideList();
}

// Peptide Modal
function initializeModal() {
    const modal = document.getElementById('peptideModal');
    const cancelBtn = document.getElementById('cancelPeptide');
    const confirmBtn = document.getElementById('confirmPeptide');

    cancelBtn.addEventListener('click', hidePeptideModal);
    confirmBtn.addEventListener('click', addPeptide);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hidePeptideModal();
        }
    });
}

function showPeptideModal() {
    document.getElementById('peptideModal').classList.remove('hidden');
    document.getElementById('peptideName').focus();
}

function hidePeptideModal() {
    document.getElementById('peptideModal').classList.add('hidden');
    document.getElementById('peptideName').value = '';
    document.getElementById('peptideDosage').value = '';
    document.getElementById('peptideSite').value = '';
}

function addPeptide() {
    const name = document.getElementById('peptideName').value.trim();
    const dosage = parseFloat(document.getElementById('peptideDosage').value) || 0;
    const unit = document.getElementById('peptideUnit').value;
    const site = document.getElementById('peptideSite').value.trim();

    if (!name) {
        showToast('Please enter a peptide name');
        return;
    }

    const peptide = { name, dosage, unit, site, administered: true };
    currentPeptides.push(peptide);
    savedPeptides.push({ name, dosage, unit, site });
    saveData();
    renderPeptideList();
    hidePeptideModal();
}

// Analytics
function initializeAnalytics() {
    const rangeButtons = document.querySelectorAll('.range-btn');
    rangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            rangeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRange = btn.dataset.range === 'all' ? 'all' : parseInt(btn.dataset.range);
            updateAnalytics();
        });
    });
}

function updateAnalytics() {
    const filteredEntries = getFilteredEntries();

    updateSummaryCards(filteredEntries);
    updateCharts(filteredEntries);
    updatePeptideSummary(filteredEntries);
}

function getFilteredEntries() {
    if (selectedRange === 'all' || entries.length === 0) {
        return [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedRange);

    return entries
        .filter(e => new Date(e.date) >= cutoff)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function updateSummaryCards(filteredEntries) {
    const avgWellness = document.getElementById('avgWellness');
    const avgEnergy = document.getElementById('avgEnergy');
    const avgPain = document.getElementById('avgPain');
    const totalEntries = document.getElementById('totalEntries');

    if (filteredEntries.length === 0) {
        avgWellness.textContent = '--';
        avgEnergy.textContent = '--';
        avgPain.textContent = '--';
        totalEntries.textContent = '0';
        return;
    }

    const avg = (arr) => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);

    avgWellness.textContent = avg(filteredEntries.map(e => e.scores.wellness));
    avgEnergy.textContent = avg(filteredEntries.map(e => e.scores.energy));
    avgPain.textContent = avg(filteredEntries.map(e => e.scores.pain));
    totalEntries.textContent = filteredEntries.length;
}

function updateCharts(filteredEntries) {
    // Destroy existing charts
    if (charts.wellness) charts.wellness.destroy();
    if (charts.painMobility) charts.painMobility.destroy();

    if (filteredEntries.length === 0) {
        return;
    }

    const labels = filteredEntries.map(e => formatDateShort(e.date));

    // Wellness & Energy Chart
    const wellnessCtx = document.getElementById('wellnessChart').getContext('2d');
    charts.wellness = new Chart(wellnessCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Wellness',
                    data: filteredEntries.map(e => e.scores.wellness),
                    borderColor: '#7c9a92',
                    backgroundColor: 'rgba(124, 154, 146, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Energy',
                    data: filteredEntries.map(e => e.scores.energy),
                    borderColor: '#e8b4a2',
                    backgroundColor: 'rgba(232, 180, 162, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Sleep',
                    data: filteredEntries.map(e => e.scores.sleep),
                    borderColor: '#8ba4c9',
                    backgroundColor: 'rgba(139, 164, 201, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: getChartOptions()
    });

    // Pain & Mobility Chart
    const painCtx = document.getElementById('painMobilityChart').getContext('2d');
    charts.painMobility = new Chart(painCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Pain',
                    data: filteredEntries.map(e => e.scores.pain),
                    borderColor: '#d4726a',
                    backgroundColor: 'rgba(212, 114, 106, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Mobility',
                    data: filteredEntries.map(e => e.scores.mobility),
                    borderColor: '#7c9a92',
                    backgroundColor: 'rgba(124, 154, 146, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: getChartOptions()
    });
}

function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index'
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    padding: 16,
                    font: { size: 11 }
                }
            }
        },
        scales: {
            y: {
                min: 1,
                max: 10,
                ticks: {
                    stepSize: 1,
                    font: { size: 10 }
                },
                grid: {
                    color: 'rgba(0,0,0,0.05)'
                }
            },
            x: {
                ticks: {
                    font: { size: 10 },
                    maxRotation: 45
                },
                grid: {
                    display: false
                }
            }
        }
    };
}

function updatePeptideSummary(filteredEntries) {
    const container = document.getElementById('peptideSummary');

    const peptideCounts = {};
    filteredEntries.forEach(entry => {
        entry.peptides?.forEach(p => {
            if (!peptideCounts[p.name]) {
                peptideCounts[p.name] = { count: 0, totalDosage: 0, unit: p.unit };
            }
            peptideCounts[p.name].count++;
            peptideCounts[p.name].totalDosage += p.dosage || 0;
        });
    });

    if (Object.keys(peptideCounts).length === 0) {
        container.innerHTML = '<p class="no-data">No peptide data in selected range</p>';
        return;
    }

    container.innerHTML = Object.entries(peptideCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, data]) => `
            <div class="peptide-stat">
                <span class="peptide-stat-name">${name}</span>
                <span class="peptide-stat-count">${data.count} doses • ${data.totalDosage.toFixed(1)} ${data.unit} total</span>
            </div>
        `).join('');
}

// History
function renderHistory() {
    const container = document.getElementById('historyList');

    if (entries.length === 0) {
        container.innerHTML = `
            <p class="no-data">No entries yet. Start logging to see your history.</p>
            <div style="text-align: center; margin-top: 20px;">
                <p class="no-data" style="padding: 10px;">Have existing data?</p>
                <button onclick="document.getElementById('importInput').click()" class="submit-btn" style="max-width: 200px; padding: 14px;">
                    Import Backup
                </button>
                <input type="file" id="importInput" accept=".json" style="display: none;" onchange="handleImport(event)">
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button onclick="exportData()" class="submit-btn" style="flex: 1; padding: 12px; font-size: 0.9rem;">
                Export Backup
            </button>
            <button onclick="document.getElementById('importInput').click()" class="submit-btn" style="flex: 1; padding: 12px; font-size: 0.9rem; background: var(--text-light);">
                Import
            </button>
            <input type="file" id="importInput" accept=".json" style="display: none;" onchange="handleImport(event)">
        </div>
    ` + entries.map(entry => `
        <div class="history-item" data-id="${entry.id}">
            <div class="history-date">${formatDateLong(entry.date)}</div>
            <div class="history-scores">
                <div class="history-score">
                    <span class="history-score-label">Wellness:</span>
                    <span class="history-score-value">${entry.scores.wellness}</span>
                </div>
                <div class="history-score">
                    <span class="history-score-label">Energy:</span>
                    <span class="history-score-value">${entry.scores.energy}</span>
                </div>
                <div class="history-score">
                    <span class="history-score-label">Pain:</span>
                    <span class="history-score-value">${entry.scores.pain}</span>
                </div>
                <div class="history-score">
                    <span class="history-score-label">Sleep:</span>
                    <span class="history-score-value">${entry.scores.sleep}</span>
                </div>
                <div class="history-score">
                    <span class="history-score-label">Mobility:</span>
                    <span class="history-score-value">${entry.scores.mobility}</span>
                </div>
            </div>
            ${entry.peptides?.length ? `
                <div class="history-peptides">
                    ${entry.peptides.map(p => `
                        <span class="history-peptide-tag">${p.name} ${p.dosage}${p.unit}</span>
                    `).join('')}
                </div>
            ` : ''}
            ${entry.notes ? `<div class="history-notes">"${entry.notes}"</div>` : ''}
            <div class="history-actions">
                <button class="history-btn edit" onclick="editEntry('${entry.id}')">Edit</button>
                <button class="history-btn delete" onclick="deleteEntry('${entry.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function handleImport(event) {
    const file = event.target.files[0];
    if (file) {
        importData(file);
    }
    event.target.value = '';
}

function editEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    editingEntryId = id;

    // Populate form
    document.getElementById('entryDate').value = entry.date;
    document.getElementById('wellnessScore').value = entry.scores.wellness;
    document.getElementById('wellnessValue').textContent = entry.scores.wellness;
    document.getElementById('energyScore').value = entry.scores.energy;
    document.getElementById('energyValue').textContent = entry.scores.energy;
    document.getElementById('painScore').value = entry.scores.pain;
    document.getElementById('painValue').textContent = entry.scores.pain;
    document.getElementById('sleepScore').value = entry.scores.sleep;
    document.getElementById('sleepValue').textContent = entry.scores.sleep;
    document.getElementById('mobilityScore').value = entry.scores.mobility;
    document.getElementById('mobilityValue').textContent = entry.scores.mobility;
    document.getElementById('notes').value = entry.notes || '';

    // Set peptides
    currentPeptides.forEach(p => {
        const administered = entry.peptides?.some(ep => ep.name === p.name);
        p.administered = administered;
    });
    renderPeptideList();

    // Switch to entry tab
    switchTab('entry');
    window.scrollTo(0, 0);
    showToast('Editing entry...');
}

function deleteEntry(id) {
    if (confirm('Delete this entry? This cannot be undone.')) {
        entries = entries.filter(e => e.id !== id);
        saveData();
        renderHistory();
        updateAnalytics();
        showToast('Entry deleted');
    }
}

// Utilities
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function formatDateForFile(date) {
    return date.toISOString().split('T')[0];
}

function formatDateShort(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function updateDateDisplay() {
    const display = document.getElementById('currentDate');
    display.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Make functions available globally for onclick handlers
window.togglePeptide = togglePeptide;
window.removePeptide = removePeptide;
window.editEntry = editEntry;
window.deleteEntry = deleteEntry;
window.exportData = exportData;
window.handleImport = handleImport;
