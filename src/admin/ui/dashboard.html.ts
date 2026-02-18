// Main dashboard HTML template

import { loginComponent } from './components/login';
import { sidebarComponent } from './components/sidebar';
import { dashboardView, usersView, roomsView, federationView, mediaView, reportsView, securityView, settingsView } from './views';
import { createApiClient } from './api-client';

export const adminDashboardHtml = (serverName: string, isAuthenticated: boolean = false): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Matrix-Worker Admin - ${serverName}</title>
  <style>
    ${styles}
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

  ${modals()}
  
  <script>
    ${createApiClient()}
    ${viewState()}
    ${eventHandlers()}
    ${initialization()}
  </script>
</body>
</html>
`;

// Styles (condensed from original)
const styles = `
  :root {
    --bg-base: #0a0a0b;
    --bg-elevated: #111113;
    --bg-surface: #18181b;
    --bg-hover: #27272a;
    --bg-active: #3f3f46;
    --border-default: rgba(255, 255, 255, 0.1);
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --accent-blue: #3b82f6;
    --accent-green: #22c55e;
    --accent-red: #ef4444;
    --accent-amber: #f59e0b;
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg-base); color: var(--text-primary); min-height: 100vh; }
  .app-container { display: none; }
  .app-container.visible { display: block; }
  .sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 260px; background: var(--bg-surface); border-right: 1px solid var(--border-default); padding: 24px 0; }
  .main-content { margin-left: 260px; padding: 30px; }
  .view { display: none; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
  .btn { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; }
  .btn-primary { background: var(--accent-blue); color: white; }
  .btn-secondary { background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border-default); }
  .btn-danger { background: var(--accent-red); color: white; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
  .stat-card { background: var(--bg-surface); border-radius: 16px; padding: 24px; border: 1px solid var(--border-default); }
  .card { background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--border-default); margin-bottom: 24px; }
  .card-header { padding: 20px; border-bottom: 1px solid var(--border-default); }
  .card-body { padding: 20px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 12px 8px; color: var(--text-secondary); font-size: 12px; }
  td { padding: 12px 8px; border-bottom: 1px solid var(--border-default); }
  .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); align-items: center; justify-content: center; z-index: 1000; }
  .modal.visible { display: flex; }
  .modal-content { background: var(--bg-surface); border-radius: 16px; padding: 32px; max-width: 500px; width: 90%; }
  .form-group { margin-bottom: 20px; }
  .form-group label { display: block; margin-bottom: 8px; color: var(--text-secondary); }
  .form-group input, .form-group select { width: 100%; padding: 12px; background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: 8px; color: var(--text-primary); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge.admin { background: #8b5cf6; color: white; }
  .badge.online { background: var(--accent-green); color: white; }
  .badge.offline { background: var(--bg-active); color: var(--text-tertiary); }
  .badge.unresolved { background: var(--accent-red); color: white; }
  .loading { text-align: center; padding: 40px; color: var(--text-secondary); }
  .spinner { border: 3px solid var(--bg-hover); border-top-color: var(--accent-blue); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// Modal templates
const modals = (): string => `
  <div id="createUserModal" class="modal">
    <div class="modal-content">
      <h2>Create User</h2>
      <div id="createUserError" class="error-message" style="display: none;"></div>
      <div class="form-group"><label>Username</label><input type="text" id="newUsername"></div>
      <div class="form-group"><label>Password</label><input type="password" id="newPassword"></div>
      <div class="form-group"><label>Display Name</label><input type="text" id="newDisplayName"></div>
      <div class="form-group checkbox"><input type="checkbox" id="newIsAdmin"><label>Make admin</label></div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('createUserModal')">Cancel</button>
        <button class="btn btn-primary" onclick="createUser()">Create</button>
      </div>
    </div>
  </div>
  
  <div id="createRoomModal" class="modal">
    <div class="modal-content">
      <h2>Create Room</h2>
      <div id="createRoomError" class="error-message" style="display: none;"></div>
      <div class="form-group"><label>Room Name</label><input type="text" id="newRoomName"></div>
      <div class="form-group"><label>Room Alias</label><input type="text" id="newRoomAlias"></div>
      <div class="form-group"><label>Type</label>
        <select id="newRoomPreset">
          <option value="private_chat">Private Chat</option>
          <option value="public_chat">Public Chat</option>
          <option value="trusted_private_chat">Trusted Private Chat</option>
        </select>
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('createRoomModal')">Cancel</button>
        <button class="btn btn-primary" onclick="createRoom()">Create</button>
      </div>
    </div>
  </div>
`;

// JavaScript sections
const viewState = (): string => `
  let currentPage = { users: 0, rooms: 0, media: 0 };
  let searchTimeout;
  let currentUsers = [];
  let currentRooms = [];
`;

const initialization = (): string => `
  (async () => {
    const status = await api.checkAuth();
    if (status.authenticated) {
      document.getElementById('loginContainer').style.display = 'none';
      document.getElementById('appContainer').classList.add('visible');
      switchView('dashboard');
    }
  })();
`;

// Note: The full event handlers would be split into separate files
// This is a condensed version showing the structure
const eventHandlers = (): string => `
  // Login/Logout
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => { ... });
  document.getElementById('logoutBtn')?.addEventListener('click', async () => { ... });
  
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) {
      switch(e.key) {
        case 'd': e.preventDefault(); switchView('dashboard'); break;
        case 'u': e.preventDefault(); switchView('users'); break;
        case 'r': e.preventDefault(); switchView('rooms'); break;
        case 'f': e.preventDefault(); switchView('federation'); break;
        case 'm': e.preventDefault(); switchView('media'); break;
      }
    }
  });
`;