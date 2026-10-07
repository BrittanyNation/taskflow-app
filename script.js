// Taskflow — kanban task manager with localStorage persistence

const STORAGE_KEY = 'taskflow.tasks.v1';

const state = {
  tasks: loadTasks(),
  editingId: null,
  search: '',
  priorityFilter: 'all',
};

// ---------- Persistence ----------
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted storage — start fresh */ }
  // Seed with sample tasks on first run
  return [
    { id: uid(), title: 'Design the new landing page', desc: 'Hero, features, and pricing sections', priority: 'high', status: 'todo', created: Date.now() },
    { id: uid(), title: 'Review pull requests', desc: 'Three PRs waiting in the frontend repo', priority: 'medium', status: 'doing', created: Date.now() },
    { id: uid(), title: 'Update dependencies', desc: '', priority: 'low', status: 'todo', created: Date.now() },
    { id: uid(), title: 'Ship v2.1', desc: 'Deployed to production on Friday', priority: 'high', status: 'done', created: Date.now() - 86400000 },
  ];
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function uid() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Rendering ----------
const lists = {
  todo: document.getElementById('list-todo'),
  doing: document.getElementById('list-doing'),
  done: document.getElementById('list-done'),
};
const template = document.getElementById('taskTemplate');
const statsBar = document.getElementById('statsBar');

function visibleTasks() {
  const q = state.search.trim().toLowerCase();
  return state.tasks.filter(t => {
    const matchQ = !q || t.title.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q);
    const matchP = state.priorityFilter === 'all' || t.priority === state.priorityFilter;
    return matchQ && matchP;
  });
}

function render() {
  const visible = visibleTasks();
  const byStatus = { todo: [], doing: [], done: [] };
  visible.forEach(t => byStatus[t.status].push(t));

  Object.keys(lists).forEach(status => {
    const list = lists[status];
    list.innerHTML = '';
    document.getElementById('count-' + status).textContent = byStatus[status].length;

    if (byStatus[status].length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = status === 'done' ? 'Nothing done yet — you got this.' : 'Drop tasks here';
      list.appendChild(empty);
      return;
    }

    // Sort: high priority first, then newest
    const order = { high: 0, medium: 1, low: 2 };
    byStatus[status].sort((a, b) => order[a.priority] - order[b.priority] || b.created - a.created);

    byStatus[status].forEach(task => {
      const card = template.content.cloneNode(true).firstElementChild;
      card.dataset.id = task.id;
      card.dataset.priority = task.priority;
      card.querySelector('.priority').textContent = task.priority;
      card.querySelector('.task-title').textContent = task.title;
      card.querySelector('.task-desc').textContent = task.desc || '';
      card.querySelector('.task-date').textContent = new Date(task.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      card.querySelector('.edit-btn').addEventListener('click', (e) => { e.stopPropagation(); openModal(task.id); });
      card.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); });

      // Drag events
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.id);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));

      // Keyboard: arrow keys move between columns
      card.addEventListener('keydown', (e) => {
        const flow = ['todo', 'doing', 'done'];
        const idx = flow.indexOf(task.status);
        if (e.key === 'ArrowRight' && idx < 2) { moveTask(task.id, flow[idx + 1]); e.preventDefault(); }
        if (e.key === 'ArrowLeft' && idx > 0) { moveTask(task.id, flow[idx - 1]); e.preventDefault(); }
      });

      list.appendChild(card);
    });
  });

  renderStats();
}

function renderStats() {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.status === 'done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  statsBar.innerHTML = `<span><strong>${total}</strong> total</span><span><strong>${done}</strong> done</span><span><strong>${pct}%</strong> complete</span>`;
}

// ---------- CRUD ----------
function addTask(data) {
  state.tasks.push({ id: uid(), created: Date.now(), ...data });
  saveTasks(); render();
}

function updateTask(id, data) {
  const task = state.tasks.find(t => t.id === id);
  if (task) Object.assign(task, data);
  saveTasks(); render();
}

function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveTasks(); render();
}

function moveTask(id, newStatus) {
  const task = state.tasks.find(t => t.id === id);
  if (task && task.status !== newStatus) {
    task.status = newStatus;
    saveTasks(); render();
  }
}

// ---------- Drag & drop columns ----------
document.querySelectorAll('.task-list').forEach(list => {
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    list.classList.add('drag-over');
  });
  list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
  list.addEventListener('drop', (e) => {
    e.preventDefault();
    list.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    const column = list.closest('.column');
    if (column) moveTask(id, column.dataset.status);
  });
});

// ---------- Modal ----------
const backdrop = document.getElementById('modalBackdrop');
const form = document.getElementById('taskForm');
const modalTitle = document.getElementById('modalTitle');

function openModal(editId = null) {
  state.editingId = editId;
  modalTitle.textContent = editId ? 'Edit task' : 'New task';
  if (editId) {
    const t = state.tasks.find(x => x.id === editId);
    document.getElementById('taskTitle').value = t.title;
    document.getElementById('taskDesc').value = t.desc || '';
    document.getElementById('taskPriority').value = t.priority;
    document.getElementById('taskStatus').value = t.status;
  } else {
    form.reset();
  }
  backdrop.hidden = false;
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  backdrop.hidden = true;
  state.editingId = null;
}

document.getElementById('addTaskBtn').addEventListener('click', () => openModal());
document.getElementById('cancelBtn').addEventListener('click', closeModal);
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !backdrop.hidden) closeModal(); });

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    title: document.getElementById('taskTitle').value.trim(),
    desc: document.getElementById('taskDesc').value.trim(),
    priority: document.getElementById('taskPriority').value,
    status: document.getElementById('taskStatus').value,
  };
  if (!data.title) return;
  if (state.editingId) updateTask(state.editingId, data);
  else addTask(data);
  closeModal();
});

// ---------- Search & filter ----------
document.getElementById('searchInput').addEventListener('input', (e) => {
  state.search = e.target.value;
  render();
});
document.getElementById('filterPriority').addEventListener('change', (e) => {
  state.priorityFilter = e.target.value;
  render();
});

// ---------- Init ----------
render();
