// Login handler - separate file to avoid template literal issues

export function getLoginHandlerScript(): string {
  return `
    console.log('Login handler script loaded');
    (function() {
      console.log('Login handler init running');
      var loginButton = document.getElementById('loginButton');
      var passwordInput = document.getElementById('password');
      console.log('Login button found:', !!loginButton);
      console.log('Password input found:', !!passwordInput);
      
      if (loginButton) {
        loginButton.addEventListener('click', function() {
          console.log('Login button clicked');
          var password = passwordInput && passwordInput.value;
          var errorDiv = document.getElementById('loginError');
          console.log('Password:', password ? 'entered' : 'empty');
          
          if (!password) {
            if (errorDiv) {
              errorDiv.textContent = 'Password required';
              errorDiv.style.display = 'block';
            }
            return;
          }
          
          console.log('Calling api.login...');
          api.login(password).then(function(result) {
            console.log('Login result:', result);
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
            console.error('Login error:', err);
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
            console.log('Enter pressed in password field');
            loginButton && loginButton.click();
          }
        });
      }
    })();
  `;
}
