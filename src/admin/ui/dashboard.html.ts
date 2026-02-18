// src/admin/ui/dashboard.html.ts
// Main dashboard HTML template that integrates all views

import { loginComponent } from './components/login';
import { sidebarComponent } from './components/sidebar';
import { allModals } from './components/modals';
import { 
  dashboardView,
  dashboardStyles,
  dashboardFunctions 
} from './views/dashboard';
import { 
  usersView,
  usersStyles,
  usersFunctions 
} from './views/users';
import { 
  roomsView,
  roomsStyles,
  roomsFunctions 
} from './views/rooms';
import { 
  federationView,
  federationStyles,
  federationFunctions 
} from './views/federation';
import { 
  mediaView,
  mediaStyles,
  mediaFunctions 
} from './views/media';
import { 
  reportsView,
  reportsStyles,
  reportsFunctions 
} from './views/reports';
import { 
  securityView,
  securityStyles,
  securityFunctions 
} from './views/security';
import { 
  settingsView,
  settingsStyles,
  settingsFunctions 
} from './views/settings';

// Define the main export function
export const adminDashboardHtml = (serverName: string, isAuthenticated: boolean = false): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Matrix-Worker Admin - ${serverName}</title>
  <!-- Chart.js for dashboard visualizations -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    /* ============================================
       Base Styles
       ============================================ */
    :root {
      --bg-base: #0a0a0b;
      --bg-elevated: #111113;
      --bg-surface: #18181b;
      --bg-hover: #27272a;
      --bg-active: #3f3f46;
      --border-subtle: rgba(255, 255, 255, 0.06);
      --border-default: rgba(255, 255, 255, 0.1);
      --border-strong: rgba(255, 255, 255, 0.15);
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-tertiary: #71717a;
      --accent-blue: #3b82f6;
      --accent-purple: #8b5cf6;
      --accent-green: #22c55e;
      --accent-amber: #f59e0b;
      --accent-red: #ef4444;
      --accent-cyan: #06b6d4;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
      --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
      --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);
      --transition-fast: 150ms ease;
      --transition-normal: 200ms ease;
      --glass-bg: rgba(24, 24, 27, 0.8);
      --glass-blur-heavy: 20px;
      --gradient-primary: linear-gradient(135deg, var(--accent-blue) 0%, #2563eb 100%);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-base);
      color: var(--text-primary);
      min-height: 100vh;
      background-image:
        radial-gradient(ellipse at 20% 20%, rgba(59, 130, 246, 0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.04) 0%, transparent 50%);
      background-attachment: fixed;
    }

    .app-container {
      display: none;
    }

    .app-container.visible {
      display: block;
    }

    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 260px;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur-heavy));
      -webkit-backdrop-filter: blur(var(--glass-blur-heavy));
      border-right: 1px solid var(--border-default);
      padding: 24px 0;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
    }

    .sidebar-header {
      padding: 0 20px 20px;
      border-bottom: 1px solid var(--border-default);
    }

    .sidebar-header h1 {
      font-size: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sidebar-header .server-name {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 5px;
    }

    .nav-menu {
      padding: 20px 0;
      flex: 1;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 24px;
      color: var(--text-secondary);
      text-decoration: none;
      cursor: pointer;
      transition: all var(--transition-fast);
      border-left: 3px solid transparent;
      margin: 2px 0;
    }

    .nav-item:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .nav-item.active {
      background: rgba(59, 130, 246, 0.1);
      color: var(--text-primary);
      border-left-color: var(--accent-blue);
    }

    .nav-item svg {
      width: 20px;
      height: 20px;
      opacity: 0.7;
      transition: opacity var(--transition-fast);
      flex-shrink: 0;
      stroke: currentColor;
    }

    .nav-item .nav-shortcut {
      margin-left: auto;
      font-size: 10px;
      color: var(--text-tertiary);
      background: var(--bg-elevated);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    .nav-item .badge {
      margin-left: auto;
      background: var(--accent-red);
      color: white;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
    }

    .main-content {
      margin-left: 260px;
      padding: 30px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      flex-wrap: wrap;
      gap: 15px;
    }

    .header h2 {
      font-size: 24px;
    }

    .header-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 10px 20px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all var(--transition-fast);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      position: relative;
      overflow: hidden;
    }

    .btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 50%);
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .btn:hover::before {
      opacity: 1;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-primary {
      background: var(--gradient-primary);
      color: white;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .btn-primary:hover {
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
      transform: translateY(-1px);
    }

    .btn-success {
      background: linear-gradient(135deg, var(--accent-green) 0%, #16a34a 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
    }

    .btn-success:hover {
      box-shadow: 0 4px 16px rgba(34, 197, 94, 0.4);
      transform: translateY(-1px);
    }

    .btn-warning {
      background: linear-gradient(135deg, var(--accent-amber) 0%, #d97706 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    }

    .btn-warning:hover {
      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }

    .btn-danger {
      background: linear-gradient(135deg, var(--accent-red) 0%, #dc2626 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
    }

    .btn-danger:hover {
      box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: var(--bg-hover);
      color: var(--text-primary);
      border: 1px solid var(--border-default);
    }

    .btn-secondary:hover {
      background: var(--bg-active);
      border-color: var(--border-strong);
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn-icon-sm {
      padding: 4px 8px;
      background: var(--bg-hover);
      border: 1px solid var(--border-default);
      border-radius: 4px;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 12px;
    }

    .btn-icon-sm:hover {
      background: var(--bg-active);
      color: var(--text-primary);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: var(--bg-surface);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid var(--border-default);
      box-shadow: var(--shadow-sm);
      transition: all var(--transition-normal);
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .stat-card .label {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 8px;
    }

    .stat-card .value {
      font-size: 32px;
      font-weight: 600;
    }

    .card {
      background: var(--bg-surface);
      border-radius: 16px;
      border: 1px solid var(--border-default);
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--transition-normal);
    }

    .card:hover {
      box-shadow: var(--shadow-md);
    }

    .card-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-default);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .card-header h3 {
      font-size: 18px;
    }

    .card-body {
      padding: 20px;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      text-align: left;
      padding: 12px 8px;
      color: var(--text-secondary);
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 12px 8px;
      border-bottom: 1px solid var(--border-default);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: var(--bg-hover);
    }

    .sortable {
      cursor: pointer;
      user-select: none;
    }

    .sortable:hover {
      background: var(--bg-hover);
    }

    .sort-indicator {
      display: inline-block;
      width: 16px;
      text-align: center;
    }

    .pagination {
      display: flex;
      justify-content: center;
      gap: 4px;
      margin-top: 20px;
    }

    .pagination button {
      padding: 6px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 4px;
      color: var(--text-secondary);
      cursor: pointer;
    }

    .pagination button:hover {
      background: var(--bg-hover);
    }

    .pagination button.active {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }

    .spinner {
      border: 3px solid var(--bg-hover);
      border-top-color: var(--accent-blue);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .filter-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .filter-select {
      padding: 6px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 13px;
      min-width: 120px;
    }

    .filter-select:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .search-input {
      padding: 6px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 13px;
      min-width: 200px;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal.visible {
      display: flex;
    }

    .modal-content {
      background: var(--bg-surface);
      border-radius: 16px;
      max-width: 500px;
      width: 90%;
      border: 1px solid var(--border-default);
      box-shadow: var(--shadow-lg);
    }

    .modal-lg {
      max-width: 900px;
      width: 90%;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid var(--border-default);
    }

    .modal-header h2 {
      font-size: 20px;
    }

    .modal-body {
      padding: 20px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 20px;
      border-top: 1px solid var(--border-default);
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
    }

    .modal-close:hover {
      color: var(--text-primary);
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: var(--text-secondary);
      font-size: 14px;
    }

    .form-group.checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .form-group.checkbox input {
      width: auto;
    }

    .form-control {
      width: 100%;
      padding: 10px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
    }

    .form-control:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .form-control[readonly] {
      background: var(--bg-base);
      color: var(--text-secondary);
    }

    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: var(--accent-red);
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    .role-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }

    .role-admin {
      background: rgba(139, 92, 246, 0.2);
      color: #a78bfa;
    }

    .role-user {
      background: rgba(59, 130, 246, 0.2);
      color: var(--accent-blue);
    }

    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }

    .status-active {
      background: rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
    }

    .status-deactivated {
      background: rgba(239, 68, 68, 0.2);
      color: var(--accent-red);
    }

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
      height: 300px;
      width: 100%;
    }

    .action-group {
      display: flex;
      gap: 4px;
    }

    /* Import all view styles */
    ${getDashboardStyles()}
    ${getUsersStyles()}
    ${getRoomsStyles()}
    ${getFederationStyles()}
    ${getMediaStyles()}
    ${getReportsStyles()}
    ${getSecurityStyles()}
    ${getSettingsStyles()}
    ${getNotificationStyles()}
  </style>
</head>
<body>
  ${loginComponent(isAuthenticated)}
  
  <div id="appContainer" class="app-container ${isAuthenticated ? 'visible' : ''}">
    ${sidebarComponent(serverName)}
    
    <div class="main-content">
      ${dashboardView()}
      ${usersView()}
      ${roomsView()}
      ${federationView()}
      ${mediaView()}
      ${reportsView()}
      ${securityView()}
      ${settingsView()}
    </div>
  </div>

  ${allModals()}
  
  <script>
    // ============================================
    // API Client
    // ============================================
    ${getApiClient()}

    // ============================================
    // View State Management
    // ============================================
    ${getViewState()}

    // ============================================
    // View Switching
    // ============================================
    ${getViewSwitcher()}

    // ============================================
    // View-specific Functions
    // ============================================
    ${getUserFunctions()}
    ${getRoomFunctions()}
    ${getMediaFunctions()}
    ${getReportFunctions()}
    ${getFederationFunctions()}
    ${getSecurityFunctions()}
    ${getSettingsFunctions()}
    ${getDashboardFunctions()}

    // ============================================
    // Notification Helper
    // ============================================
    ${getNotificationHelper()}

    // ============================================
    // Initialization
    // ============================================
    ${getInitialization()}
  </script>
</body>
</html>
  `;
};

// Helper functions to get styles (to avoid template literal issues)
function getDashboardStyles() { return dashboardStyles; }
function getUsersStyles() { return usersStyles; }
function getRoomsStyles() { return roomsStyles; }
function getFederationStyles() { return federationStyles; }
function getMediaStyles() { return mediaStyles; }
function getReportsStyles() { return reportsStyles; }
function getSecurityStyles() { return securityStyles; }
function getSettingsStyles() { return settingsStyles; }
function getNotificationStyles() { return notificationStyles; }

function getApiClient() { return createApiClient; }
function getViewState() { return viewState; }
function getViewSwitcher() { return viewSwitcher; }
function getUserFunctions() { return userFunctions; }
function getRoomFunctions() { return roomFunctions; }
function getMediaFunctions() { return mediaFunctions; }
function getReportFunctions() { return reportFunctions; }
function getFederationFunctions() { return federationFunctions; }
function getSecurityFunctions() { return securityFunctions; }
function getSettingsFunctions() { return settingsFunctions; }
function getDashboardFunctions() { return dashboardFunctions; }
function getNotificationHelper() { return notificationHelper; }
function getInitialization() { return initialization; }

// Define all the helper functions that were previously inline
const createApiClient = `
  const api = {
    async login(password) {
      const response = await fetch('/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      return response.json();
    },

    async logout() {
      await fetch('/admin/api/logout', { method: 'POST' });
    },

    async checkAuth() {
      const response = await fetch('/admin/api/status');
      return response.json();
    },

    async get(endpoint) {
      const response = await fetch('/admin/api' + endpoint, {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
      });
      if (!response.ok) throw new Error('API error: ' + response.status);
      return response.json();
    },

    async post(endpoint, data) {
      const response = await fetch('/admin/api' + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('API error: ' + response.status);
      return response.json();
    },

    async put(endpoint, data) {
      const response = await fetch('/admin/api' + endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('API error: ' + response.status);
      return response.json();
    },

    async delete(endpoint) {
      const response = await fetch('/admin/api' + endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
      });
      if (!response.ok) throw new Error('API error: ' + response.status);
      return response.json();
    },

    setToken(token) {
      localStorage.setItem('adminToken', token);
    },

    getToken() {
      return localStorage.getItem('adminToken');
    },

    clearToken() {
      localStorage.removeItem('adminToken');
    }
  };
`;

const viewState = `
  let currentPage = { users: 0, rooms: 0, media: 0 };
  let searchTimeout;
  let currentUsers = [];
  let currentRooms = [];
  let currentMedia = [];
  let currentReports = [];

  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 5000);
    }
  }

  function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('visible');
  }

  function showModal(modalId) {
    document.getElementById(modalId).classList.add('visible');
  }

  function confirmAction(title, message, callback) {
    const modal = document.getElementById('confirmModal');
    if (modal) {
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      document.getElementById('confirmAction').onclick = async () => {
        hideModal('confirmModal');
        await callback();
      };
      showModal('confirmModal');
    } else {
      if (confirm(message)) callback();
    }
  }
`;

const viewSwitcher = `
  function switchView(viewName) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    
    const navItem = document.querySelector(\`[data-view="\${viewName}"]\`);
    if (navItem) navItem.classList.add('active');
    
    document.getElementById(viewName + 'View').style.display = 'block';
    
    // Load data for the view
    switch(viewName) {
      case 'dashboard': loadDashboard(); break;
      case 'users': loadUsers(); break;
      case 'rooms': loadRooms(); break;
      case 'federation': loadFederation(); break;
      case 'media': loadMedia(); break;
      case 'reports': loadReports(); break;
      case 'security': loadSecurityData(); break;
      case 'settings': loadSettings(); break;
    }
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) {
      switch(e.key) {
        case 'd': e.preventDefault(); switchView('dashboard'); break;
        case 'u': e.preventDefault(); switchView('users'); break;
        case 'r': e.preventDefault(); switchView('rooms'); break;
        case 'f': e.preventDefault(); switchView('federation'); break;
        case 'm': e.preventDefault(); switchView('media'); break;
        case 'p': e.preventDefault(); switchView('reports'); break;
        case 's': e.preventDefault(); switchView('security'); break;
        case ',': e.preventDefault(); switchView('settings'); break;
      }
    }
  });
`;

const notificationHelper = `
  let notificationTimeout;
  
  function showNotification(message, type = 'info') {
    const existing = document.getElementById('notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = \`notification \${type}\`;
    notification.innerHTML = \`
      <span class="notification-message">\${message}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
    \`;
    
    document.body.appendChild(notification);
    
    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
`;

const initialization = `
  (async () => {
    const status = await api.checkAuth();
    if (status.authenticated) {
      document.getElementById('loginContainer').style.display = 'none';
      document.getElementById('appContainer').classList.add('visible');
      switchView('dashboard');
    }
  })();
`;

// Notification styles
const notificationStyles = `
  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 2000;
    animation: slideIn 0.3s ease;
    max-width: 400px;
  }
  
  .notification.success {
    border-left: 4px solid var(--accent-green);
  }
  
  .notification.error {
    border-left: 4px solid var(--accent-red);
  }
  
  .notification.info {
    border-left: 4px solid var(--accent-blue);
  }
  
  .notification-message {
    flex: 1;
    font-size: 14px;
  }
  
  .notification-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 16px;
    padding: 0 4px;
  }
  
  .notification-close:hover {
    color: var(--text-primary);
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;