// src/admin/ui/views/settings.ts
// Settings view with registration toggle

export const settingsView = (): string => `
  <div id="settingsView" class="view" style="display: none;">
    <div class="header">
      <h2>Settings</h2>
    </div>
    
    <div class="card">
      <h3>Server Information</h3>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Server Name</span>
          <span class="info-value" id="serverNameDisplay">-</span>
        </div>
        <div class="info-row">
          <span class="info-label">Version</span>
          <span class="info-value" id="serverVersionDisplay">-</span>
        </div>
      </div>
    </div>
    
    <div class="card" style="margin-top: 20px;">
      <h3>Registration</h3>
      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-name">Enable Registration</div>
          <div class="setting-description">Allow new users to register on this server</div>
        </div>
        <div class="setting-control">
          <label class="toggle-switch">
            <input type="checkbox" id="registrationEnabled">
            <span class="toggle-slider"></span>
          </label>
          <span class="status-badge disabled" id="registrationStatus">Disabled</span>
        </div>
      </div>
      <div id="registrationNote" class="setting-note" style="display: none;">
        Changes are saved automatically
      </div>
    </div>
    
    <div class="card" style="margin-top: 20px;">
      <h3>Features</h3>
      <div id="featuresLoading">Loading features...</div>
      <div id="featuresList" style="display: none;">
        <div id="featuresContainer" class="features-grid"></div>
      </div>
    </div>
  </div>
`;

export const settingsStyles = `
  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .info-row {
    display: flex;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-default);
  }
  
  .info-row:last-child {
    border-bottom: none;
  }
  
  .info-label {
    width: 120px;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .info-value {
    color: var(--text-primary);
    font-family: monospace;
  }
  
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: var(--bg-elevated);
    border-radius: 8px;
    margin-bottom: 12px;
  }
  
  .setting-info {
    flex: 1;
  }
  
  .setting-name {
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .setting-description {
    font-size: 13px;
    color: var(--text-secondary);
  }
  
  .setting-control {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: 20px;
  }
  
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 52px;
    height: 28px;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-active);
    transition: .3s;
    border-radius: 34px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 22px;
    width: 22px;
    left: 3px;
    bottom: 3px;
    background-color: var(--text-secondary);
    transition: .3s;
    border-radius: 50%;
  }
  
  input:checked + .toggle-slider {
    background-color: var(--accent-green);
  }
  
  input:checked + .toggle-slider:before {
    transform: translateX(24px);
    background-color: white;
  }
  
  .status-badge {
    padding: 4px 10px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
  }
  
  .status-badge.enabled {
    background: var(--accent-green);
    color: white;
  }
  
  .status-badge.disabled {
    background: var(--bg-active);
    color: var(--text-tertiary);
  }
  
  .setting-note {
    margin-top: 12px;
    padding: 12px 16px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    color: var(--accent-amber);
    font-size: 14px;
  }
  
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }
  
  .feature-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--bg-elevated);
    border-radius: 8px;
  }
  
  .feature-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  
  .feature-indicator.enabled {
    background: var(--accent-green);
    box-shadow: 0 0 8px var(--accent-green);
  }
  
  .feature-indicator.disabled {
    background: var(--bg-active);
  }
  
  .feature-name {
    flex: 1;
    font-size: 14px;
  }
`;

export const settingsFunctions = (): string => `
  // ============================================
  // Settings Functions
  // ============================================
  
  async function loadSettings() {
    try {
      const settings = await api.get('/settings');
      
      // Update server info
      const serverNameEl = document.getElementById('serverNameDisplay');
      const serverVersionEl = document.getElementById('serverVersionDisplay');
      if (serverNameEl) serverNameEl.textContent = settings.server_name || '-';
      if (serverVersionEl) serverVersionEl.textContent = settings.version || '-';
      
      // Update registration toggle
      const registrationEnabled = settings.registration_enabled !== false;
      const toggle = document.getElementById('registrationEnabled');
      const status = document.getElementById('registrationStatus');
      const note = document.getElementById('registrationNote');
      
      if (toggle && status) {
        toggle.checked = registrationEnabled;
        status.textContent = registrationEnabled ? 'Enabled' : 'Disabled';
        status.className = 'status-badge ' + (registrationEnabled ? 'enabled' : 'disabled');
        
        // Show note when changed
        toggle.addEventListener('change', () => {
          if (note) note.style.display = 'block';
        });
      }
      
    } catch (err) {
      console.error('Failed to load settings:', err);
      showNotification('Failed to load settings', 'error');
    }
  }
  
  async function toggleRegistration() {
    const enabled = document.getElementById('registrationEnabled').checked;
    const status = document.getElementById('registrationStatus');
    const note = document.getElementById('registrationNote');
    
    try {
      // Show loading state
      status.textContent = 'Saving...';
      status.className = 'status-badge';
      
      // Update via API
      await api.put('/settings/registration_enabled', { value: enabled });
      
      // Update UI
      status.textContent = enabled ? 'Enabled' : 'Disabled';
      status.className = 'status-badge ' + (enabled ? 'enabled' : 'disabled');
      
      // Hide note after successful save
      note.style.display = 'none';
      
      showNotification('Registration setting updated successfully', 'success');
      
    } catch (err) {
      console.error('Failed to update registration setting:', err);
      
      // Revert toggle
      document.getElementById('registrationEnabled').checked = !enabled;
      status.textContent = !enabled ? 'Enabled' : 'Disabled';
      status.className = 'status-badge ' + (!enabled ? 'enabled' : 'disabled');
      
      showNotification('Failed to update registration setting', 'error');
    }
  }
  
  async function loadFeatures() {
    const featuresEl = document.getElementById('featuresLoading');
    const featuresList = document.getElementById('featuresList');
    const container = document.getElementById('featuresContainer');
    
    if (!featuresEl || !featuresList || !container) return;
    
    featuresEl.style.display = 'block';
    featuresList.style.display = 'none';
    
    try {
      const data = await api.get('/settings/features');
      
      container.innerHTML = '';
      
      for (const [feature, enabled] of Object.entries(data.features)) {
        const featureEl = document.createElement('div');
        featureEl.className = 'feature-item';
        featureEl.innerHTML = \`
          <span class="feature-indicator \${enabled ? 'enabled' : 'disabled'}"></span>
          <span class="feature-name">\${formatFeatureName(feature)}</span>
          <span class="feature-value">\${enabled ? '✓' : '✗'}</span>
        \`;
        container.appendChild(featureEl);
      }
      
      featuresEl.style.display = 'none';
      featuresList.style.display = 'block';
      
    } catch (err) {
      console.error('Failed to load features:', err);
      featuresEl.innerHTML = 'Failed to load features';
    }
  }
  
  function formatFeatureName(feature) {
    return feature
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Make functions globally available
  window.loadSettings = loadSettings;
  window.toggleRegistration = toggleRegistration;
  window.loadFeatures = loadFeatures;
`;

// Also export as default object for compatibility
export default {
  view: settingsView,
  styles: settingsStyles,
  functions: settingsFunctions
};