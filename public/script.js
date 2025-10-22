window.addEventListener('DOMContentLoaded', () => {
  const constBox = document.querySelector('.sub-const-1 .const');

  if (constBox) {
    constBox.classList.add('slide-out');

    constBox.addEventListener('transitionend', () => {
      constBox.style.display = 'none';
    });
  }

  // Handle Signup Form Submit
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = signupForm.querySelector('input[name="username"]').value;
      const email = signupForm.querySelector('input[name="email"]').value;
      const password = signupForm.querySelector('input[name="password"]').value;

      try {
        const res = await fetch('/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, email, password })
        });

        const data = await res.json();
        alert(data.message);
      } catch (err) {
        alert('Signup failed. Check console.');
        console.error(err);
      }
    });
  }

  // Handle Login Form Submit
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = loginForm.querySelector('input[name="email"]').value;
      const password = loginForm.querySelector('input[name="password"]').value;

      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        alert(data.message);
      } catch (err) {
        alert('Login failed. Check console.');
        console.error(err);
      }
    });
  }
});
