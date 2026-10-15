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

  // ----- Export / Import -----

  var exportBtn = document.getElementById("export-btn");
  var importBtn = document.getElementById("import-btn");
  var importFile = document.getElementById("import-file");
  var messageEl = document.getElementById("message");
  var dialog = document.getElementById("import-dialog");
  var importText = document.getElementById("import-text");
  var pendingImport = null;

  function showMessage(text, kind) {
    messageEl.textContent = text;
    messageEl.className = "message " + kind;
    messageEl.hidden = false;
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function dupKey(a) {
    return [a.company, a.role, a.date].map(function (s) {
      return s.trim().toLowerCase();
    }).join("|");
  }

  function exportRecords() {
    var json = JSON.stringify(apps, null, 2);
    var url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = "job-tracker-" + today() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    showMessage(
      apps.length ? "Exported " + plural(apps.length, "record") + "."
                  : "Exported an empty file (no records yet).",
      "success"
    );
  }

  // Returns { records } or { error }.
  function parseImport(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { error: "This file is not valid JSON." };
    }
    if (data && !Array.isArray(data) && Array.isArray(data.applications)) {
      data = data.applications;
    }
    if (!Array.isArray(data)) {
      return { error: "Unexpected format: expected a list of applications." };
    }
    if (data.length === 0) {
      return { error: "The file contains no records." };
    }

    var records = [];
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      var n = "Record " + (i + 1) + ": ";
      if (!r || typeof r !== "object" || Array.isArray(r)) {
        return { error: n + "not an object." };
      }
      var company = typeof r.company === "string" ? r.company.trim() : "";
      var role = typeof r.role === "string" ? r.role.trim() : "";
      if (!company) return { error: n + "missing company." };
      if (!role) return { error: n + "missing role." };
      if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
        return { error: n + "date must be in YYYY-MM-DD format." };
      }
      if (STATUSES.indexOf(r.status) === -1) {
        return { error: n + "status must be one of " + STATUSES.join(", ") + "." };
      }
      if (r.notes != null && typeof r.notes !== "string") {
        return { error: n + "notes must be text." };
      }
      records.push({
        id: typeof r.id === "string" && r.id ? r.id : "",
        company: company,
        role: role,
        date: r.date,
        status: r.status,
        notes: (r.notes || "").trim()
      });
    }
    return { records: records };
  }

  function usedIds(list) {
    var set = {};
    list.forEach(function (a) { set[a.id] = true; });
    return set;
  }

  function assignId(rec, taken) {
    if (!rec.id || taken[rec.id]) {
      do { rec.id = newId(); } while (taken[rec.id]);
    }
    taken[rec.id] = true;
  }

  function finishImport(message) {
    save();
    resetForm();
    render();
    showMessage(message, "success");
  }

  function replaceRecords(records) {
    var taken = {};
    records.forEach(function (r) { assignId(r, taken); });
    apps = records;
    finishImport("Replaced all records with " + plural(records.length, "imported record") + ".");
  }

  function mergeRecords(records) {
    var taken = usedIds(apps);
    var keys = {};
    apps.forEach(function (a) { keys[dupKey(a)] = true; });
    var added = 0;
    var skipped = 0;
    records.forEach(function (r) {
      var isDup = (r.id && taken[r.id]) || keys[dupKey(r)];
      if (isDup) {
        skipped++;
        return;
      }
      keys[dupKey(r)] = true;
      assignId(r, taken);
      apps.push(r);
      added++;
    });
    finishImport(
      "Imported " + added + ", skipped " + plural(skipped, "duplicate") + "."
    );
  }

  function closeDialog() {
    pendingImport = null;
    if (dialog.open) dialog.close();
  }

  exportBtn.addEventListener("click", exportRecords);

  importBtn.addEventListener("click", function () { importFile.click(); });

  importFile.addEventListener("change", function () {
    var file = importFile.files && importFile.files[0];
    importFile.value = "";
    if (!file) return;

    var reader = new FileReader();
    reader.onerror = function () {
      showMessage("Could not read the file.", "error");
    };
    reader.onload = function () {
      var result = parseImport(String(reader.result));
      if (result.error) {
        showMessage("Import failed. " + result.error + " No changes were made.", "error");
        return;
      }
      pendingImport = result.records;
      importText.textContent =
        "Import " + plural(result.records.length, "record") + " from " + file.name +
        ". You currently have " + plural(apps.length, "record") + ".";
      messageEl.hidden = true;
      dialog.showModal();
    };
    reader.readAsText(file);
  });

  document.getElementById("import-replace").addEventListener("click", function () {
    var records = pendingImport;
    closeDialog();
    if (records) replaceRecords(records);
  });

  document.getElementById("import-merge").addEventListener("click", function () {
    var records = pendingImport;
    closeDialog();
    if (records) mergeRecords(records);
  });

  document.getElementById("import-cancel").addEventListener("click", closeDialog);
  dialog.addEventListener("cancel", function () { pendingImport = null; });

  resetForm();
  render();
})();
