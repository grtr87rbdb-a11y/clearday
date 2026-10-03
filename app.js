const KEY = "clearday.tasks.v05";

const $ = (selector) => document.querySelector(selector);

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function tomorrowKey() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return todayKey(date);
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
  return text.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function analyze(text) {
  const value = text.toLowerCase();

  let score = 0;
  let label = "Обычная";

  if (/срочно|важно|дедлайн|оплата|клиент|экзамен|встреч/.test(value)) {
    score += 5;
  }

  if (/сегодня|до \d|до [0-2]?\d[:.]/.test(value)) {
    score += 4;
  }

  if (/завтра/.test(value)) {
    score += 2;
  }

  if (/потом|когда-нибудь|позже/.test(value)) {
    score -= 2;
  }

  if (score >= 6) label = "Главное";
  else if (score >= 4) label = "Сегодня";
  else if (score >= 2) label = "Скоро";
  else if (score < 0) label = "На потом";

  return { score, label };
}

function createTask(text) {
  const analysis = analyze(text);

  return {
    id: crypto.randomUUID(),
    text,
    done: false,
    createdAt: new Date().toISOString(),
    day: todayKey(),
    score: analysis.score,
    label: analysis.label
  };
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

      <button class="edit" data-edit="${task.id}">✎</button>
      <button class="delete" data-delete="${task.id}">×</button>
    </div>
  `;
}

function prepareTasks() {
  const tasks = load();
  const today = todayKey();

  let changed = false;

  tasks.forEach((task) => {
    if (!task.day) {
      task.day = today;
      changed = true;
    }

    const analysis = analyze(task.text);

    if (
      task.score !== analysis.score ||
      task.label !== analysis.label
    ) {
      task.score = analysis.score;
      task.label = analysis.label;
      changed = true;
    }

    if (!task.done && task.day < today) {
      task.day = today;
      task.moved = true;
      changed = true;
    }
  });

  if (changed) save(tasks);

  return tasks;
}

function render() {
  const tasks = prepareTasks();
  const today = todayKey();

  const active = tasks.filter(
    (task) => !task.done && task.day === today
  );

  const completed = tasks.filter(
    (task) => task.done && task.day === today
  );

  const focus = [...active]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const later = [...active]
    .sort((a, b) => a.score - b.score)
    .slice(3);

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
    : "Сегодня всё спокойно. Добавь новую задачу.";

  $("#allList").innerHTML = active.length
    ? active.map(taskHTML).join("")
    : "Задач на сегодня нет.";

  const laterText = later.length
    ? `${later.length} задач осталось после Top-3.`
    : "После Top-3 ничего лишнего.";

  const evening = $("#eveningText");

  if (evening) {
    evening.textContent =
      completed.length
        ? `Сегодня выполнено: ${completed.length}. ${laterText}`
        : laterText;
  }

  bindButtons();
}

function bindButtons() {
  document.querySelectorAll("[data-id]").forEach((button) => {
    button.onclick = () => toggle(button.dataset.id);
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.onclick = () => remove(button.dataset.delete);
  });

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.onclick = () => editTask(button.dataset.edit);
  });
}

function add() {
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

function toggle(id) {
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

function remove(id) {
  const tasks = load().filter((task) => task.id !== id);

  save(tasks);
  render();
}

function editTask(id) {
  const tasks = load();
  const task = tasks.find((item) => item.id === id);

  if (!task) return;

  const text = prompt("Изменить задачу:", task.text);

  if (text === null || !text.trim()) return;

  task.text = text.trim();

  const analysis = analyze(task.text);
  task.score = analysis.score;
  task.label = analysis.label;

  save(tasks);
  render();
}

$("#addBtn").onclick = add;

$("#taskInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") add();
});

document.querySelectorAll(".chips button").forEach((button) => {
  button.onclick = () => {
    $("#taskInput").value = button.dataset.example;
    add();
  };
});

$("#resetBtn").onclick = () => {
  if (confirm("Удалить все задачи?")) {
    localStorage.removeItem(KEY);
    render();
  }
};

$("#finishDayBtn").onclick = () => {
  const tasks = load();
  const today = todayKey();

  const remaining = tasks.filter(
    (task) => !task.done && task.day === today
  ).length;

  $("#eveningText").textContent = remaining
    ? `Осталось ${remaining}. Не обязательно закончить всё сегодня.`
    : "День закрыт. Все задачи выполнены.";
};

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

render();