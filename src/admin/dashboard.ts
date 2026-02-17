// Admin Dashboard HTML with authentication

// Password verification function (would be imported from crypto)
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // This would use your existing crypto utilities
  // For now, placeholder - implement with your actual password hashing
  const { verifyPasswordHash } = await import('../utils/crypto');
  return verifyPasswordHash(password, hash);
}

// Admin authentication middleware
export async function requireAdminAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  
  // Check if it's the admin session token
  const adminToken = await c.env.CACHE.get('admin:session');
  if (adminToken !== token) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  await next();
}

// Admin login endpoint
export async function adminLogin(c: any) {
  try {
    const { password } = await c.req.json();
    
    if (!password) {
      return c.json({ error: 'Password required' }, 400);
    }

    // Get admin password from secret
    const adminPasswordHash = c.env.ADMIN_PASSWORD_HASH;
    if (!adminPasswordHash) {
      console.error('ADMIN_PASSWORD_HASH secret not set');
      return c.json({ error: 'Admin not configured' }, 500);
    }

    // Verify password
    const isValid = await verifyPassword(password, adminPasswordHash);
    if (!isValid) {
      return c.json({ error: 'Invalid password' }, 401);
    }

    // Generate session token
    const token = crypto.randomUUID();
    
    // Store session (expires in 24 hours)
    await c.env.CACHE.put('admin:session', token, { expirationTtl: 86400 });

    return c.json({ 
      success: true, 
      token,
      expires_in: 86400
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
}

// Admin logout endpoint
export async function adminLogout(c: any) {
  await c.env.CACHE.delete('admin:session');
  return c.json({ success: true });
}

// Check admin status
export async function adminStatus(c: any) {
  const adminToken = await c.env.CACHE.get('admin:session');
  return c.json({ 
    authenticated: !!adminToken,
    server_name: c.env.SERVER_NAME 
  });
}

// Admin dashboard HTML with authentication UI
export const adminDashboardHtml = (serverName: string, isAuthenticated: boolean = false) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Matrix-Worker Admin - ${serverName}</title>
  <style>
    :root {
      /* Base - Deep dark enterprise theme */
      --bg-base: #0a0a0b;
      --bg-elevated: #111113;
      --bg-surface: #18181b;
      --bg-hover: #27272a;
      --bg-active: #3f3f46;
      
      /* Borders */
      --border-subtle: rgba(255, 255, 255, 0.06);
      --border-default: rgba(255, 255, 255, 0.1);
      --border-strong: rgba(255, 255, 255, 0.15);
      
      /* Text */
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-tertiary: #71717a;
      
      /* Accents */
      --accent-blue: #3b82f6;
      --accent-purple: #8b5cf6;
      --accent-green: #22c55e;
      --accent-amber: #f59e0b;
      --accent-red: #ef4444;
      --accent-cyan: #06b6d4;
      
      /* Shadows */
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
      --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
      --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);
      
      /* Transitions */
      --transition-fast: 150ms ease;
      --transition-normal: 200ms ease;

      /* Glassmorphism */
      --glass-bg: rgba(24, 24, 27, 0.8);
      --glass-bg-light: rgba(24, 24, 27, 0.5);
      --glass-border: var(--border-default);
      --glass-blur: 12px;
      --glass-blur-heavy: 20px;

      /* Gradients */
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

    .login-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }

    .login-box {
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur-heavy));
      -webkit-backdrop-filter: blur(var(--glass-blur-heavy));
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      border: 1px solid var(--border-default);
      box-shadow: var(--shadow-lg);
      position: relative;
      overflow: hidden;
    }

    .login-box::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    }

    .login-box h1 {
      text-align: center;
      margin-bottom: 30px;
      font-size: 24px;
    }

    .login-box .logo {
      text-align: center;
      font-size: 48px;
      margin-bottom: 20px;
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

    .form-group input {
      width: 100%;
      padding: 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      transition: all var(--transition-fast);
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
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
      position: relative;
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

    .btn-primary {
      background: var(--gradient-primary);
      color: white;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .btn-primary:hover {
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
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
      position: relative;
      overflow: hidden;
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
    }

    .card-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-default);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-header h3 {
      font-size: 18px;
    }

    .card-body {
      padding: 20px;
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
  </style>
</head>
<body>
  <!-- Login Form -->
  <div id="loginContainer" class="login-container" style="display: ${isAuthenticated ? 'none' : 'flex'}">
    <div class="login-box">
      <div class="logo">🔐</div>
      <h1>Admin Login</h1>
      <div id="loginError" class="error-message" style="display: none;"></div>
      <form id="loginForm">
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autofocus>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Login</button>
      </form>
    </div>
  </div>

  <!-- Main App -->
  <div id="appContainer" class="app-container ${isAuthenticated ? 'visible' : ''}">
    <div class="sidebar">
      <div class="sidebar-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="4" ry="4"></rect>
            <line x1="8" y1="2" x2="8" y2="22"></line>
            <line x1="16" y1="2" x2="16" y2="22"></line>
          </svg>
          Matrix Admin
        </h1>
        <div class="server-name">${serverName}</div>
      </div>
      <div class="nav-menu">
        <div class="nav-item active" data-view="dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="9"></rect>
            <rect x="14" y="3" width="7" height="5"></rect>
            <rect x="14" y="12" width="7" height="9"></rect>
            <rect x="3" y="16" width="7" height="5"></rect>
          </svg>
          Dashboard
          <span class="nav-shortcut">⌘D</span>
        </div>
        <div class="nav-item" data-view="users">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Users
          <span class="nav-shortcut">⌘U</span>
        </div>
        <div class="nav-item" data-view="rooms">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
          Rooms
          <span class="nav-shortcut">⌘R</span>
        </div>
        <div class="nav-item" data-view="federation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="2"></circle>
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
            <path d="M2 12h20"></path>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          Federation
          <span class="nav-shortcut">⌘F</span>
        </div>
        <div class="nav-item" data-view="security">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Security
          <span class="nav-shortcut">⌘S</span>
        </div>
        <div class="nav-item" data-view="settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H5.78a1.65 1.65 0 0 0-1.51 1 1.65 1.65 0 0 0 .33 1.82L12 22z"></path>
            <path d="M4.6 9a1.65 1.65 0 0 0-.33 1.82c.23.53.8.9 1.51.9h12.44a1.65 1.65 0 0 0 1.51-.9 1.65 1.65 0 0 0-.33-1.82L12 2z"></path>
          </svg>
          Settings
          <span class="nav-shortcut">⌘,</span>
        </div>
      </div>
      <div style="padding: 20px;">
        <button id="logoutBtn" class="btn btn-secondary btn-sm" style="width: 100%;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Logout
        </button>
      </div>
    </div>

    <div class="main-content">
      <div id="dashboardView" class="view">
        <div class="header">
          <h2>Dashboard</h2>
          <div class="header-actions">
            <button class="btn btn-primary" id="refreshDashboard">
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

        <div class="card">
          <div class="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div class="card-body">
            <div class="quick-actions">
              <button class="btn btn-primary" onclick="location.href='/admin/users'">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                Create User
              </button>
              <button class="btn btn-primary" onclick="location.href='/admin/rooms'">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <circle cx="12" cy="12" r="2"></circle>
                </svg>
                Create Room
              </button>
              <button class="btn btn-primary" onclick="location.href='/admin/federation'">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="2"></circle>
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                </svg>
                Check Federation
              </button>
              <button class="btn btn-primary" onclick="location.href='/admin/media'">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                  <line x1="23" y1="1" x2="1" y2="23"></line>
                </svg>
                Media Quarantine
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div class="card-body" id="recentActivity">
            <div class="loading">Loading activity...</div>
          </div>
        </div>
      </div>

      <!-- Other views would be implemented similarly -->
      <div id="usersView" class="view" style="display: none;">Users view content</div>
      <div id="roomsView" class="view" style="display: none;">Rooms view content</div>
      <div id="federationView" class="view" style="display: none;">Federation view content</div>
      <div id="securityView" class="view" style="display: none;">Security view content</div>
      <div id="settingsView" class="view" style="display: none;">Settings view content</div>
    </div>
  </div>

  <script>
    // API client
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

      async getDashboardStats() {
        const response = await fetch('/admin/api/stats', {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
        });
        return response.json();
      },

      setToken(token) {
        localStorage.setItem('adminToken', token);
      },

      getToken() {
        return localStorage.getItem('adminToken');
      }
    };

    // Login form handling
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('loginError');
      
      try {
        const result = await api.login(password);
        if (result.success) {
          api.setToken(result.token);
          document.getElementById('loginContainer').style.display = 'none';
          document.getElementById('appContainer').classList.add('visible');
          loadDashboard();
        } else {
          errorEl.textContent = result.error || 'Login failed';
          errorEl.style.display = 'block';
        }
      } catch (err) {
        errorEl.textContent = 'Network error';
        errorEl.style.display = 'block';
      }
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await api.logout();
      localStorage.removeItem('adminToken');
      document.getElementById('loginContainer').style.display = 'flex';
      document.getElementById('appContainer').classList.remove('visible');
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const viewName = item.dataset.view;
        document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
        document.getElementById(viewName + 'View').style.display = 'block';
        
        if (viewName === 'dashboard') {
          loadDashboard();
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch(e.key) {
          case 'd': e.preventDefault(); document.querySelector('[data-view="dashboard"]').click(); break;
          case 'u': e.preventDefault(); document.querySelector('[data-view="users"]').click(); break;
          case 'r': e.preventDefault(); document.querySelector('[data-view="rooms"]').click(); break;
          case 'f': e.preventDefault(); document.querySelector('[data-view="federation"]').click(); break;
          case 's': e.preventDefault(); document.querySelector('[data-view="security"]').click(); break;
          case ',': e.preventDefault(); document.querySelector('[data-view="settings"]').click(); break;
        }
      }
    });

    // Load dashboard data
    async function loadDashboard() {
      const statsEl = document.getElementById('dashboardStats');
      try {
        const stats = await api.getDashboardStats();
        document.getElementById('totalUsers').textContent = stats.totalUsers || '0';
        document.getElementById('activeUsers').textContent = stats.activeUsers || '0';
        document.getElementById('totalRooms').textContent = stats.totalRooms || '0';
        document.getElementById('federationStatus').textContent = stats.federationOk ? '✅ OK' : '❌ Failed';
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }

    // Check auth on load
    (async () => {
      const status = await api.checkAuth();
      if (status.authenticated) {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').classList.add('visible');
        loadDashboard();
      }
    })();
  </script>
</body>
</html>
`;