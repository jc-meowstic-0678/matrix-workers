// Admin Dashboard HTML with authentication
// Complete implementation with all views and user management

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
export const adminDashboardHtml = (serverName: string, isAuthenticated: boolean = false) => 
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
      --gradient-success: linear-gradient(135deg, var(--accent-green) 0%, #16a34a 100%);
      --gradient-warning: linear-gradient(135deg, var(--accent-amber) 0%, #d97706 100%);
      --gradient-danger: linear-gradient(135deg, var(--accent-red) 0%, #dc2626 100%);
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

    .success-message {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
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
      background: var(--gradient-success);
      color: white;
      box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
    }

    .btn-success:hover {
      box-shadow: 0 4px 16px rgba(34, 197, 94, 0.4);
      transform: translateY(-1px);
    }

    .btn-warning {
      background: var(--gradient-warning);
      color: white;
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    }

    .btn-warning:hover {
      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }

    .btn-danger {
      background: var(--gradient-danger);
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

    .btn-icon {
      padding: 8px;
      border-radius: 8px;
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

    .stat-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--gradient-primary);
      opacity: 0;
      transition: opacity var(--transition-normal);
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .stat-card:hover::after {
      opacity: 1;
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

    .stat-card .change {
      font-size: 12px;
      margin-top: 8px;
    }

    .stat-card .change.positive {
      color: var(--accent-green);
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

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge.admin {
      background: var(--accent-purple);
      color: white;
    }

    .badge.deactivated {
      background: var(--bg-active);
      color: var(--text-tertiary);
    }

    .badge.online {
      background: var(--accent-green);
      color: white;
    }

    .badge.offline {
      background: var(--bg-active);
      color: var(--text-tertiary);
    }

    .badge.unresolved {
      background: var(--accent-red);
      color: white;
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
      padding: 32px;
      max-width: 500px;
      width: 90%;
      border: 1px solid var(--border-default);
      box-shadow: var(--shadow-lg);
    }

    .modal h2 {
      margin-bottom: 24px;
    }

    .modal .form-group {
      margin-bottom: 20px;
    }

    .modal .form-group.checkbox {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal .form-group.checkbox input {
      width: auto;
    }

    .modal-buttons {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    .modal-buttons button {
      flex: 1;
    }

    .search-box {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    .search-box input {
      flex: 1;
      padding: 10px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 8px;
      color: var(--text-primary);
    }

    .pagination {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 20px;
    }

    .pagination button {
      padding: 6px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 6px;
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

    .action-buttons {
      display: flex;
      gap: 8px;
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
        <div class="nav-item" data-view="dashboard">
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
          <span id="federationBadge" class="badge"></span>
        </div>
        <div class="nav-item" data-view="media">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <line x1="23" y1="1" x2="1" y2="23"></line>
          </svg>
          Media
          <span class="nav-shortcut">⌘M</span>
        </div>
        <div class="nav-item" data-view="reports">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          Reports
          <span class="nav-shortcut">⌘P</span>
          <span id="reportsBadge" class="badge"></span>
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
      <!-- Dashboard View -->
      <div id="dashboardView" class="view" style="display: none;">
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
          </div>
          <div class="card-body" id="recentActivity">
            <div class="loading">Loading activity...</div>
          </div>
        </div>
      </div>

      <!-- Users View -->
      <div id="usersView" class="view" style="display: none;">
        <div class="header">
          <h2>Users</h2>
          <div class="header-actions">
            <button class="btn btn-primary" onclick="showCreateUserModal()">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create User
            </button>
            <button class="btn btn-secondary" onclick="refreshUsers()">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>User Management</h3>
            <div class="search-box">
              <input type="text" id="userSearch" placeholder="Search users..." onkeyup="debounceSearchUsers()">
            </div>
          </div>
          <div class="card-body">
            <div id="usersLoading" class="loading">
              <div class="spinner"></div>
              Loading users...
            </div>
            <table id="usersTable" style="display: none;">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Display Name</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="usersList"></tbody>
            </table>
            <div id="noUsers" class="loading" style="display: none;">No users found</div>
            <div class="pagination" id="usersPagination"></div>
          </div>
        </div>
      </div>

      <!-- Rooms View -->
      <div id="roomsView" class="view" style="display: none;">
        <div class="header">
          <h2>Rooms</h2>
          <div class="header-actions">
            <button class="btn btn-primary" onclick="showCreateRoomModal()">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Room
            </button>
            <button class="btn btn-secondary" onclick="refreshRooms()">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Room Management</h3>
            <div class="search-box">
              <input type="text" id="roomSearch" placeholder="Search rooms..." onkeyup="debounceSearchRooms()">
            </div>
          </div>
          <div class="card-body">
            <div id="roomsLoading" class="loading">
              <div class="spinner"></div>
              Loading rooms...
            </div>
            <table id="roomsTable" style="display: none;">
              <thead>
                <tr>
                  <th>Room ID</th>
                  <th>Name</th>
                  <th>Members</th>
                  <th>Version</th>
                  <th>Public</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="roomsList"></tbody>
            </table>
            <div id="noRooms" class="loading" style="display: none;">No rooms found</div>
            <div class="pagination" id="roomsPagination"></div>
          </div>
        </div>
      </div>

      <!-- Federation View -->
      <div id="federationView" class="view" style="display: none;">
        <div class="header">
          <h2>Federation</h2>
          <div class="header-actions">
            <button class="btn btn-primary" onclick="testFederation()">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Run Tests
            </button>
            <button class="btn btn-secondary" onclick="refreshFederation()">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Known Servers</div>
            <div class="value" id="knownServers">-</div>
          </div>
          <div class="stat-card">
            <div class="label">Federation OK</div>
            <div class="value" id="federationOk">-</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Federation Test Results</h3>
          </div>
          <div class="card-body">
            <div id="federationTests"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Known Servers</h3>
          </div>
          <div class="card-body">
            <div id="serversLoading" class="loading">
              <div class="spinner"></div>
              Loading servers...
            </div>
            <table id="serversTable" style="display: none;">
              <thead>
                <tr>
                  <th>Server Name</th>
                  <th>Last Contact</th>
                  <th>Retry Count</th>
                </tr>
              </thead>
              <tbody id="serversList"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Media View -->
      <div id="mediaView" class="view" style="display: none;">
        <div class="header">
          <h2>Media</h2>
          <div class="header-actions">
            <button class="btn btn-secondary" onclick="refreshMedia()">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Total Files</div>
            <div class="value" id="totalFiles">-</div>
          </div>
          <div class="stat-card">
            <div class="label">Total Size</div>
            <div class="value" id="totalSize">-</div>
          </div>
          <div class="stat-card">
            <div class="label">Quarantined</div>
            <div class="value" id="quarantined">-</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Media Files</h3>
          </div>
          <div class="card-body">
            <div id="mediaLoading" class="loading">
              <div class="spinner"></div>
              Loading media...
            </div>
            <table id="mediaTable" style="display: none;">
              <thead>
                <tr>
                  <th>Media ID</th>
                  <th>User</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="mediaList"></tbody>
            </table>
            <div id="noMedia" class="loading" style="display: none;">No media found</div>
          </div>
        </div>
      </div>

      <!-- Reports View -->
      <div id="reportsView" class="view" style="display: none;">
        <div class="header">
          <h2>Content Reports</h2>
          <div class="header-actions">
            <button class="btn btn-secondary" onclick="refreshReports()">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh
            </button>
            <select id="reportFilter" onchange="refreshReports()">
              <option value="all">All Reports</option>
              <option value="unresolved">Unresolved Only</option>
            </select>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Reports</h3>
          </div>
          <div class="card-body">
            <div id="reportsLoading" class="loading">
              <div class="spinner"></div>
              Loading reports...
            </div>
            <table id="reportsTable" style="display: none;">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Reporter</th>
                  <th>Room</th>
                  <th>Reason</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="reportsList"></tbody>
            </table>
            <div id="noReports" class="loading" style="display: none;">No reports found</div>
          </div>
        </div>
      </div>

      <!-- Security View -->
      <div id="securityView" class="view" style="display: none;">
        <div class="header">
          <h2>Security</h2>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3>Rate Limiting</h3>
          </div>
          <div class="card-body">
            <table>
              <tr>
                <td>Login</td>
                <td>10 per minute</td>
                <td><span class="badge online">Active</span></td>
              </tr>
              <tr>
                <td>Register</td>
                <td>5 per minute</td>
                <td><span class="badge online">Active</span></td>
              </tr>
              <tr>
                <td>Sync</td>
                <td>300 per minute</td>
                <td><span class="badge online">Active</span></td>
              </tr>
              <tr>
                <td>Send Message</td>
                <td>60 per minute</td>
                <td><span class="badge online">Active</span></td>
              </tr>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Active Sessions</h3>
          </div>
          <div class="card-body">
            <div id="sessionsLoading" class="loading">
              <div class="spinner"></div>
              Loading sessions...
            </div>
            <table id="sessionsTable" style="display: none;">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Device</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="sessionsList"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Settings View -->
      <div id="settingsView" class="view" style="display: none;">
        <div class="header">
          <h2>Settings</h2>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Server Configuration</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Server Name</label>
              <input type="text" value="${serverName}" readonly disabled>
            </div>
            <div class="form-group checkbox">
              <input type="checkbox" id="registrationEnabled" onchange="toggleRegistration()">
              <label>Enable Registration</label>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Identity Providers (OIDC)</h3>
          </div>
          <div class="card-body">
            <button class="btn btn-primary" onclick="showAddIdPModal()">Add Identity Provider</button>
            <div id="idpList" class="loading">Loading...</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create User Modal -->
  <div id="createUserModal" class="modal">
    <div class="modal-content">
      <h2>Create User</h2>
      <div id="createUserError" class="error-message" style="display: none;"></div>
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="newUsername" placeholder="username" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="newPassword" placeholder="password" required>
      </div>
      <div class="form-group checkbox">
        <input type="checkbox" id="newIsAdmin">
        <label>Make admin</label>
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('createUserModal')">Cancel</button>
        <button class="btn btn-primary" onclick="createUser()">Create</button>
      </div>
    </div>
  </div>

  <!-- Create Room Modal -->
  <div id="createRoomModal" class="modal">
    <div class="modal-content">
      <h2>Create Room</h2>
      <div id="createRoomError" class="error-message" style="display: none;"></div>
      <div class="form-group">
        <label>Room Name (optional)</label>
        <input type="text" id="newRoomName" placeholder="Room name">
      </div>
      <div class="form-group">
        <label>Room Alias (optional)</label>
        <input type="text" id="newRoomAlias" placeholder="room">
      </div>
      <div class="form-group">
        <label>Room Type</label>
        <select id="newRoomPreset">
          <option value="public_chat">Public Chat</option>
          <option value="private_chat">Private Chat</option>
          <option value="trusted_private_chat">Trusted Private Chat</option>
        </select>
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('createRoomModal')">Cancel</button>
        <button class="btn btn-primary" onclick="createRoom()">Create</button>
      </div>
    </div>
  </div>

  <!-- User Details Modal -->
  <div id="userDetailsModal" class="modal">
    <div class="modal-content">
      <h2>User Details</h2>
      <div id="userDetailsContent"></div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('userDetailsModal')">Close</button>
      </div>
    </div>
  </div>

  <!-- Room Details Modal -->
  <div id="roomDetailsModal" class="modal">
    <div class="modal-content">
      <h2>Room Details</h2>
      <div id="roomDetailsContent"></div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" onclick="hideModal('roomDetailsModal')">Close</button>
      </div>
    </div>
  </div>

  <script>
    // ============================================
    // API Client
    // ============================================
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
        if (!response.ok) throw new Error('API error');
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
        if (!response.ok) throw new Error('API error');
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
        if (!response.ok) throw new Error('API error');
        return response.json();
      },

      async delete(endpoint) {
        const response = await fetch('/admin/api' + endpoint, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
        });
        if (!response.ok) throw new Error('API error');
        return response.json();
      },

      setToken(token) {
        localStorage.setItem('adminToken', token);
      },

      getToken() {
        return localStorage.getItem('adminToken');
      }
    };

    // ============================================
    // UI State
    // ============================================
    let currentPage = {
      users: 0,
      rooms: 0,
      media: 0
    };
    let searchTimeout;

    // ============================================
    // Login / Logout
    // ============================================
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
          switchView('dashboard');
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

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await api.logout();
      localStorage.removeItem('adminToken');
      document.getElementById('loginContainer').style.display = 'flex';
      document.getElementById('appContainer').classList.remove('visible');
    });

    // ============================================
    // Navigation
    // ============================================
    function switchView(viewName) {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
      
      const navItem = document.querySelector(`[data-view="${viewName}"]`);
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
        case 'security': loadSessions(); break;
        case 'settings': loadSettings(); break;
      }
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const viewName = item.dataset.view;
        switchView(viewName);
      });
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
          case 'p': e.preventDefault(); switchView('reports'); break;
          case 's': e.preventDefault(); switchView('security'); break;
          case ',': e.preventDefault(); switchView('settings'); break;
        }
      }
    });

    // ============================================
    // Dashboard
    // ============================================
    async function loadDashboard() {
      try {
        const stats = await api.get('/stats');
        document.getElementById('totalUsers').textContent = stats.totalUsers || '0';
        document.getElementById('activeUsers').textContent = stats.activeUsers || '0';
        document.getElementById('totalRooms').textContent = stats.totalRooms || '0';
        document.getElementById('federationStatus').textContent = stats.federationOk ? '✅ OK' : '❌ Failed';

        // Load recent activity
        document.getElementById('recentActivity').innerHTML = '<div class="loading">Loading...</div>';
        // TODO: Load recent activity from analytics
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      }
    }

    // ============================================
    // Users Management
    // ============================================
    let currentUsers = [];

    async function loadUsers(page = 0, search = '') {
      document.getElementById('usersLoading').style.display = 'block';
      document.getElementById('usersTable').style.display = 'none';
      document.getElementById('noUsers').style.display = 'none';

      try {
        let url = `/users?limit=50&offset=${page * 50}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const data = await api.get(url);
        currentUsers = data.users || [];
        
        if (currentUsers.length === 0) {
          document.getElementById('usersLoading').style.display = 'none';
          document.getElementById('noUsers').style.display = 'block';
          return;
        }

        const tbody = document.getElementById('usersList');
        tbody.innerHTML = '';

        currentUsers.forEach(user => {
          const tr = document.createElement('tr');
          tr.innerHTML = 
            <td>\${user.user_id}</td>
            <td>\${user.display_name || '-'}</td>
            <td><span class="badge \${user.admin ? 'admin' : ''} \${user.is_deactivated ? 'deactivated' : ''}">\${user.admin ? 'Admin' : user.is_deactivated ? 'Deactivated' : 'User'}</span></td>
            <td>\${new Date(user.created_at).toLocaleDateString()}</td>
            <td class="action-buttons">
              <button class="btn btn-sm btn-secondary" onclick="viewUser('\${user.user_id}')">View</button>
              <button class="btn btn-sm btn-warning" onclick="resetUserPassword('\${user.user_id}')">Reset Password</button>
              \${user.is_deactivated ? 
                '<button class="btn btn-sm btn-success" onclick="reactivateUser(\'' + user.user_id + '\')">Reactivate</button>' : 
                '<button class="btn btn-sm btn-danger" onclick="deactivateUser(\'' + user.user_id + '\')">Deactivate</button>'
              }
              \${!user.admin ? '<button class="btn btn-sm btn-primary" onclick="makeAdmin(\'' + user.user_id + '\')">Make Admin</button>' : ''}
            </td>
          ;
          tbody.appendChild(tr);
        });

        // Update pagination
        const total = data.total || 0;
        const totalPages = Math.ceil(total / 50);
        renderPagination('usersPagination', page, totalPages, (newPage) => loadUsers(newPage, search));

        document.getElementById('usersLoading').style.display = 'none';
        document.getElementById('usersTable').style.display = 'table';
      } catch (err) {
        console.error('Failed to load users:', err);
        document.getElementById('usersLoading').innerHTML = 'Failed to load users';
      }
    }

    function refreshUsers() {
      const search = document.getElementById('userSearch').value;
      loadUsers(0, search);
    }

    function debounceSearchUsers() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const search = document.getElementById('userSearch').value;
        loadUsers(0, search);
      }, 300);
    }

    function showCreateUserModal() {
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('newIsAdmin').checked = false;
      document.getElementById('createUserError').style.display = 'none';
      document.getElementById('createUserModal').classList.add('visible');
    }

    async function createUser() {
      const username = document.getElementById('newUsername').value;
      const password = document.getElementById('newPassword').value;
      const isAdmin = document.getElementById('newIsAdmin').checked;

      if (!username || !password) {
        showError('createUserError', 'Username and password required');
        return;
      }

      try {
        await api.post('/users', { username, password, admin: isAdmin });
        hideModal('createUserModal');
        refreshUsers();
      } catch (err) {
        showError('createUserError', err.message || 'Failed to create user');
      }
    }

    async function viewUser(userId) {
      try {
        const data = await api.get('/users/' + encodeURIComponent(userId));
        const modal = document.getElementById('userDetailsContent');
        modal.innerHTML = 
          <div class="form-group"><label>User ID</label><div>\${data.user_id}</div></div>
          <div class="form-group"><label>Localpart</label><div>\${data.localpart}</div></div>
          <div class="form-group"><label>Display Name</label><div>\${data.display_name || '-'}</div></div>
          <div class="form-group"><label>Admin</label><div>\${data.admin ? 'Yes' : 'No'}</div></div>
          <div class="form-group"><label>Deactivated</label><div>\${data.is_deactivated ? 'Yes' : 'No'}</div></div>
          <div class="form-group"><label>Devices</label><div>\${data.devices?.length || 0}</div></div>
          <div class="form-group"><label>Rooms</label><div>\${data.rooms?.length || 0}</div></div>
        ;
        document.getElementById('userDetailsModal').classList.add('visible');
      } catch (err) {
        alert('Failed to load user details');
      }
    }

    async function resetUserPassword(userId) {
      const newPassword = prompt('Enter new password for ' + userId);
      if (!newPassword) return;

      try {
        await api.post('/users/' + encodeURIComponent(userId) + '/reset-password', { password: newPassword });
        alert('Password reset successfully');
      } catch (err) {
        alert('Failed to reset password');
      }
    }

    async function deactivateUser(userId) {
      if (!confirm('Deactivate user ' + userId + '?')) return;

      try {
        await api.delete('/users/' + encodeURIComponent(userId));
        refreshUsers();
      } catch (err) {
        alert('Failed to deactivate user');
      }
    }

    async function reactivateUser(userId) {
      try {
        await api.post('/users/' + encodeURIComponent(userId) + '/reactivate', {});
        refreshUsers();
      } catch (err) {
        alert('Failed to reactivate user');
      }
    }

    async function makeAdmin(userId) {
      if (!confirm('Make ' + userId + ' an admin?')) return;

      try {
        await api.post('/make-admin', { user_id: userId });
        refreshUsers();
      } catch (err) {
        alert('Failed to make admin');
      }
    }

    // ============================================
    // Rooms Management
    // ============================================
    let currentRooms = [];

    async function loadRooms(page = 0, search = '') {
      document.getElementById('roomsLoading').style.display = 'block';
      document.getElementById('roomsTable').style.display = 'none';
      document.getElementById('noRooms').style.display = 'none';

      try {
        let url = /rooms?limit=50&offset=\${page * 50};
        if (search) url += &search=\${encodeURIComponent(search)};
        
        const data = await api.get(url);
        currentRooms = data.rooms || [];
        
        if (currentRooms.length === 0) {
          document.getElementById('roomsLoading').style.display = 'none';
          document.getElementById('noRooms').style.display = 'block';
          return;
        }

        const tbody = document.getElementById('roomsList');
        tbody.innerHTML = '';

        currentRooms.forEach(room => {
          const tr = document.createElement('tr');
          tr.innerHTML = 
            <td>\${room.room_id}</td>
            <td>\${room.name || '-'}</td>
            <td>\${room.member_count || 0}</td>
            <td>\${room.room_version || '10'}</td>
            <td>\${room.is_public ? '✅' : '❌'}</td>
            <td class="action-buttons">
              <button class="btn btn-sm btn-secondary" onclick="viewRoom('\${room.room_id}')">View</button>
              <button class="btn btn-sm btn-danger" onclick="deleteRoom('\${room.room_id}')">Delete</button>
            </td>
          ;
          tbody.appendChild(tr);
        });

        const total = data.total || 0;
        const totalPages = Math.ceil(total / 50);
        renderPagination('roomsPagination', page, totalPages, (newPage) => loadRooms(newPage, search));

        document.getElementById('roomsLoading').style.display = 'none';
        document.getElementById('roomsTable').style.display = 'table';
      } catch (err) {
        console.error('Failed to load rooms:', err);
        document.getElementById('roomsLoading').innerHTML = 'Failed to load rooms';
      }
    }

    function refreshRooms() {
      const search = document.getElementById('roomSearch').value;
      loadRooms(0, search);
    }

    function debounceSearchRooms() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const search = document.getElementById('roomSearch').value;
        loadRooms(0, search);
      }, 300);
    }

    function showCreateRoomModal() {
      document.getElementById('newRoomName').value = '';
      document.getElementById('newRoomAlias').value = '';
      document.getElementById('newRoomPreset').value = 'private_chat';
      document.getElementById('createRoomError').style.display = 'none';
      document.getElementById('createRoomModal').classList.add('visible');
    }

    async function createRoom() {
      const name = document.getElementById('newRoomName').value;
      const alias = document.getElementById('newRoomAlias').value;
      const preset = document.getElementById('newRoomPreset').value;

      try {
        const data = {
          name: name || undefined,
          preset,
          visibility: preset === 'public_chat' ? 'public' : 'private'
        };
        if (alias) {
          data.room_alias_local_part = alias;
        }

        const result = await api.post('/rooms/create', data);
        hideModal('createRoomModal');
        refreshRooms();
        alert('Room created: ' + result.room_id);
      } catch (err) {
        showError('createRoomError', err.message || 'Failed to create room');
      }
    }

    async function viewRoom(roomId) {
      try {
        const data = await api.get('/rooms/' + encodeURIComponent(roomId));
        const modal = document.getElementById('roomDetailsContent');
        modal.innerHTML = 
          <div class="form-group"><label>Room ID</label><div>\${data.room_id}</div></div>
          <div class="form-group"><label>Name</label><div>\${data.name || '-'}</div></div>
          <div class="form-group"><label>Topic</label><div>\${data.topic || '-'}</div></div>
          <div class="form-group"><label>Version</label><div>\${data.room_version || '10'}</div></div>
          <div class="form-group"><label>Members</label><div>\${data.member_count || 0}</div></div>
          <div class="form-group"><label>Public</label><div>\${data.is_public ? 'Yes' : 'No'}</div></div>
          <div class="form-group"><label>Join Rule</label><div>\${data.join_rule || 'invite'}</div></div>
          <div class="form-group"><label>Aliases</label><div>\${data.aliases?.join(', ') || '-'}</div></div>
        ;
        document.getElementById('roomDetailsModal').classList.add('visible');
      } catch (err) {
        alert('Failed to load room details');
      }
    }

    async function deleteRoom(roomId) {
      if (!confirm('Delete room ' + roomId + '? This cannot be undone.')) return;

      try {
        await api.delete('/rooms/' + encodeURIComponent(roomId));
        refreshRooms();
      } catch (err) {
        alert('Failed to delete room');
      }
    }

    // ============================================
    // Federation
    // ============================================
    async function loadFederation() {
      try {
        const status = await api.get('/federation/status');
        document.getElementById('knownServers').textContent = status.known_servers_count || '0';
        document.getElementById('federationOk').innerHTML = status.federation_enabled ? '✅' : '❌';

        // Load servers list
        const servers = await api.get('/federation/servers');
        const tbody = document.getElementById('serversList');
        const table = document.getElementById('serversTable');
        
        if (servers.servers?.length > 0) {
          tbody.innerHTML = '';
          servers.servers.forEach(server => {
            const tr = document.createElement('tr');
            tr.innerHTML = 
              <td>\${server.server_name}</td>
              <td>\${server.last_successful_fetch ? new Date(server.last_successful_fetch).toLocaleString() : 'Never'}</td>
              <td>\${server.retry_count || 0}</td>
            ;
            tbody.appendChild(tr);
          });
          document.getElementById('serversLoading').style.display = 'none';
          table.style.display = 'table';
        } else {
          document.getElementById('serversLoading').innerHTML = 'No servers found';
        }
      } catch (err) {
        console.error('Failed to load federation:', err);
      }
    }

    async function testFederation() {
      try {
        const results = await api.get('/federation/test');
        const container = document.getElementById('federationTests');
        
        let html = '<table><thead><tr><th>Test</th><th>Status</th><th>Message</th></tr></thead><tbody>';
        results.tests.forEach(test => {
          html += <tr>
            <td>\${test.name}</td>
            <td>\${test.passed ? '✅' : '❌'}</td>
            <td>\${test.message}</td>
          </tr>;
        });
        html += '</tbody></table>';
        
        container.innerHTML = html;
      } catch (err) {
        console.error('Failed to run federation tests:', err);
      }
    }

    function refreshFederation() {
      loadFederation();
      testFederation();
    }

    // ============================================
    // Media
    // ============================================
    async function loadMedia(page = 0) {
      document.getElementById('mediaLoading').style.display = 'block';
      document.getElementById('mediaTable').style.display = 'none';
      document.getElementById('noMedia').style.display = 'none';

      try {
        const data = await api.get('/media?limit=50&offset=' + (page * 50));
        
        // Update stats
        let totalSize = 0;
        let quarantined = 0;
        data.media.forEach(m => {
          totalSize += m.content_length || 0;
          if (m.quarantined) quarantined++;
        });
        
        document.getElementById('totalFiles').textContent = data.total || 0;
        document.getElementById('totalSize').textContent = formatBytes(totalSize);
        document.getElementById('quarantined').textContent = quarantined;

        if (data.media.length === 0) {
          document.getElementById('mediaLoading').style.display = 'none';
          document.getElementById('noMedia').style.display = 'block';
          return;
        }

        const tbody = document.getElementById('mediaList');
        tbody.innerHTML = '';

        data.media.forEach(media => {
          const tr = document.createElement('tr');
          tr.innerHTML = 
            <td>\${media.media_id.substring(0, 8)}...</td>
            <td>\${media.user_id}</td>
            <td>\${media.content_type}</td>
            <td>\${formatBytes(media.content_length)}</td>
            <td>\${new Date(media.created_at).toLocaleDateString()}</td>
            <td><span class="badge \${media.quarantined ? 'deactivated' : 'online'}">\${media.quarantined ? 'Quarantined' : 'Normal'}</span></td>
            <td class="action-buttons">
              \${media.quarantined ? 
                '<button class="btn btn-sm btn-success" onclick="unquarantineMedia(\'' + media.media_id + '\')">Release</button>' : 
                '<button class="btn btn-sm btn-warning" onclick="quarantineMedia(\'' + media.media_id + '\')">Quarantine</button>'
              }
              <button class="btn btn-sm btn-danger" onclick="deleteMedia('\${media.media_id}')">Delete</button>
            </td>
          ;
          tbody.appendChild(tr);
        });

        document.getElementById('mediaLoading').style.display = 'none';
        document.getElementById('mediaTable').style.display = 'table';
      } catch (err) {
        console.error('Failed to load media:', err);
        document.getElementById('mediaLoading').innerHTML = 'Failed to load media';
      }
    }

    function refreshMedia() {
      loadMedia(currentPage.media);
    }

    async function quarantineMedia(mediaId) {
      try {
        await api.post('/media/' + mediaId + '/quarantine', {});
        refreshMedia();
      } catch (err) {
        alert('Failed to quarantine media');
      }
    }

    async function unquarantineMedia(mediaId) {
      // This would need an endpoint in admin.ts
      alert('Unquarantine not yet implemented');
    }

    async function deleteMedia(mediaId) {
      if (!confirm('Delete media ' + mediaId + '?')) return;

      try {
        await api.delete('/media/' + mediaId);
        refreshMedia();
      } catch (err) {
        alert('Failed to delete media');
      }
    }

    // ============================================
    // Reports
    // ============================================
    async function loadReports() {
      document.getElementById('reportsLoading').style.display = 'block';
      document.getElementById('reportsTable').style.display = 'none';
      document.getElementById('noReports').style.display = 'none';

      try {
        const filter = document.getElementById('reportFilter').value;
        const url = filter === 'unresolved' ? '/reports?resolved=false' : '/reports';
        
        const data = await api.get(url);
        
        // Update badge
        const unresolved = data.reports?.filter(r => !r.resolved).length || 0;
        document.getElementById('reportsBadge').textContent = unresolved > 0 ? unresolved : '';
        document.getElementById('reportsBadge').style.display = unresolved > 0 ? 'inline' : 'none';

        if (data.reports?.length === 0) {
          document.getElementById('reportsLoading').style.display = 'none';
          document.getElementById('noReports').style.display = 'block';
          return;
        }

        const tbody = document.getElementById('reportsList');
        tbody.innerHTML = '';

        data.reports.forEach(report => {
          const tr = document.createElement('tr');
          tr.innerHTML = 
            <td>\${report.id}</td>
            <td>\${report.reporter_user_id}</td>
            <td>\${report.room_id.substring(0, 16)}...</td>
            <td>\${report.reason}</td>
            <td>\${report.score}</td>
            <td><span class="badge \${report.resolved ? 'online' : 'unresolved'}">\${report.resolved ? 'Resolved' : 'Unresolved'}</span></td>
            <td class="action-buttons">
              \${!report.resolved ? 
                '<button class="btn btn-sm btn-success" onclick="resolveReport(' + report.id + ')">Resolve</button>' : 
                '<button class="btn btn-sm btn-warning" onclick="unresolveReport(' + report.id + ')">Unresolve</button>'
              }
            </td>
          ;
          tbody.appendChild(tr);
        });

        document.getElementById('reportsLoading').style.display = 'none';
        document.getElementById('reportsTable').style.display = 'table';
      } catch (err) {
        console.error('Failed to load reports:', err);
        document.getElementById('reportsLoading').innerHTML = 'Failed to load reports';
      }
    }

    function refreshReports() {
      loadReports();
    }

    async function resolveReport(reportId) {
      const note = prompt('Resolution note (optional):');
      try {
        await api.post('/reports/' + reportId + '/resolve', { note });
        refreshReports();
      } catch (err) {
        alert('Failed to resolve report');
      }
    }

    async function unresolveReport(reportId) {
      try {
        await api.post('/reports/' + reportId + '/unresolve', {});
        refreshReports();
      } catch (err) {
        alert('Failed to unresolve report');
      }
    }

    // ============================================
    // Security
    // ============================================
    async function loadSessions() {
      document.getElementById('sessionsLoading').style.display = 'block';
      document.getElementById('sessionsTable').style.display = 'none';

      try {
        // Get all users with active sessions (simplified - just show first 50 users)
        const users = await api.get('/users?limit=50');
        const tbody = document.getElementById('sessionsList');
        tbody.innerHTML = '';

        for (const user of users.users || []) {
          const sessions = await api.get('/users/' + encodeURIComponent(user.user_id) + '/sessions');
          sessions.sessions?.forEach(session => {
            const tr = document.createElement('tr');
            tr.innerHTML = 
              <td>\${user.user_id}</td>
              <td>\${session.device_id || '-'}</td>
              <td>\${new Date(session.created_at).toLocaleDateString()}</td>
              <td class="action-buttons">
                <button class="btn btn-sm btn-danger" onclick="revokeSession('\${session.id}')">Revoke</button>
              </td>
            ;
            tbody.appendChild(tr);
          });
        }

        document.getElementById('sessionsLoading').style.display = 'none';
        document.getElementById('sessionsTable').style.display = 'table';
      } catch (err) {
        console.error('Failed to load sessions:', err);
        document.getElementById('sessionsLoading').innerHTML = 'Failed to load sessions';
      }
    }

    async function revokeSession(sessionId) {
      if (!confirm('Revoke this session?')) return;

      try {
        await api.delete('/sessions/' + sessionId);
        loadSessions();
      } catch (err) {
        alert('Failed to revoke session');
      }
    }

    // ============================================
    // Settings
    // ============================================
    async function loadSettings() {
      try {
        const config = await api.get('/config');
        document.getElementById('registrationEnabled').checked = config.features?.registration !== false;
      } catch (err) {
        console.error('Failed to load settings:', err);
      }

      try {
        const providers = await api.get('/idp/providers');
        const container = document.getElementById('idpList');
        if (providers.providers?.length > 0) {
          let html = '<table><thead><tr><th>Name</th><th>Status</th><th>Users</th><th>Actions</th></tr></thead><tbody>';
          providers.providers.forEach(p => {
            html += <tr>
              <td>\${p.name}</td>
              <td><span class="badge \${p.enabled ? 'online' : 'deactivated'}">\${p.enabled ? 'Enabled' : 'Disabled'}</span></td>
              <td>\${p.linked_users || 0}</td>
              <td class="action-buttons">
                <button class="btn btn-sm btn-secondary" onclick="editIdP('\${p.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteIdP('\${p.id}')">Delete</button>
              </td>
            </tr>;
          });
          html += '</tbody></table>';
          container.innerHTML = html;
        } else {
          container.innerHTML = '<p>No identity providers configured</p>';
        }
      } catch (err) {
        console.error('Failed to load IdPs:', err);
      }
    }

    async function toggleRegistration() {
      const enabled = document.getElementById('registrationEnabled').checked;
      try {
        await api.put('/registration', { enabled });
      } catch (err) {
        console.error('Failed to update registration setting:', err);
      }
    }

    // ============================================
    // Utility Functions
    // ============================================
    function hideModal(modalId) {
      document.getElementById(modalId).classList.remove('visible');
    }

    function showError(elementId, message) {
      const el = document.getElementById(elementId);
      el.textContent = message;
      el.style.display = 'block';
    }

    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function renderPagination(elementId, currentPage, totalPages, callback) {
      const container = document.getElementById(elementId);
      if (totalPages <= 1) {
        container.innerHTML = '';
        return;
      }

      let html = '';
      if (currentPage > 0) {
        html += '<button onclick="loadUsers(' + (currentPage - 1) + ')">Previous</button>';
      }

      for (let i = Math.max(0, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
        html += '<button class="' + (i === currentPage ? 'active' : '') + '" onclick="loadUsers(' + i + ')">' + (i + 1) + '</button>';
      }

      if (currentPage < totalPages - 1) {
        html += '<button onclick="loadUsers(' + (currentPage + 1) + ')">Next</button>';
      }

      container.innerHTML = html;
    }

    // ============================================
    // Initialization
    // ============================================
    (async () => {
      const status = await api.checkAuth();
      if (status.authenticated) {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').classList.add('visible');
        switchView('dashboard');
      }
    })();
  </script>
</body>
</html>
`;