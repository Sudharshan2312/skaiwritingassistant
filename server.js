const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const DB_PATH = path.join(__dirname, "data", "store.json");

let storeWriteQueue = Promise.resolve();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname)));

async function ensureStore() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch (_error) {
    const seed = {
      users: [],
      histories: []
    };
    await fs.writeFile(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
  }
}

async function readStore() {
  await ensureStore();
  const text = await fs.readFile(DB_PATH, "utf-8");
  const parsed = JSON.parse(text);
  parsed.users = Array.isArray(parsed.users) ? parsed.users : [];
  parsed.histories = Array.isArray(parsed.histories) ? parsed.histories : [];

  // Keep older records compatible with new auth fields.
  parsed.users = parsed.users.map((user) => ({
    ...user,
    emailVerified: typeof user.emailVerified === "boolean" ? user.emailVerified : true,
    verificationCodeHash: user.verificationCodeHash || null,
    verificationCodeExpiresAt: user.verificationCodeExpiresAt || null,
    resetCodeHash: user.resetCodeHash || null,
    resetCodeExpiresAt: user.resetCodeExpiresAt || null
  }));

  return parsed;
}

async function writeStore(nextData) {
  storeWriteQueue = storeWriteQueue.then(() =>
    fs.writeFile(DB_PATH, JSON.stringify(nextData, null, 2), "utf-8")
  );
  return storeWriteQueue;
}

function signAuthToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt
  };
}

function buildCodeHash(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isFutureIsoDate(value) {
  if (!value) {
    return false;
  }

  return new Date(value).getTime() > Date.now();
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authorization token is required." });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    provider: OPENAI_API_KEY ? "openai" : "local-fallback",
    authEnabled: true,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/auth/register", async (req, res) => {
  const name = (req.body?.name || "").trim();
  const email = (req.body?.email || "").trim().toLowerCase();
  const password = req.body?.password || "";

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const store = await readStore();
  const exists = store.users.some((user) => user.email === email);

  if (exists) {
    return res.status(409).json({ error: "Email already registered." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    name,
    email,
    passwordHash,
    emailVerified: false,
    verificationCodeHash: null,
    verificationCodeExpiresAt: null,
    resetCodeHash: null,
    resetCodeExpiresAt: null,
    createdAt: new Date().toISOString()
  };

  const verificationCode = generateSixDigitCode();
  user.verificationCodeHash = buildCodeHash(verificationCode);
  user.verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  store.users.push(user);
  await writeStore(store);

  return res.status(201).json({
    user: sanitizeUser(user),
    verificationRequired: true,
    demoVerificationCode: verificationCode,
    message: "Registration successful. Verify your email before login."
  });
});

app.post("/api/auth/login", async (req, res) => {
  const email = (req.body?.email || "").trim().toLowerCase();
  const password = req.body?.password || "";

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const store = await readStore();
  const user = store.users.find((item) => item.email === email);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      error: "Email not verified. Please verify before login.",
      verificationRequired: true
    });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = signAuthToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

app.post("/api/auth/request-verification", async (req, res) => {
  const email = (req.body?.email || "").trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const store = await readStore();
  const user = store.users.find((item) => item.email === email);

  if (!user) {
    return res.json({ ok: true, message: "If the account exists, a code was sent." });
  }

  if (user.emailVerified) {
    return res.json({ ok: true, message: "Email is already verified." });
  }

  const verificationCode = generateSixDigitCode();
  user.verificationCodeHash = buildCodeHash(verificationCode);
  user.verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await writeStore(store);

  return res.json({
    ok: true,
    message: "Verification code generated.",
    demoVerificationCode: verificationCode
  });
});

app.post("/api/auth/verify-email", async (req, res) => {
  const email = (req.body?.email || "").trim().toLowerCase();
  const code = (req.body?.code || "").trim();

  if (!email || !code) {
    return res.status(400).json({ error: "Email and code are required." });
  }

  const store = await readStore();
  const user = store.users.find((item) => item.email === email);

  if (!user) {
    return res.status(404).json({ error: "Account not found." });
  }

  if (user.emailVerified) {
    return res.json({ ok: true, message: "Email already verified." });
  }

  if (!isFutureIsoDate(user.verificationCodeExpiresAt)) {
    return res.status(400).json({ error: "Verification code expired. Request a new one." });
  }

  if (buildCodeHash(code) !== user.verificationCodeHash) {
    return res.status(400).json({ error: "Invalid verification code." });
  }

  user.emailVerified = true;
  user.verificationCodeHash = null;
  user.verificationCodeExpiresAt = null;
  await writeStore(store);

  return res.json({ ok: true, message: "Email verified successfully." });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = (req.body?.email || "").trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const store = await readStore();
  const user = store.users.find((item) => item.email === email);

  if (!user) {
    return res.json({ ok: true, message: "If the account exists, a reset code was sent." });
  }

  const resetCode = generateSixDigitCode();
  user.resetCodeHash = buildCodeHash(resetCode);
  user.resetCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await writeStore(store);

  return res.json({
    ok: true,
    message: "Reset code generated.",
    demoResetCode: resetCode
  });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const email = (req.body?.email || "").trim().toLowerCase();
  const code = (req.body?.code || "").trim();
  const newPassword = req.body?.newPassword || "";

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "Email, code, and new password are required." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  const store = await readStore();
  const user = store.users.find((item) => item.email === email);

  if (!user) {
    return res.status(404).json({ error: "Account not found." });
  }

  if (!isFutureIsoDate(user.resetCodeExpiresAt)) {
    return res.status(400).json({ error: "Reset code expired. Request a new one." });
  }

  if (buildCodeHash(code) !== user.resetCodeHash) {
    return res.status(400).json({ error: "Invalid reset code." });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetCodeHash = null;
  user.resetCodeExpiresAt = null;
  await writeStore(store);

  return res.json({ ok: true, message: "Password reset successful." });
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  const store = await readStore();
  const user = store.users.find((item) => item.id === req.auth.id);

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  return res.json({ user: sanitizeUser(user) });
});

function buildLocalFallback(prompt) {
  const trimmed = prompt.trim().replace(/\s+/g, " ").slice(0, 180);
  return [
    "Launch your ideas faster with SK-WRITLY.",
    "Generate polished drafts, refine tone instantly, and adapt your message for global audiences in minutes.",
    "From blogs to campaign copy, SK-WRITLY helps creators produce clear, confident writing without the blank-page delay.",
    `Focus prompt: ${trimmed}`
  ].join(" ");
}

async function generateWithOpenAI(prompt) {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a concise writing assistant. Return polished marketing copy based on the user's prompt."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 220
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No response generated.";
}

app.post("/api/generate", async (req, res) => {
  const prompt = req.body?.prompt;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  if (prompt.length > 2500) {
    return res.status(400).json({ error: "Prompt is too long (max 2500 characters)." });
  }

  try {
    const output = OPENAI_API_KEY
      ? await generateWithOpenAI(prompt)
      : buildLocalFallback(prompt);

    return res.json({
      output,
      provider: OPENAI_API_KEY ? "openai" : "local-fallback"
    });
  } catch (error) {
    console.error("Generation error:", error.message);
    return res.status(500).json({ error: "Failed to generate text." });
  }
});

app.get("/api/history", authRequired, async (req, res) => {
  const store = await readStore();
  const items = store.histories
    .filter((item) => item.userId === req.auth.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return res.json({ items });
});

app.post("/api/history", authRequired, async (req, res) => {
  const prompt = (req.body?.prompt || "").trim();
  const output = (req.body?.output || "").trim();

  if (!prompt || !output) {
    return res.status(400).json({ error: "Prompt and output are required." });
  }

  const store = await readStore();
  const item = {
    id: uuidv4(),
    userId: req.auth.id,
    prompt: prompt.slice(0, 2500),
    output: output.slice(0, 8000),
    createdAt: new Date().toISOString()
  };

  store.histories.push(item);
  await writeStore(store);
  return res.status(201).json({ item });
});

app.delete("/api/history/:id", authRequired, async (req, res) => {
  const id = req.params.id;
  const store = await readStore();
  const index = store.histories.findIndex((item) => item.id === id && item.userId === req.auth.id);

  if (index < 0) {
    return res.status(404).json({ error: "History item not found." });
  }

  store.histories.splice(index, 1);
  await writeStore(store);
  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`SK-WRITLY server running at http://localhost:${PORT}`);
});
