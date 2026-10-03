const KEY = "clearday.tasks.v06";

const $ = (selector) => document.querySelector(selector);

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(tasks) {
  localStorage.setItem(KEY, JSON.stringify(tasks));
}

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function analyze(text) {
  const value = text.toLowerCase();
  let score = 1;
  let label = "Обычная";

  if (/срочно|важно|дедлайн|оплата|клиент|экзамен|встреч/.test(value)) {
    score += 5;
  }

  if (/сегодня|сейчас|до \d|до [0-2]?\d[:.]/.test(value)) {
    score += 4;
  }

  if (/завтра/.test(value)) {
    score += 2;
  }

  if (/потом|позже|когда-нибудь|если будет время/.test(value)) {
    score -= 2;
  }

  if (score >= 6) label = "Главное";
  else if (score >= 4) label = "Сегодня";
  else if (score >= 2) label = "Скоро";
  else label = "На потом";

  return { score, label };
}

function detectDay(text) {
  const value = text.toLowerCase();

  if (/завтра/.test(value)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dateKey(tomorrow);
  }

  return dateKey();
}

function createTask(text) {
  const analysis = analyze(text);

  return {
    id: crypto.randomUUID(),
    text,
    done: false,
    createdAt: new Date().toISOString(),
    day: detectDay(text),
    score: analysis.score,
    label: analysis.label
  };
}

function prepareTasks() {
  const tasks = load();
  const today = dateKey();
  let changed = false;

  tasks.forEach((task) => {
    const analysis = analyze(task.text);

    if (task.score !== analysis.score || task.label !== analysis.label) {
      task.score = analysis.score;
      task.label = analysis.label;
      changed = true;
    }

    if (!task.day) {
      task.day = today;
      changed = true;
    }

    // Незавершённые старые задачи возвращаем в сегодняшний список.
    if (!task.done && task.day < today) {
      task.day = today;
      task.moved = true;
      changed = true;
    }
  });

  if (changed) save(tasks);

  return tasks;
}

function taskHTML(task) {
  return `
    <div class="task ${task.done ? "done" : ""}">
      <button class="check" data-id="${task.id}">
        ${task.done ? "✓" : ""}
      </button>

      <div class="taskBody">
        <div class="text">${escapeHTML(task.text)}</div>
        <span class="meta">${task.label}</span>
      </div>

      <button class="edit" data-edit="${task.id}" title="Изменить">
        ✎
      </button>

      <button class="delete" data-delete="${task.id}" title="Удалить">
        ×
      </button>
    </div>
  `;
}

function render() {
  const tasks = prepareTasks();
  const today = dateKey();

  const todayTasks = tasks.filter(
    (task) => task.day === today
  );

  const active = todayTasks.filter(
    (task) => !task.done
  );

  const completed = todayTasks.filter(
    (task) => task.done
  );

  const focus = [...active]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const remaining = [...active]
    .sort((a, b) => b.score - a.score)
    .slice(3);

  const total = todayTasks.length;
  const done = completed.length;
  const percent = total
    ? Math.round((done / total) * 100)
    : 0;

  $("#todayLabel").textContent =
    new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(new Date());

  $("#focusCount").textContent = `${focus.length}/3`;
  $("#allCount").textContent = active.length;

  $("#focusList").innerHTML = focus.length
    ? focus.map(taskHTML).join("")
    : `
      <div class="emptyState">
        ${total
          ? "Главные задачи выполнены. Отличная работа."
          : "Добавь несколько задач — ClearDay выберет главное."
        }
      </div>
    `;

  $("#allList").innerHTML = remaining.length
    ? remaining.map(taskHTML).join("")
    : `
      <div class="emptyState">
        ${active.length
          ? "Все активные задачи уже в Top-3."
          : "На сегодня больше задач нет."
        }
      </div>
    `;

  $("#progressPercent").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;

  $("#progressText").textContent =
    `Выполнено ${done} из ${total} задач.`;

  if (done === total && total > 0) {
    $("#eveningText").textContent =
      "Все задачи выполнены. День можно спокойно закрыть.";
  } else if (done > 0) {
    $("#eveningText").textContent =
      `Сегодня выполнено ${done}. Осталось ${active.length}.`;
  } else {
    $("#eveningText").textContent =
      "Выбери главное и двигайся по одной задаче за раз.";
  }

  bindButtons();
}

function bindButtons() {
  document.querySelectorAll("[data-id]").forEach((button) => {
    button.onclick = () => toggleTask(button.dataset.id);
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.onclick = () => deleteTask(button.dataset.delete);
  });

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.onclick = () => editTask(button.dataset.edit);
  });
}

function addTask() {
  const input = $("#taskInput");
  const text = input.value.trim();

  if (!text) return;

  const tasks = load();

  tasks.unshift(createTask(text));

  save(tasks);

  input.value = "";

  render();

  input.focus();
}

function toggleTask(id) {
  const tasks = load();
  const task = tasks.find((item) => item.id === id);

  if (!task) return;

  task.done = !task.done;

  if (task.done) {
    task.completedAt = new Date().toISOString();
  } else {
    delete task.completedAt;
  }

  save(tasks);
  render();
}

function deleteTask(id) {
  const tasks = load().filter(
    (task) => task.id !== id
  );

  save(tasks);
  render();
}

function editTask(id) {
  const tasks = load();
  const task = tasks.find((item) => item.id === id);

  if (!task) return;

  const newText = prompt(
    "Изменить задачу:",
    task.text
  );

  if (newText === null) return;

  const text = newText.trim();

  if (!text) return;

  task.text = text;
  task.day = detectDay(text);

  const analysis = analyze(text);

  task.score = analysis.score;
  task.label = analysis.label;

  save(tasks);
  render();
}

$("#addBtn").addEventListener("click", addTask);

$("#taskInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addTask();
  }
});

document.querySelectorAll(".chips button").forEach((button) => {
  button.addEventListener("click", () => {
    $("#taskInput").value = button.dataset.example;
    addTask();
  });
});

$("#resetBtn").addEventListener("click", () => {
  if (!confirm("Удалить все задачи?")) return;

  localStorage.removeItem(KEY);
  render();
});

$("#finishDayBtn").addEventListener("click", () => {
  const tasks = prepareTasks();
  const today = dateKey();

  const remaining = tasks.filter(
    (task) => task.day === today && !task.done
  );

  if (!remaining.length) {
    $("#eveningText").textContent =
      "День завершён. Всё сделано. Отличная работа.";
    return;
  }

  $("#eveningText").textContent =
    `Осталось ${remaining.length}. Незавершённые задачи останутся на следующий день.`;
});

const hour = new Date().getHours();

if (hour < 12) {
  $("#greeting").textContent =
    "Доброе утро. Выберем главное.";
} else if (hour < 18) {
  $("#greeting").textContent =
    "Сосредоточимся на главном.";
} else {
  $("#greeting").textContent =
    "Спокойно закроем сегодняшний день.";
}

render();// ClearDay 0.7 — уведомления
async function enableNotifications() {
  if (!("Notification" in window)) {
    alert("Этот браузер не поддерживает уведомления.");
    return;
  }

  if (Notification.permission === "granted") {
    new Notification("ClearDay", {
      body: "Уведомления уже включены."
    });
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    new Notification("ClearDay", {
      body: "Готово. ClearDay сможет показывать напоминания."
    });
  }
}

window.enableNotifications = enableNotifications;