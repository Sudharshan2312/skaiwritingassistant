const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
const historyStatus = document.getElementById("historyStatus");
const historyList = document.getElementById("historyList");

function setStatus(message) {
  historyStatus.textContent = message;
}

function renderHistory(items) {
  if (!items.length) {
    historyList.innerHTML = '<p class="status-text">No history entries yet.</p>';
    return;
  }

  historyList.innerHTML = items
    .map((item) => {
      const date = new Date(item.createdAt).toLocaleString();
      return `
        <article class="history-item" data-id="${item.id}">
          <p class="history-date">${date}</p>
          <p><strong>Prompt:</strong> ${item.prompt}</p>
          <p><strong>Output:</strong> ${item.output}</p>
          <button class="btn btn-ghost delete-item" data-id="${item.id}">Delete</button>
        </article>
      `;
    })
    .join("");

  historyList.querySelectorAll(".delete-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await deleteHistory(id);
      await loadHistory();
    });
  });
}

async function loadHistory() {
  const token = window.SKWRITLY.getToken();
  if (!token) {
    setStatus("Login in Account module to view history.");
    historyList.innerHTML = "";
    return;
  }

  try {
    const response = await fetch("/api/history", {
      headers: window.SKWRITLY.getAuthHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to load history");
    }

    setStatus(`Loaded ${data.items.length} history item(s).`);
    renderHistory(data.items);
  } catch (error) {
    setStatus(error.message);
  }
}

async function deleteHistory(id) {
  await fetch(`/api/history/${id}`, {
    method: "DELETE",
    headers: window.SKWRITLY.getAuthHeaders()
  });
}

window.addEventListener("DOMContentLoaded", () => {
  refreshHistoryBtn.addEventListener("click", loadHistory);
  loadHistory();
});
