document.addEventListener('DOMContentLoaded', async () => {
  const loginTab = document.getElementById('tab-login');
  const regTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');
  const loginMsg = document.getElementById('login-msg');
  const regMsg = document.getElementById('reg-msg');

  // Cambiar pestañas
  loginTab.onclick = () => {
    loginTab.classList.add('active');
    regTab.classList.remove('active');
    loginForm.classList.add('active');
    regForm.classList.remove('active');
    clearMessages();
  };

  regTab.onclick = () => {
    regTab.classList.add('active');
    loginTab.classList.remove('active');
    regForm.classList.add('active');
    loginForm.classList.remove('active');
    clearMessages();
  };

  function clearMessages() {
    loginMsg.textContent = '';
    loginMsg.classList.remove('success');
    regMsg.textContent = '';
    regMsg.classList.remove('success');
  }

  // Esperar a que supabase esté listo
  await new Promise(resolve => {
    if (window.supabase) resolve();
    else window.addEventListener('load', resolve);
  });

  // Redirigir si sesión activa
  const { data: { session } } = await window.supabase.auth.getSession();
  if (session) window.location.href = 'dashboard.html';

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
      if (error) {
        loginMsg.textContent = error.message;
        return;
      }

      const { data: userData } = await window.supabase.auth.getUser();
      const user = userData.user;

      if (!user.email_confirmed_at) {
        loginMsg.textContent = 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.';
        await window.supabase.auth.signOut();
        return;
      }

      loginMsg.textContent = '¡Listo! Redirigiendo…';
      loginMsg.classList.add('success');
      setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } catch (err) {
      loginMsg.textContent = err.message;
    }
  });

  // Registro
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
      const { data, error } = await window.supabase.auth.signUp({ email, password });
      if (error) {
        if (error.message.includes('User already registered')) {
          regMsg.textContent = '¡La cuenta ya existe! Usa otro correo.';
        } else {
          regMsg.textContent = error.message;
        }
        return;
      }

      regMsg.textContent = `¡Registro exitoso! Revisa tu correo (${email}) para validar tu cuenta.`;
      regMsg.classList.add('success');
      regForm.reset();
      loginTab.click();
    } catch (err) {
      regMsg.textContent = err.message;
    }
  });
});
