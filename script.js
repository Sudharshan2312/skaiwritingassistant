const userPrompt = document.getElementById("userPrompt");
const outputBox = document.getElementById("outputBox");
const wordCount = document.getElementById("wordCount");
const generateBtn = document.getElementById("generateBtn");
const apiStatus = document.getElementById("apiStatus");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authCode = document.getElementById("authCode");
const authNewPassword = document.getElementById("authNewPassword");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const requestVerifyBtn = document.getElementById("requestVerifyBtn");
const verifyEmailBtn = document.getElementById("verifyEmailBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const authMessage = document.getElementById("authMessage");
const authBadge = document.getElementById("authBadge");
const historyList = document.getElementById("historyList");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

const TOKEN_KEY = "sk_writly_token";
let authToken = localStorage.getItem(TOKEN_KEY) || "";
let currentUser = null;

function updateWordCount(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  wordCount.textContent = words;
}

async function checkBackendConnectivity() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error("Backend health check failed");
    }

    apiStatus.textContent = "Backend connected";
    apiStatus.classList.remove("disconnected");
    apiStatus.classList.add("connected");
  } catch (error) {
    apiStatus.textContent = "Backend disconnected - start server";
    apiStatus.classList.remove("connected");
    apiStatus.classList.add("disconnected");
  }
}

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function updateAuthBadge() {
  if (currentUser) {
    authBadge.textContent = `Signed in as ${currentUser.name}`;
    authBadge.classList.remove("signed-out");
    authBadge.classList.add("signed-in");
    return;
  }

  authBadge.textContent = "Signed out";
  authBadge.classList.remove("signed-in");
  authBadge.classList.add("signed-out");
}

function getAuthHeaders() {
  if (!authToken) {
    return { "Content-Type": "application/json" };
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`
  };
}

function updateHistoryUI(items) {
  if (!items.length) {
    historyList.innerHTML = '<p class="history-empty">No history yet. Generate content while logged in.</p>';
    return;
  }

  historyList.innerHTML = items
    .map((item) => {
      const createdAt = new Date(item.createdAt).toLocaleString();
      return `
        <article class="history-item" data-id="${item.id}">
          <p class="history-date">${createdAt}</p>
          <p class="history-prompt">${item.prompt}</p>
          <p class="history-output">${item.output}</p>
          <button class="tiny-btn history-delete" data-id="${item.id}">Delete</button>
        </article>
      `;
    })
    .join("");

  historyList.querySelectorAll(".history-delete").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.getAttribute("data-id");
      await deleteHistoryItem(id);
      await loadHistory();
    });
  });
}

async function loadMe() {
  if (!authToken) {
    currentUser = null;
    updateAuthBadge();
    return;
  }

  try {
    const response = await fetch("/api/auth/me", {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error("Invalid session");
    }

    const payload = await response.json();
    currentUser = payload.user;
    updateAuthBadge();
    setAuthMessage(`Welcome back, ${currentUser.name}.`);
  } catch (_error) {
    authToken = "";
    currentUser = null;
    localStorage.removeItem(TOKEN_KEY);
    updateAuthBadge();
    setAuthMessage("Session expired. Please login again.", true);
  }
}

async function registerUser() {
  const payload = {
    name: authName.value.trim(),
    email: authEmail.value.trim(),
    password: authPassword.value
  };

  if (!payload.name || !payload.email || !payload.password) {
    setAuthMessage("Fill name, email, and password to register.", true);
    return;
  }

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Registration failed");
    }

    currentUser = null;
    authToken = "";
    localStorage.removeItem(TOKEN_KEY);
    updateAuthBadge();
    const demoCodeText = data.demoVerificationCode
      ? ` Demo code: ${data.demoVerificationCode}`
      : "";
    setAuthMessage(`${data.message || "Registration successful."}${demoCodeText}`);
    authPassword.value = "";
    await loadHistory();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function loginUser() {
  const payload = {
    email: authEmail.value.trim(),
    password: authPassword.value
  };

  if (!payload.email || !payload.password) {
    setAuthMessage("Enter email and password to login.", true);
    return;
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem(TOKEN_KEY, authToken);
    updateAuthBadge();
    setAuthMessage("Login successful. History sync is active.");
    authPassword.value = "";
    await loadHistory();
  } catch (error) {
    if (error.message.includes("Email not verified")) {
      setAuthMessage("Email not verified. Click Send Verify Code and then Verify Email.", true);
      return;
    }

    setAuthMessage(error.message, true);
  }
}

async function requestVerificationCode() {
  const email = authEmail.value.trim();
  if (!email) {
    setAuthMessage("Enter email to request verification code.", true);
    return;
  }

  try {
    const response = await fetch("/api/auth/request-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not request verification code");
    }

    const demoCodeText = data.demoVerificationCode ? ` Demo code: ${data.demoVerificationCode}` : "";
    setAuthMessage(`${data.message || "Verification code sent."}${demoCodeText}`);
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function verifyEmail() {
  const email = authEmail.value.trim();
  const code = authCode.value.trim();

  if (!email || !code) {
    setAuthMessage("Enter email and verification code.", true);
    return;
  }

  try {
    const response = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Email verification failed");
    }

    setAuthMessage(data.message || "Email verified. You can login now.");
    authCode.value = "";
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function forgotPassword() {
  const email = authEmail.value.trim();
  if (!email) {
    setAuthMessage("Enter email to request a reset code.", true);
    return;
  }

  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not start password reset");
    }

    const demoCodeText = data.demoResetCode ? ` Demo code: ${data.demoResetCode}` : "";
    setAuthMessage(`${data.message || "Reset code sent."}${demoCodeText}`);
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function resetPassword() {
  const email = authEmail.value.trim();
  const code = authCode.value.trim();
  const newPassword = authNewPassword.value;

  if (!email || !code || !newPassword) {
    setAuthMessage("Enter email, reset code, and new password.", true);
    return;
  }

  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Password reset failed");
    }

    setAuthMessage(data.message || "Password reset successful. Login with new password.");
    authCode.value = "";
    authNewPassword.value = "";
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

function logoutUser() {
  authToken = "";
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
  updateAuthBadge();
  setAuthMessage("Signed out successfully.");
  historyList.innerHTML = '<p class="history-empty">No history yet. Generate content while logged in.</p>';
}

async function loadHistory() {
  if (!authToken) {
    historyList.innerHTML = '<p class="history-empty">Login to load your prompt history.</p>';
    return;
  }

  try {
    const response = await fetch("/api/history", {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load history");
    }

    updateHistoryUI(data.items || []);
  } catch (_error) {
    historyList.innerHTML = '<p class="history-empty">Could not load history.</p>';
  }
}

async function saveHistory(prompt, output) {
  if (!authToken || !prompt || !output) {
    return;
  }

  try {
    await fetch("/api/history", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ prompt, output })
    });
  } catch (_error) {
    // Ignore save failures and keep generation UX uninterrupted.
  }
}

async function deleteHistoryItem(id) {
  if (!authToken || !id) {
    return;
  }

  await fetch(`/api/history/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });
}

async function generateText() {
  const prompt = userPrompt.value.trim();
  if (!prompt) {
    outputBox.textContent = "Enter a prompt before generating text.";
    updateWordCount("");
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  outputBox.textContent = "Thinking...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error("Generation request failed");
    }

    const payload = await response.json();
    outputBox.textContent = payload.output;
    updateWordCount(payload.output || "");
    await saveHistory(prompt, payload.output || "");
    await loadHistory();
  } catch (error) {
    outputBox.textContent = "Could not generate text. Verify backend is running and try again.";
    updateWordCount("");
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate With AI";
  }
}

function revealOnLoad() {
  const sections = document.querySelectorAll(".reveal");
  sections.forEach((section, i) => {
    setTimeout(() => {
      section.classList.add("visible");
    }, i * 120);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  revealOnLoad();
  checkBackendConnectivity();
  updateWordCount("");
  loadMe().then(() => loadHistory());
  generateBtn.addEventListener("click", generateText);
  registerBtn.addEventListener("click", registerUser);
  loginBtn.addEventListener("click", loginUser);
  logoutBtn.addEventListener("click", logoutUser);
  requestVerifyBtn.addEventListener("click", requestVerificationCode);
  verifyEmailBtn.addEventListener("click", verifyEmail);
  forgotPasswordBtn.addEventListener("click", forgotPassword);
  resetPasswordBtn.addEventListener("click", resetPassword);
  refreshHistoryBtn.addEventListener("click", loadHistory);
});
