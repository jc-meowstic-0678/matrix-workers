// Login handler - separate file to avoid template literal issues

export function getLoginHandlerScript(): string {
  return `
    document.addEventListener('DOMContentLoaded', function() {
      var loginButton = document.getElementById('loginButton');
      var passwordInput = document.getElementById('password');
      
      if (loginButton) {
        loginButton.addEventListener('click', function() {
          var password = passwordInput && passwordInput.value;
          var errorDiv = document.getElementById('loginError');
          
          if (!password) {
            if (errorDiv) {
              errorDiv.textContent = 'Password required';
              errorDiv.style.display = 'block';
            }
            return;
          }
          
          api.login(password).then(function(result) {
            if (result.success) {
              localStorage.setItem('adminToken', result.token);
              document.getElementById('loginContainer').style.display = 'none';
              document.getElementById('appContainer').classList.add('visible');
              switchView('dashboard');
            } else {
              if (errorDiv) {
                errorDiv.textContent = result.error || 'Login failed';
                errorDiv.style.display = 'block';
              }
            }
          }).catch(function(err) {
            if (errorDiv) {
              errorDiv.textContent = 'Login failed: ' + (err.message || 'Unknown error');
              errorDiv.style.display = 'block';
            }
          });
        });
      }
      
      if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            loginButton && loginButton.click();
          }
        });
      }
    });
  `;
}
