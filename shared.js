window.SKWRITLY = {
  TOKEN_KEY: "sk_writly_token",
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || "";
  },
  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },
  getAuthHeaders() {
    const token = this.getToken();
    return token
      ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
  }
};

async function updateHealthChip() {
  const chips = document.querySelectorAll("[data-health]");
  if (!chips.length) {
    return;
  }

  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error("Health check failed");
    }

    chips.forEach((chip) => {
      chip.textContent = "Backend Connected";
      chip.classList.remove("health-off");
      chip.classList.add("health-ok");
    });
  } catch (_error) {
    chips.forEach((chip) => {
      chip.textContent = "Backend Offline";
      chip.classList.remove("health-ok");
      chip.classList.add("health-off");
    });
  }
}

function updateFooterYear() {
  const yearNode = document.getElementById("footerYear");
  if (yearNode) {
    yearNode.textContent = `Year ${new Date().getFullYear()}`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  updateHealthChip();
  updateFooterYear();
});
