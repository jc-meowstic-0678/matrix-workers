// src/admin/ui/views/settings.ts
// Settings view with registration toggle

export const settingsView = (): string => `
  <div id="settingsView" class="view" style="display: none;">
    <div class="header">
      <h2>Settings</h2>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Server Information</h3>
      </div>
      <div class="card-body">
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Server Name:</span>
            <span class="info-value" id="serverNameDisplay">-</span>
          </div>
          <div class="info-row">
            <span class="info-label">Version:</span>
            <span class="info-value" id="serverVersionDisplay">-</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Registration</h3>
      </div>
      <div class="card-body">
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-name">Allow New User Registration</div>
            <div class="setting-description">When disabled, only admins can create users via the admin panel</div>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input type="checkbox" id="registrationEnabled" onchange="toggleRegistration()">
              <span class="toggle-slider"></span>
            </label>
            <span id="registrationStatus" class="status-badge"></span>
          </div>
        </div>
        <div class="setting-note" id="registrationNote" style="display: none;">
          ⚠️ Changing this setting affects all users immediately.
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Feature Flags</h3>
      </div>
      <div class="card-body">
        <div id="featuresLoading" class="loading">Loading features...</div>
        <div id="featuresList" style="display: none;">
          <div class="features-grid" id="featuresContainer"></div>
        </div>
      </div>
    </div>
  </div>
`;