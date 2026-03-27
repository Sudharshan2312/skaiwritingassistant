const promptInput = document.getElementById("promptInput");
const toneSelect = document.getElementById("toneSelect");
const lengthSelect = document.getElementById("lengthSelect");
const generateBtn = document.getElementById("generateBtn");
const outputBox = document.getElementById("outputBox");
const providerBadge = document.getElementById("providerBadge");
const wordCount = document.getElementById("wordCount");

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function saveHistory(prompt, output) {
  const token = window.SKWRITLY.getToken();
  if (!token) {
    return;
  }

  await fetch("/api/history", {
    method: "POST",
    headers: window.SKWRITLY.getAuthHeaders(),
    body: JSON.stringify({ prompt, output })
  });
}

async function generate() {
  const basePrompt = promptInput.value.trim();
  if (!basePrompt) {
    outputBox.textContent = "Enter a prompt first.";
    return;
  }

  const prompt = `${basePrompt}\nTone: ${toneSelect.value}\nLength: ${lengthSelect.value}`;
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  outputBox.textContent = "Thinking...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Generation failed");
    }

    outputBox.textContent = data.output;
    providerBadge.textContent = `Provider: ${data.provider}`;
    wordCount.textContent = `Words: ${countWords(data.output || "")}`;
    await saveHistory(prompt, data.output || "");
  } catch (error) {
    outputBox.textContent = error.message;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  generateBtn.addEventListener("click", generate);
});
