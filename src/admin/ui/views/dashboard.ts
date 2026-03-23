// src/admin/ui/views/dashboard.ts
// Dashboard view with stats cards and quick actions

export const dashboardView = (): string => `
  <div id="dashboardView" class="view" style="display: none;">
    <div class="header">
      <h2>Dashboard</h2>
      <div class="header-actions">
        <button class="btn btn-primary" id="refreshDashboard" onclick="loadDashboard()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <div class="stats-grid" id="dashboardStats">
      <div class="stat-card">
        <div class="label">Total Users</div>
        <div class="value" id="totalUsers">-</div>
      </div>
      <div class="stat-card">
        <div class="label">Active Users (24h)</div>
        <div class="value" id="activeUsers">-</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Rooms</div>
        <div class="value" id="totalRooms">-</div>
      </div>
      <div class="stat-card">
        <div class="label">Federation Status</div>
        <div class="value" id="federationStatus">-</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Media Files</div>
        <div class="value" id="totalMedia">-</div>
      </div>
      <div class="stat-card">
        <div class="label">Unresolved Reports</div>
        <div class="value" id="unresolvedReports">-</div>
      </div>
      <div class="stat-card">
        <div class="label">Active Sessions</div>
        <div class="value" id="activeSessions">-</div>
      </div>
      <div class="stat-card">
        <div class="label">Server Uptime</div>
        <div class="value" id="serverUptime">-</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header">
          <h3>Registration Activity (7 days)</h3>
        </div>
        <div class="card-body">
          <div class="chart-container" id="registrationsChart">
            <canvas id="registrationsChartCanvas"></canvas>
          </div>
          <div id="registrationsLoading" class="loading">Loading chart data...</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Message Activity (7 days)</h3>
        </div>
        <div class="card-body">
          <div class="chart-container" id="messagesChart">
            <canvas id="messagesChartCanvas"></canvas>
          </div>
          <div id="messagesLoading" class="loading">Loading chart data...</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Quick Actions</h3>
      </div>
      <div class="card-body">
        <div class="quick-actions">
          <button class="quick-action" onclick="switchView('users'); showCreateUserModal()">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            <span>Create User</span>
          </button>
          <button class="quick-action" onclick="switchView('rooms'); showCreateRoomModal()">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <circle cx="12" cy="12" r="2"></circle>
            </svg>
            <span>Create Room</span>
          </button>
          <button class="quick-action" onclick="switchView('federation'); testFederation()">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="2"></circle>
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
            </svg>
            <span>Test Federation</span>
          </button>
          <button class="quick-action" onclick="switchView('reports')">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>View Reports</span>
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Recent Activity</h3>
        <div class="activity-filters">
          <select id="activityFilter" onchange="loadRecentActivity()">
            <option value="all">All Activity</option>
            <option value="users">Users</option>
            <option value="rooms">Rooms</option>
            <option value="messages">Messages</option>
          </select>
        </div>
      </div>
      <div class="card-body">
        <div id="recentActivityLoading" class="loading">
          <div class="spinner"></div>
          Loading activity...
        </div>
        <div id="recentActivityList" style="display: none;">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>User</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody id="activityTableBody"></tbody>
          </table>
        </div>
        <div id="noActivity" class="loading" style="display: none;">No recent activity</div>
      </div>
    </div>
  </div>
`;

// Dashboard-specific styles
export const dashboardStyles = `
  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
  
  @media (max-width: 1200px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
  
  .chart-container {
    position: relative;
    height: 250px;
    width: 100%;
  }
  
  .quick-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-top: 20px;
  }
  
  .quick-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-decoration: none;
    color: var(--text-primary);
  }
  
  .quick-action:hover {
    background: var(--bg-hover);
    border-color: var(--border-default);
    transform: translateY(-2px);
  }
  
  .quick-action svg {
    width: 24px;
    height: 24px;
    color: var(--accent-blue);
  }
  
  .activity-filters {
    display: flex;
    gap: 8px;
  }
  
  .activity-filters select {
    padding: 6px 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
  }
  
  .activity-filters select:focus {
    outline: none;
    border-color: var(--accent-blue);
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .stat-card.loading .value {
    animation: pulse 1.5s ease-in-out infinite;
    background: var(--bg-hover);
    border-radius: 4px;
    color: transparent;
  }
`;

// Dashboard JavaScript functions
export const dashboardFunctions = (): string => `
  // ============================================
  // Dashboard Functions
  // ============================================
  
  let activityChart;
  let registrationsChart;
  let messagesChart;
  
  async function loadDashboard() {
    // Show loading states
    document.querySelectorAll('.stat-card .value').forEach(el => {
      el.parentElement?.classList.add('loading');
    });
    
    try {
      // Load main stats
      const stats = await api.get('/stats');
      
      document.getElementById('totalUsers').textContent = stats.totalUsers || '0';
      document.getElementById('activeUsers').textContent = stats.activeUsers || '0';
      document.getElementById('totalRooms').textContent = stats.totalRooms || '0';
      document.getElementById('federationStatus').innerHTML = stats.federationOk ? '✅ OK' : '❌ Failed';
      
      // Load additional stats
      await loadAdditionalStats();
      
      // Load chart data
      await loadChartData();
      
      // Load recent activity
      await loadRecentActivity();
      
      // Remove loading states
      document.querySelectorAll('.stat-card').forEach(el => {
        el.classList.remove('loading');
      });
      
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      showNotification('Failed to load dashboard data', 'error');
      
      document.querySelectorAll('.stat-card').forEach(el => {
        el.classList.remove('loading');
      });
    }
  }
  
  async function loadAdditionalStats() {
    try {
      // Get media stats
      const mediaStats = await api.get('/media/stats');
      document.getElementById('totalMedia').textContent = mediaStats.total_files || '0';
      
      // Get unresolved reports count
      const reports = await api.get('/reports?resolved=false&limit=1');
      document.getElementById('unresolvedReports').textContent = reports.total || '0';
      
      // Get active sessions count
      const sessions = await api.get('/security/sessions?limit=1');
      document.getElementById('activeSessions').textContent = sessions.total || '0';
      
      // Calculate uptime (simplified - you might want to track this in your backend)
      const startTime = localStorage.getItem('serverStartTime');
      if (startTime) {
        const uptime = Date.now() - parseInt(startTime);
        document.getElementById('serverUptime').textContent = formatUptime(uptime);
      } else {
        localStorage.setItem('serverStartTime', Date.now().toString());
        document.getElementById('serverUptime').textContent = 'Just started';
      }
      
    } catch (err) {
      console.error('Failed to load additional stats:', err);
    }
  }
  
  function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return \`\${days}d \${hours % 24}h\`;
    if (hours > 0) return \`\${hours}h \${minutes % 60}m\`;
    if (minutes > 0) return \`\${minutes}m \${seconds % 60}s\`;
    return \`\${seconds}s\`;
  }
  
  async function loadChartData() {
    document.getElementById('registrationsLoading').style.display = 'block';
    document.getElementById('messagesLoading').style.display = 'block';
    
    try {
      // Load registrations history
      const regData = await api.get('/stats/history?period=7d');
      
      // Load messages history
      const msgData = await api.get('/stats/history?period=7d');
      
      // Initialize charts
      initRegistrationsChart(regData);
      initMessagesChart(msgData);
      
    } catch (err) {
      console.error('Failed to load chart data:', err);
    } finally {
      document.getElementById('registrationsLoading').style.display = 'none';
      document.getElementById('messagesLoading').style.display = 'none';
    }
  }
  
  function initRegistrationsChart(data) {
    const ctx = document.getElementById('registrationsChartCanvas')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (registrationsChart) {
      registrationsChart.destroy();
    }
    
    registrationsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.data.map((d) => d.date),
        datasets: [{
          label: 'Registrations',
          data: data.data.map((d) => d.registrations),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#94a3b8'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#94a3b8'
            }
          }
        }
      }
    });
  }
  
  function initMessagesChart(data) {
    const ctx = document.getElementById('messagesChartCanvas')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (messagesChart) {
      messagesChart.destroy();
    }
    
    messagesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.data.map((d) => d.date),
        datasets: [{
          label: 'Messages',
          data: data.data.map((d) => d.events),
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#94a3b8'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#94a3b8'
            }
          }
        }
      }
    });
  }
  
  async function loadRecentActivity() {
    const filter = document.getElementById('activityFilter')?.value || 'all';
    
    document.getElementById('recentActivityLoading').style.display = 'block';
    document.getElementById('recentActivityList').style.display = 'none';
    document.getElementById('noActivity').style.display = 'none';
    
    try {
      // Fetch recent activity based on filter
      let activities = [];
      
      switch(filter) {
        case 'users':
          const users = await api.get('/users?limit=10');
          activities = users.items.map((u) => ({
            time: u.created_at,
            type: 'user',
            user: u.user_id,
            description: \`User \${u.display_name || u.user_id} registered\`
          }));
          break;
          
        case 'rooms':
          const rooms = await api.get('/rooms?limit=10');
          activities = rooms.items.map((r) => ({
            time: r.created_at,
            type: 'room',
            user: r.creator_id || 'unknown',
            description: \`Room \${r.name || r.room_id} created\`
          }));
          break;
          
        case 'messages':
          // You might need a separate endpoint for recent messages
          activities = [];
          break;
          
        default:
          // Mix of all activity
          const [recentUsers, recentRooms] = await Promise.all([
            api.get('/users?limit=5'),
            api.get('/rooms?limit=5')
          ]);
          
          activities = [
            ...recentUsers.items.map((u) => ({
              time: u.created_at,
              type: 'user',
              user: u.user_id,
              description: \`User \${u.display_name || u.user_id} registered\`
            })),
            ...recentRooms.items.map((r) => ({
              time: r.created_at,
              type: 'room',
              user: r.creator_id || 'unknown',
              description: \`Room \${r.name || r.room_id} created\`
            }))
          ].sort((a, b) => b.time - a.time).slice(0, 10);
      }
      
      if (activities.length === 0) {
        document.getElementById('recentActivityLoading').style.display = 'none';
        document.getElementById('noActivity').style.display = 'block';
        return;
      }
      
      const tbody = document.getElementById('activityTableBody');
      tbody.innerHTML = '';
      
      activities.forEach(activity => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td>\${new Date(activity.time).toLocaleString()}</td>
          <td><span class="badge \${activity.type}">\${activity.type}</span></td>
          <td>\${activity.user}</td>
          <td>\${activity.description}</td>
        \`;
        tbody.appendChild(tr);
      });
      
      document.getElementById('recentActivityLoading').style.display = 'none';
      document.getElementById('recentActivityList').style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load recent activity:', err);
      document.getElementById('recentActivityLoading').innerHTML = 'Failed to load activity';
    }
  }
  
  // Auto-refresh dashboard every 30 seconds
  let dashboardRefreshInterval;
  
  function startDashboardRefresh() {
    if (dashboardRefreshInterval) {
      clearInterval(dashboardRefreshInterval);
    }
    dashboardRefreshInterval = setInterval(() => {
      if (document.getElementById('dashboardView').style.display !== 'none') {
        loadDashboard();
      }
    }, 30000);
  }
  
  function stopDashboardRefresh() {
    if (dashboardRefreshInterval) {
      clearInterval(dashboardRefreshInterval);
    }
  }
  
  // Override the view switch to handle chart resizing
  const originalSwitchView = window.switchView;
  window.switchView = function(viewName) {
    originalSwitchView(viewName);
    
    if (viewName === 'dashboard') {
      // Resize charts when dashboard becomes visible
      setTimeout(() => {
        if (registrationsChart) registrationsChart.resize();
        if (messagesChart) messagesChart.resize();
      }, 100);
      
      startDashboardRefresh();
    } else {
      stopDashboardRefresh();
    }
  };
`;

// Note: This requires Chart.js library to be loaded
// Add this to your dashboard.html.ts head section:
// <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>