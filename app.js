const SHEET_ID = '1eeB4duepBB2TzupCC2MBAu8LL-3NBsnNV_q3B2Ji5kI';
const PERFECT_MATCH_SHEET_ID = '1h4JgEBl2eM1-n5-cKWC_G_banUE7cDrbl5RRU73l3Lg';

async function fetchSheetData(sheetName, customSheetId = SHEET_ID) {
    const url = `https://docs.google.com/spreadsheets/d/${customSheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    try {
        const response = await fetch(url);
        const text = await response.text();
        // The API returns text wrapped in a function call. Strip it.
        const jsonString = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonString);
        return data.table;
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        return null;
    }
}

// Convert "H:MM:SS" to total seconds
function timeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

// Convert total seconds back to "MM:SS"
function secondsToTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// -- Leaderboard Logic --
async function initLeaderboard() {
    const loader = document.getElementById('loader');
    const container = document.getElementById('podium-container');
    if (!container) return;

    const table = await fetchSheetData('Leaderboard');
    if (!table) {
        container.innerHTML = '<p>Error loading data</p>';
        return;
    }

    // Col 0: Team number, Col 8: Total Points (index 8 is 9th column)
    const teams = [];
    // Start from 1 to skip header if it's there, but actually the API sometimes separates headers to `cols` and data to `rows`.
    // Let's iterate all rows.
    table.rows.forEach(row => {
        const teamName = row.c[0] ? row.c[0].v : null;
        const points = row.c[8] ? parseInt(row.c[8].v) : 0;
        
        if (teamName && teamName.toLowerCase().startsWith('team')) {
            teams.push({ name: teamName, points: isNaN(points) ? 0 : points });
        }
    });

    // Sort descending
    teams.sort((a, b) => b.points - a.points);
    
    // We want top 2 only
    const top2 = teams.slice(0, 2);
    
    // Order for visual podium (2nd on left, 1st on right)
    const renderOrder = [];
    if (top2[1]) renderOrder.push({...top2[1], rank: 2});
    if (top2[0]) renderOrder.push({...top2[0], rank: 1});

    const ordinals = ['', '1st Place', '2nd Place', '3rd Place', '4th Place'];

    loader.classList.add('hidden');
    
    renderOrder.forEach((team, index) => {
        const item = document.createElement('div');
        item.className = `podium-item rank-${team.rank}`;
        
        item.innerHTML = `
            <div class="team-info">
                <div class="team-name">${team.name.toUpperCase()}</div>
                <div class="team-score">${team.points} pts</div>
            </div>
            <div class="team-avatar">
                <img src="pharmacist.png" alt="Pharmacist" class="avatar-icon">
            </div>
            <div class="podium-bar">
                <span>${ordinals[team.rank]}</span>
            </div>
        `;
        container.appendChild(item);
    });

    // Animate podium elements with a staggered effect
    setTimeout(() => {
        document.querySelectorAll('.podium-item').forEach((item, idx) => {
            setTimeout(() => {
                item.classList.add('animate');
            }, idx * 150);
        });
    }, 100);
}

// -- Dashboard Logic --
async function initDashboard(sheetName) {
    const loader = document.getElementById('loader');
    const tableBody = document.getElementById('data-table-body');
    const podiumSmall = document.getElementById('podium-small-content');
    if (!tableBody) return;

    const table = await fetchSheetData(sheetName);
    if (!table) {
        tableBody.innerHTML = '<tr><td colspan="4">Error loading data</td></tr>';
        loader.classList.add('hidden');
        return;
    }

    const attendees = [];
    const teamStats = {};

    table.rows.forEach(row => {
        const teamNum = row.c[0] ? row.c[0].v : null;
        const attendeeName = row.c[1] ? row.c[1].v : null;
        const durationStr = row.c[5] ? row.c[5].f || row.c[5].v : null; // "f" has formatted string like "0:03:20"
        let trials = row.c[6] ? row.c[6].v : null;

        if (teamNum && teamNum.toLowerCase().startsWith('team') && attendeeName) {
            
            if (typeof trials === 'string') trials = parseInt(trials);
            if (isNaN(trials)) trials = 0;
            
            const seconds = timeToSeconds(durationStr);
            
            attendees.push({ teamNum, attendeeName, durationStr: durationStr || '0:00:00', trials });

            if (!teamStats[teamNum]) {
                teamStats[teamNum] = { totalSeconds: 0, totalTrials: 0, count: 0 };
            }
            teamStats[teamNum].totalSeconds += seconds;
            teamStats[teamNum].totalTrials += trials;
            teamStats[teamNum].count += 1;
        }
    });

    // Populate Table
    attendees.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${a.attendeeName}</td>
            <td>${a.teamNum.toUpperCase()}</td>
            <td>${a.durationStr}</td>
            <td>${a.trials}</td>
        `;
        tableBody.appendChild(tr);
    });

    // Populate Small Podium
    const teamAverages = Object.keys(teamStats).map(teamName => {
        const stats = teamStats[teamName];
        return {
            name: teamName,
            avgSeconds: stats.totalSeconds / stats.count,
            avgTrials: stats.totalTrials / stats.count
        };
    });

    // Sort by best duration (lowest time)
    teamAverages.sort((a, b) => a.avgSeconds - b.avgSeconds);

    if (podiumSmall) {
        teamAverages.forEach(team => {
            const div = document.createElement('div');
            div.className = 'podium-small-item';
            div.innerHTML = `
                <strong>${team.name.toUpperCase()}</strong>
                <span>⏱️ ${secondsToTime(team.avgSeconds)} | 🔄 ${team.avgTrials.toFixed(1)}</span>
            `;
            podiumSmall.appendChild(div);
        });
    }

    loader.classList.add('hidden');
    document.querySelector('.dashboard-grid').classList.remove('hidden');
    document.querySelector('.table-container').classList.remove('hidden');
}

// -- Perfect Match Dashboard Logic --
let pmResultsData = [];
let pmItemLogData = [];

async function initPerfectMatchDashboard() {
    const loader = document.getElementById('loader');
    const scoresBody = document.getElementById('pm-scores-body');
    const errorsBody = document.getElementById('pm-errors-body');
    
    if (!scoresBody || !errorsBody) return;

    // We fetch two sheets for Perfect Match
    const [resultsTable, itemLogTable] = await Promise.all([
        fetchSheetData('D3-Results -Activity 3 - Perfect Match', PERFECT_MATCH_SHEET_ID),
        fetchSheetData('D3-ItemLog -Activity 3 - Perfect Match', PERFECT_MATCH_SHEET_ID)
    ]);

    if (!resultsTable || !itemLogTable) {
        scoresBody.innerHTML = '<tr><td colspan="3">Error loading data</td></tr>';
        errorsBody.innerHTML = '<tr><td colspan="5">Error loading data</td></tr>';
        loader.classList.add('hidden');
        return;
    }

    // Parse Data
    pmResultsData = resultsTable.rows.map(row => ({
        teamNum: row.c[1] ? row.c[1].v : null,
        caseId: row.c[2] ? row.c[2].v : null,
        score: row.c[4] ? row.c[4].v : (row.c[3] ? row.c[3].v : 0)
    })).filter(r => r.teamNum && r.teamNum.toString().toLowerCase().includes('team'));

    pmItemLogData = itemLogTable.rows.map(row => {
        const isCorrect = row.c[7] ? row.c[7].v : true;
        return {
            teamNum: row.c[1] ? row.c[1].v : null,
            caseId: row.c[2] ? row.c[2].v : 'Unknown',
            accessibilityName: row.c[3] ? row.c[3].v : null,
            productName: row.c[4] ? row.c[4].v : 'Unknown',
            placedZone: row.c[5] ? row.c[5].v : 'Unknown',
            correctZone: row.c[6] ? row.c[6].v : 'Unknown',
            isWrong: (isCorrect === false || isCorrect === 'FALSE' || isCorrect === 'false')
        };
    }).filter(r => r.teamNum && r.teamNum.toString().toLowerCase().includes('team') && r.isWrong);

    // Trim trailing spaces to avoid confusing UI like "Yellow " vs "Yellow"
    pmItemLogData.forEach(r => {
        if (typeof r.placedZone === 'string') r.placedZone = r.placedZone.trim();
        if (typeof r.correctZone === 'string') r.correctZone = r.correctZone.trim();
    });

    // Populate Filters
    populateFilters();

    // Render UI initially
    renderPerfectMatchUI();

    // Setup event listeners for filters
    document.getElementById('pm-team-filter').addEventListener('change', renderPerfectMatchUI);

    loader.classList.add('hidden');
    document.getElementById('pm-filters').classList.remove('hidden');
    document.getElementById('pm-dashboard-grid').classList.remove('hidden');
    document.getElementById('pm-errors-grid').classList.remove('hidden');
    
    // Unhide the table container specifically since loadData hides all .table-container elements
    const errorTableContainer = document.querySelector('#pm-errors-grid .table-container');
    if (errorTableContainer) errorTableContainer.classList.remove('hidden');
}

function populateFilters() {
    const teamFilter = document.getElementById('pm-team-filter');
    const uniqueTeams = [...new Set(pmResultsData.map(r => r.teamNum))].sort();

    // Reset keeping "All"
    teamFilter.innerHTML = '<option value="all">All Teams</option>';
    uniqueTeams.forEach(t => teamFilter.innerHTML += `<option value="${t}">${t}</option>`);
}

function renderPerfectMatchUI() {
    const selectedTeam = document.getElementById('pm-team-filter').value;

    // Filter Data
    const filteredResults = pmResultsData.filter(r => 
        (selectedTeam === 'all' || r.teamNum === selectedTeam)
    );

    const filteredErrors = pmItemLogData.filter(r => 
        (selectedTeam === 'all' || r.teamNum === selectedTeam)
    );

    // Update Tables
    const scoresBody = document.getElementById('pm-scores-body');
    const errorsBody = document.getElementById('pm-errors-body');
    scoresBody.innerHTML = '';
    errorsBody.innerHTML = '';

    if (filteredResults.length === 0) {
        scoresBody.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 10px;">No scores found</div>';
    } else {
        filteredResults.forEach(r => {
            scoresBody.innerHTML += `
                <div class="podium-small-item">
                    <strong style="text-transform: uppercase;">${r.teamNum}</strong>
                    <span>Score: <strong>${r.score}</strong> | Case: ${r.caseId}</span>
                </div>
            `;
        });
    }

    if (filteredErrors.length === 0) {
        errorsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No incorrect placements found! 🎉</td></tr>';
    } else {
        filteredErrors.forEach(r => {
            const escapedName = r.productName.replace(/'/g, "\\'");
            errorsBody.innerHTML += `
                <tr>
                    <td>${r.teamNum}</td>
                    <td>${r.caseId}</td>
                    <td><a href="#" style="color:var(--text-main); text-decoration:underline;" onclick="openProductModal('${r.accessibilityName}', '${escapedName}'); return false;">${r.productName}</a></td>
                    <td style="color: #ff6b6b; font-weight: bold; text-transform: capitalize;">${r.placedZone}</td>
                    <td style="color: #51cf66; font-weight: bold; text-transform: capitalize;">${r.correctZone}</td>
                </tr>`;
        });
    }
}

// Modal Functions
function openProductModal(accessibilityName, productName) {
    if (!accessibilityName) return;
    document.getElementById('modal-product-name').textContent = productName;
    document.getElementById('modal-product-img').src = `activity3-img/${accessibilityName}.png`;
    document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    
    function loadData() {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.remove('hidden');
        
        const podiumContainer = document.getElementById('podium-container');
        if (podiumContainer) podiumContainer.innerHTML = '';
        
        const tableBody = document.getElementById('data-table-body');
        if (tableBody) tableBody.innerHTML = '';
        
        const podiumSmall = document.getElementById('podium-small-content');
        if (podiumSmall) podiumSmall.innerHTML = '';

        const dashGrid = document.querySelector('.dashboard-grid');
        if (dashGrid) dashGrid.classList.add('hidden');
        
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) tableContainer.classList.add('hidden');

        const pmScoresBody = document.getElementById('pm-scores-body');
        if (pmScoresBody) {
            pmScoresBody.innerHTML = '';
            document.getElementById('pm-errors-body').innerHTML = '';
            document.getElementById('pm-dashboard-grid').classList.add('hidden');
            document.getElementById('pm-errors-grid').classList.add('hidden');
        }

        if (document.getElementById('podium-container')) {
            initLeaderboard();
        } else if (pmScoresBody) {
            initPerfectMatchDashboard();
        } else if (document.getElementById('data-table-body')) {
            initDashboard('Derma Map Activity');
        }
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadData);
    }

    // Initial load
    loadData();
});
