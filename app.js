const KEY = "clearday.tasks.v04";

const $ = (selector) => document.querySelector(selector);

const today = new Date();
const dateKey = today.toISOString().slice(0, 10);

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

function priority(task) {
  const text = task.text.toLowerCase();
  let score = 0;

  if (/срочно|важно|клиент|оплата|дедлайн|срок/.test(text)) score += 4;
  if (/сегодня|до \d|до [0-2]?\d[:.]/.test(text)) score += 3;
  if (/завтра/.test(text)) score += 2;
  if (task.createdAt.slice(0, 10) === dateKey) score += 1;

  return score;
}

function priorityLabel(task) {
  const score = priority(task);

  if (score >= 5) return "Важно";
  if (score >= 3) return "Сегодня";
  if (score >= 2) return "Скоро";
  return "";
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

function taskHTML(task) {
  const label = priorityLabel(task);

  return `
    <div class="task ${task.done ? "done" : ""}">
      <button class="check" data-id="${task.id}">
        ${task.done ? "✓" : ""}
      </button>

      <div class="text">${escapeHTML(task.text)}</div>

      ${label ? `<span class="meta">${label}</span>` : ""}

      <button class="edit" data-edit="${task.id}" title="Изменить">✎</button>

      <button class="delete" data-delete="${task.id}" title="Удалить">×</button>
    </div>
  `;
}

function render() {
  const tasks = load();

  const active = tasks.filter((task) => !task.done);

  const focus = [...active]
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, 3);

  $("#todayLabel").textContent =
    new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(today);

  $("#allCount").textContent = active.length;
  $("#focusCount").textContent = `${focus.length}/3`;

  $("#focusList").innerHTML = focus.length
    ? focus.map(taskHTML).join("")
    : "Добавь задачи — я выберу самые важные.";

  $("#allList").innerHTML = tasks.length
    ? tasks.map(taskHTML).join("")
    : "Пока задач нет.";

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

  tasks.unshift({
    id: crypto.randomUUID(),
    text,
    done: false,
    createdAt: new Date().toISOString()
  });

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

  const newText = prompt("Изменить задачу:", task.text);

  if (newText === null) return;

  const text = newText.trim();

  if (!text) return;

  task.text = text;

  save(tasks);
  render();
}

$("#addBtn").onclick = add;

$("#taskInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    add();
  }
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
  const remaining = load().filter((task) => !task.done).length;

  $("#eveningText").textContent = remaining
    ? `Осталось ${remaining} задач. Выбери главное и перенеси остальное.`
    : "Все задачи закрыты. День завершён. Хорошая работа.";
};

const hour = today.getHours();

if (hour < 12) {
  $("#greeting").textContent = "Доброе утро. Сделаем день проще.";
} else if (hour < 18) {
  $("#greeting").textContent = "Сосредоточимся на главном.";
} else {
  $("#greeting").textContent = "Спокойно закроем сегодняшний день.";
}

render();