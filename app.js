(function () {
  "use strict";

  var STORAGE_KEY = "jobApplications";
  var STATUSES = ["Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"];

  var form = document.getElementById("app-form");
  var formTitle = document.getElementById("form-title");
  var saveBtn = document.getElementById("save-btn");
  var cancelBtn = document.getElementById("cancel-btn");
  var rowsEl = document.getElementById("rows");
  var emptyEl = document.getElementById("empty");
  var summaryEl = document.getElementById("summary");

  var fields = {
    company: document.getElementById("company"),
    role: document.getElementById("role"),
    date: document.getElementById("date"),
    status: document.getElementById("status"),
    notes: document.getElementById("notes")
  };

  var apps = load();
  var editingId = null;

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
    } catch (e) {
      // Storage unavailable; the page still works for this session.
    }
  }

  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function resetForm() {
    editingId = null;
    form.reset();
    fields.date.value = today();
    formTitle.textContent = "Add application";
    saveBtn.textContent = "Add";
    cancelBtn.hidden = true;
  }

  function startEdit(app) {
    editingId = app.id;
    fields.company.value = app.company;
    fields.role.value = app.role;
    fields.date.value = app.date;
    fields.status.value = app.status;
    fields.notes.value = app.notes;
    formTitle.textContent = "Edit application";
    saveBtn.textContent = "Save";
    cancelBtn.hidden = false;
    fields.company.focus();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cell(text, className) {
    var td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function statusSelect(app) {
    var sel = document.createElement("select");
    sel.className = "status-select status-" + app.status;
    STATUSES.forEach(function (s) {
      var opt = document.createElement("option");
      opt.textContent = s;
      opt.selected = s === app.status;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
      app.status = sel.value;
      save();
      render();
    });
    return sel;
  }

  function render() {
    var sorted = apps.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });

    rowsEl.textContent = "";
    sorted.forEach(function (app) {
      var tr = document.createElement("tr");
      tr.appendChild(cell(app.company));
      tr.appendChild(cell(app.role));
      tr.appendChild(cell(app.date));

      var statusTd = document.createElement("td");
      statusTd.appendChild(statusSelect(app));
      tr.appendChild(statusTd);

      tr.appendChild(cell(app.notes, "notes"));

      var actions = document.createElement("td");
      actions.className = "row-actions";

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", function () { startEdit(app); });

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "danger";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", function () {
        if (!confirm("Delete the application to " + app.company + "?")) return;
        apps = apps.filter(function (a) { return a.id !== app.id; });
        if (editingId === app.id) resetForm();
        save();
        render();
      });

      actions.appendChild(editBtn);
      actions.appendChild(document.createTextNode(" "));
      actions.appendChild(delBtn);
      tr.appendChild(actions);

      rowsEl.appendChild(tr);
    });

    emptyEl.hidden = apps.length > 0;

    if (apps.length === 0) {
      summaryEl.textContent = "";
    } else {
      var parts = STATUSES.map(function (s) {
        var n = apps.filter(function (a) { return a.status === s; }).length;
        return n ? s + ": " + n : null;
      }).filter(Boolean);
      summaryEl.textContent = apps.length + " total  |  " + parts.join("  |  ");
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = {
      company: fields.company.value.trim(),
      role: fields.role.value.trim(),
      date: fields.date.value,
      status: fields.status.value,
      notes: fields.notes.value.trim()
    };
    if (!data.company || !data.role || !data.date) return;

    if (editingId) {
      var existing = apps.filter(function (a) { return a.id === editingId; })[0];
      if (existing) Object.assign(existing, data);
    } else {
      data.id = newId();
      apps.push(data);
    }
    save();
    render();
    resetForm();
  });

  cancelBtn.addEventListener("click", resetForm);

  resetForm();
  render();
})();
