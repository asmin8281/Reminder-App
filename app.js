// Simple daily reminder app using localStorage
// Each reminder: { id, title, type, datetime, notes, createdAt, status }

const STORAGE_KEY = "daily-reminder-items-v1";

const clockEl = document.getElementById("clock");
const clockDateEl = document.getElementById("clock-date");
const formEl = document.getElementById("reminder-form");
const formErrorEl = document.getElementById("form-error");
const activeListEl = document.getElementById("active-list");
const historyListEl = document.getElementById("history-list");
const activeCountEl = document.getElementById("active-count");
const historyFilterEl = document.getElementById("history-filter");

let reminders = [];

function formatDateTime(date) {
  const opts = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  return new Intl.DateTimeFormat(undefined, opts).format(date);
}

function formatClock(date) {
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return { timeStr, dateStr };
}

function startClock() {
  function tick() {
    const now = new Date();
    const { timeStr, dateStr } = formatClock(now);
    if (clockEl) clockEl.textContent = timeStr;
    if (clockDateEl) clockDateEl.textContent = dateStr;
  }
  tick();
  setInterval(tick, 1000);
}

function loadReminders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => ({
      ...r,
      // Ensure older data still has all fields
      status: r.status || "upcoming",
    }));
  } catch (e) {
    console.error("Failed to load reminders", e);
    return [];
  }
}

function saveReminders() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  } catch (e) {
    console.error("Failed to save reminders", e);
  }
}

function createReminder({ title, type, datetime, notes }) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const createdAt = new Date().toISOString();
  return {
    id,
    title: title.trim(),
    type,
    datetime,
    notes: (notes || "").trim(),
    createdAt,
    status: "upcoming",
    alertedAt: null,
  };
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.0);
    osc.start();
    osc.stop(ctx.currentTime + 1.0);
  } catch (e) {
    console.error("Beep failed", e);
  }
}

function showReminderNotification(reminder) {
  const message = `${reminder.title}${
    reminder.type ? " (" + reminder.type + ")" : ""
  }`;

  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Reminder time!", {
        body: message,
      });
      return;
    }
  }

  // Fallback
  alert("Reminder time:\n" + message);
}

function triggerAlarm(reminder) {
  playBeep();
  showReminderNotification(reminder);
}

function updateStatuses() {
  const now = new Date();
  let changed = false;
  reminders.forEach((r) => {
    if (r.status === "upcoming" && r.datetime) {
      const dt = new Date(r.datetime);
      if (dt <= now && !r.alertedAt) {
        r.status = "missed";
        r.alertedAt = new Date().toISOString();
        triggerAlarm(r);
        changed = true;
      }
    }
  });
  if (changed) {
    saveReminders();
  }
}

function markReminderDone(id) {
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return;
  reminders[idx].status = "completed";
  saveReminders();
  renderAll();
}

function deleteReminder(id) {
  reminders = reminders.filter((r) => r.id !== id);
  saveReminders();
  renderAll();
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function emptyList(el, message) {
  el.classList.add("empty-state");
  el.textContent = message;
}

function renderActiveReminders() {
  clearElement(activeListEl);

  const upcoming = reminders
    .filter((r) => r.status === "upcoming")
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  activeCountEl.textContent = upcoming.length.toString();

  if (upcoming.length === 0) {
    emptyList(activeListEl, "No upcoming reminders. Enjoy your free time!");
    return;
  }

  activeListEl.classList.remove("empty-state");

  upcoming.forEach((r) => {
    const dt = r.datetime ? new Date(r.datetime) : null;

    const item = document.createElement("div");
    item.className = "reminder-item";

    const main = document.createElement("div");
    main.className = "reminder-main";

    const titleRow = document.createElement("div");
    titleRow.className = "reminder-title-row";

    const title = document.createElement("div");
    title.className = "reminder-title";
    title.textContent = r.title;

    const typePill = document.createElement("span");
    typePill.className =
      "pill " +
      (r.type
        ? "type-" + r.type.toLowerCase()
        : "");
    typePill.textContent = r.type || "Other";

    const statusPill = document.createElement("span");
    statusPill.className = "pill status-upcoming";
    statusPill.textContent = "Upcoming";

    titleRow.appendChild(title);
    titleRow.appendChild(typePill);
    titleRow.appendChild(statusPill);

    const meta = document.createElement("div");
    meta.className = "reminder-meta";
    meta.textContent = dt
      ? `Scheduled: ${formatDateTime(dt)}`
      : "No date set";

    main.appendChild(titleRow);
    main.appendChild(meta);

    if (r.notes) {
      const notes = document.createElement("div");
      notes.className = "reminder-notes";
      notes.textContent = r.notes;
      main.appendChild(notes);
    }

    const actions = document.createElement("div");
    actions.className = "reminder-actions";

    const timeEl = document.createElement("div");
    timeEl.className = "reminder-time";
    timeEl.textContent = dt ? formatDateTime(dt) : "";

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "btn primary";
    doneBtn.textContent = "Mark as done";
    doneBtn.addEventListener("click", () => markReminderDone(r.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn outline";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteReminder(r.id));

    actions.appendChild(timeEl);
    actions.appendChild(doneBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(main);
    item.appendChild(actions);
    activeListEl.appendChild(item);
  });
}

function renderHistoryReminders() {
  clearElement(historyListEl);

  const filter = historyFilterEl.value || "all";

  let list = reminders.slice().sort((a, b) => {
    const da = new Date(a.datetime || a.createdAt || 0);
    const db = new Date(b.datetime || b.createdAt || 0);
    return db - da;
  });

  if (filter !== "all") {
    list = list.filter((r) => r.status === filter);
  }

  if (list.length === 0) {
    emptyList(
      historyListEl,
      "No reminders in history yet. Add some above to get started."
    );
    return;
  }

  historyListEl.classList.remove("empty-state");

  list.forEach((r) => {
    const dt = r.datetime ? new Date(r.datetime) : null;
    const created = r.createdAt ? new Date(r.createdAt) : null;

    const item = document.createElement("div");
    item.className = "reminder-item";

    const main = document.createElement("div");
    main.className = "reminder-main";

    const titleRow = document.createElement("div");
    titleRow.className = "reminder-title-row";

    const title = document.createElement("div");
    title.className = "reminder-title";
    title.textContent = r.title;

    const typePill = document.createElement("span");
    typePill.className =
      "pill " +
      (r.type
        ? "type-" + r.type.toLowerCase()
        : "");
    typePill.textContent = r.type || "Other";

    const statusPill = document.createElement("span");
    statusPill.className = "pill status-" + (r.status || "upcoming");
    statusPill.textContent =
      r.status === "completed"
        ? "Completed"
        : r.status === "missed"
        ? "Missed"
        : "Upcoming";

    titleRow.appendChild(title);
    titleRow.appendChild(typePill);
    titleRow.appendChild(statusPill);

    const meta = document.createElement("div");
    meta.className = "reminder-meta";
    const parts = [];
    if (dt) parts.push(`When: ${formatDateTime(dt)}`);
    if (created) parts.push(`Created: ${formatDateTime(created)}`);
    meta.textContent = parts.join(" • ");

    main.appendChild(titleRow);
    main.appendChild(meta);

    if (r.notes) {
      const notes = document.createElement("div");
      notes.className = "reminder-notes";
      notes.textContent = r.notes;
      main.appendChild(notes);
    }

    const actions = document.createElement("div");
    actions.className = "reminder-actions";

    const statusTime = document.createElement("div");
    statusTime.className = "reminder-time";
    if (r.status === "completed") {
      statusTime.textContent = "Status: completed ✅";
    } else if (r.status === "missed") {
      statusTime.textContent = "Status: missed ⏰";
    } else {
      statusTime.textContent = "Status: upcoming";
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn outline";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteReminder(r.id));

    actions.appendChild(statusTime);
    actions.appendChild(deleteBtn);

    item.appendChild(main);
    item.appendChild(actions);
    historyListEl.appendChild(item);
  });
}

function renderAll() {
  updateStatuses();
  renderActiveReminders();
  renderHistoryReminders();
}

function handleFormSubmit(event) {
  event.preventDefault();
  formErrorEl.textContent = "";

  const title = formEl.title.value;
  const type = formEl.type.value;
  const dateVal = formEl.date.value;
  const timeVal = formEl.time.value;
  const meridiem = formEl.meridiem.value || "AM";
  const notes = formEl.notes.value;

  if (!title.trim()) {
    formErrorEl.textContent = "Title is required.";
    return;
  }
  if (!dateVal || !timeVal) {
    formErrorEl.textContent = "Please choose both a date and a time.";
    return;
  }

  // Convert 12-hour time + AM/PM to 24-hour time
  const [rawHours, rawMinutes] = timeVal.split(":");
  let hoursNum = Number.parseInt(rawHours, 10);
  const minutes = Number.parseInt(rawMinutes ?? "0", 10);

  if (Number.isNaN(hoursNum) || Number.isNaN(minutes)) {
    formErrorEl.textContent = "Invalid time.";
    return;
  }

  if (meridiem === "PM" && hoursNum < 12) {
    hoursNum += 12;
  }
  if (meridiem === "AM" && hoursNum === 12) {
    hoursNum = 0;
  }

  const hoursStr = String(hoursNum).padStart(2, "0");
  const minutesStr = String(minutes).padStart(2, "0");

  const datetime = `${dateVal}T${hoursStr}:${minutesStr}:00`;
  const when = new Date(datetime);
  if (Number.isNaN(when.getTime())) {
    formErrorEl.textContent = "Invalid date and time.";
    return;
  }

  const now = new Date();
  if (when.getTime() < now.getTime() - 60_000) {
    formErrorEl.textContent =
      "Date/time is in the past. You can still add it, but it will be marked missed.";
  }

  const reminder = createReminder({ title, type, datetime, notes });
  reminders.push(reminder);
  saveReminders();
  renderAll();

  formEl.reset();
}

function init() {
  startClock();
  reminders = loadReminders();
  renderAll();

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  formEl.addEventListener("submit", handleFormSubmit);
  historyFilterEl.addEventListener("change", () => renderHistoryReminders());

  // Re-check statuses frequently so alarms fire close to on time
  setInterval(() => {
    const before = JSON.stringify(reminders);
    updateStatuses();
    if (before !== JSON.stringify(reminders)) {
      renderAll();
    }
  }, 5000);
}

document.addEventListener("DOMContentLoaded", init);




