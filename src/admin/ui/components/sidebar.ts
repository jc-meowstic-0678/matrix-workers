// Sidebar navigation component

export const sidebarComponent = (serverName: string): string => `
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
      ${navItem('dashboard', 'Dashboard', '⌘D', `
        <rect x="3" y="3" width="7" height="9"></rect>
        <rect x="14" y="3" width="7" height="5"></rect>
        <rect x="14" y="12" width="7" height="9"></rect>
        <rect x="3" y="16" width="7" height="5"></rect>
      `)}
      ${navItem('users', 'Users', '⌘U', `
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      `)}
      ${navItem('rooms', 'Rooms', '⌘R', `
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <circle cx="12" cy="12" r="2"></circle>
      `)}
      ${navItem('federation', 'Federation', '⌘F', `
        <circle cx="12" cy="12" r="2"></circle>
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
        <path d="M2 12h20"></path>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      `)}
      ${navItem('media', 'Media', '⌘M', `
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
        <line x1="23" y1="1" x2="1" y2="23"></line>
      `)}
      ${navItem('reports', 'Reports', '⌘P', `
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      `)}
      ${navItem('security', 'Security', '⌘S', `
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      `)}
      ${navItem('settings', 'Settings', '⌘,', `
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H5.78a1.65 1.65 0 0 0-1.51 1 1.65 1.65 0 0 0 .33 1.82L12 22z"></path>
        <path d="M4.6 9a1.65 1.65 0 0 0-.33 1.82c.23.53.8.9 1.51.9h12.44a1.65 1.65 0 0 0 1.51-.9 1.65 1.65 0 0 0-.33-1.82L12 2z"></path>
      `)}
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
`;

const navItem = (view: string, label: string, shortcut: string, svgPath: string): string => `
  <div class="nav-item" data-view="${view}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${svgPath}
    </svg>
    ${label}
    <span class="nav-shortcut">${shortcut}</span>
    <span id="${view}Badge" class="badge" style="display: none;"></span>
  </div>
`;