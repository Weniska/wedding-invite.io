(function () {
  const loginForm = document.getElementById("admin-login-form");
  const emailInput = document.getElementById("admin-email");
  const passwordInput = document.getElementById("admin-password");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");

  function setLoginError(message) {
    if (!loginError) return;
    loginError.textContent = message || "";
    loginError.style.display = message ? "block" : "none";
  }

  async function getSession() {
    const { data, error } = await window.sb.auth.getSession();
    if (error) {
      console.error("Failed to get session:", error);
      return null;
    }
    return data.session;
  }

  async function signIn(email, password) {
    const { data, error } = await window.sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function signOut() {
    const { error } = await window.sb.auth.signOut();
    if (error) {
      throw error;
    }
  }

  window.AdminAuth = {
    getSession,
    signIn,
    signOut
  };

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setLoginError("");

      const email = emailInput?.value?.trim() || "";
      const password = passwordInput?.value || "";

      if (!email || !password) {
        setLoginError("Email and password are required.");
        return;
      }

      try {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        await signIn(email, password);
        window.location.reload();
      } catch (error) {
        console.error("Admin login failed:", error);
        setLoginError(error.message || "Login failed.");
      } finally {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      try {
        logoutBtn.disabled = true;
        await signOut();
        window.location.reload();
      } catch (error) {
        console.error("Logout failed:", error);
        alert("Could not log out.");
      } finally {
        logoutBtn.disabled = false;
      }
    });
  }
})();
