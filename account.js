const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const codeInput = document.getElementById("codeInput");
const newPasswordInput = document.getElementById("newPasswordInput");

const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const sendVerifyBtn = document.getElementById("sendVerifyBtn");
const verifyBtn = document.getElementById("verifyBtn");
const forgotBtn = document.getElementById("forgotBtn");
const resetBtn = document.getElementById("resetBtn");
const accountStatus = document.getElementById("accountStatus");

function setStatus(message) {
  accountStatus.textContent = message;
}

async function callApi(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

async function registerUser() {
  try {
    const data = await callApi("/api/auth/register", {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value
    });

    const code = data.demoVerificationCode ? ` Code: ${data.demoVerificationCode}` : "";
    setStatus(`${data.message}${code}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function loginUser() {
  try {
    const data = await callApi("/api/auth/login", {
      email: emailInput.value.trim(),
      password: passwordInput.value
    });

    window.SKWRITLY.setToken(data.token);
    setStatus(`Logged in as ${data.user.name}`);
  } catch (error) {
    setStatus(error.message);
  }
}

function logoutUser() {
  window.SKWRITLY.clearToken();
  setStatus("Logged out");
}

async function sendVerification() {
  try {
    const data = await callApi("/api/auth/request-verification", {
      email: emailInput.value.trim()
    });
    const code = data.demoVerificationCode ? ` Code: ${data.demoVerificationCode}` : "";
    setStatus(`${data.message}${code}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function verifyEmail() {
  try {
    const data = await callApi("/api/auth/verify-email", {
      email: emailInput.value.trim(),
      code: codeInput.value.trim()
    });
    setStatus(data.message);
  } catch (error) {
    setStatus(error.message);
  }
}

async function forgotPassword() {
  try {
    const data = await callApi("/api/auth/forgot-password", {
      email: emailInput.value.trim()
    });
    const code = data.demoResetCode ? ` Code: ${data.demoResetCode}` : "";
    setStatus(`${data.message}${code}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function resetPassword() {
  try {
    const data = await callApi("/api/auth/reset-password", {
      email: emailInput.value.trim(),
      code: codeInput.value.trim(),
      newPassword: newPasswordInput.value
    });
    setStatus(data.message);
  } catch (error) {
    setStatus(error.message);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  registerBtn.addEventListener("click", registerUser);
  loginBtn.addEventListener("click", loginUser);
  logoutBtn.addEventListener("click", logoutUser);
  sendVerifyBtn.addEventListener("click", sendVerification);
  verifyBtn.addEventListener("click", verifyEmail);
  forgotBtn.addEventListener("click", forgotPassword);
  resetBtn.addEventListener("click", resetPassword);

  if (window.SKWRITLY.getToken()) {
    setStatus("Session token found. You are likely logged in.");
  }
});
