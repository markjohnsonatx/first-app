const fs = require("fs");
const { test, expect } = require("@playwright/test");

// Same local-date logic as today() in app.js.
function isoToday() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

async function addRecord(page, rec) {
  await page.locator("#company").fill(rec.company);
  await page.locator("#role").fill(rec.role);
  await page.locator("#date").fill(rec.date);
  await page.locator("#status").selectOption(rec.status || "Applied");
  await page.locator("#notes").fill(rec.notes || "");
  await page.locator("#save-btn").click();
}

function rowFor(page, company) {
  return page.locator("#rows tr", { hasText: company });
}

async function importJson(page, data, name = "import.json") {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  await page.locator("#import-file").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(body)
  });
}

const ACME = {
  company: "Acme Corp",
  role: "Frontend Engineer",
  date: "2026-09-01",
  status: "Applied",
  notes: "Referred by Sam"
};
const GLOBEX = {
  company: "Globex",
  role: "Backend Engineer",
  date: "2026-09-15",
  status: "Interviewing",
  notes: "Phone screen booked"
};
const INITECH = {
  company: "Initech",
  role: "Full Stack Developer",
  date: "2026-10-01",
  status: "Offer",
  notes: ""
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("adds a record", async ({ page }) => {
  await expect(page.locator("#empty")).toBeVisible();

  await addRecord(page, ACME);

  const row = rowFor(page, "Acme Corp");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Frontend Engineer");
  await expect(row).toContainText("2026-09-01");
  await expect(row).toContainText("Referred by Sam");
  await expect(row.locator("select")).toHaveValue("Applied");

  await expect(page.locator("#empty")).toBeHidden();
  await expect(page.locator("#summary")).toContainText("1 total");
  await expect(page.locator("#company")).toHaveValue("");
});

test("edits a record", async ({ page }) => {
  await addRecord(page, ACME);

  await rowFor(page, "Acme Corp").getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#save-btn")).toHaveText("Save");
  await expect(page.locator("#company")).toHaveValue("Acme Corp");

  await page.locator("#role").fill("Staff Engineer");
  await page.locator("#status").selectOption("Interviewing");
  await page.locator("#save-btn").click();

  const rows = page.locator("#rows tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Staff Engineer");
  await expect(rows.first().locator("select")).toHaveValue("Interviewing");
  await expect(page.locator("#save-btn")).toHaveText("Add");
});

test("deletes a record after confirming", async ({ page }) => {
  await addRecord(page, ACME);
  await addRecord(page, GLOBEX);

  page.once("dialog", (dialog) => dialog.dismiss());
  await rowFor(page, "Acme Corp").getByRole("button", { name: "Delete" }).click();
  await expect(rowFor(page, "Acme Corp")).toHaveCount(1);

  page.once("dialog", (dialog) => dialog.accept());
  await rowFor(page, "Acme Corp").getByRole("button", { name: "Delete" }).click();
  await expect(rowFor(page, "Acme Corp")).toHaveCount(0);
  await expect(rowFor(page, "Globex")).toHaveCount(1);

  page.once("dialog", (dialog) => dialog.accept());
  await rowFor(page, "Globex").getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("#empty")).toBeVisible();
});

test("persists records after a reload", async ({ page }) => {
  await addRecord(page, ACME);
  await addRecord(page, GLOBEX);
  await rowFor(page, "Acme Corp").locator("select").selectOption("Rejected");

  await page.reload();

  const rows = page.locator("#rows tr");
  await expect(rows).toHaveCount(2);
  // Newest date first.
  await expect(rows.nth(0)).toContainText("Globex");
  await expect(rows.nth(1)).toContainText("Acme Corp");
  await expect(rowFor(page, "Acme Corp").locator("select")).toHaveValue("Rejected");
});

test("exports all records as a dated JSON file", async ({ page }) => {
  await addRecord(page, ACME);
  await addRecord(page, GLOBEX);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export-btn").click()
  ]);

  expect(download.suggestedFilename()).toBe(`job-tracker-${isoToday()}.json`);

  const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  expect(exported).toHaveLength(2);

  const strip = ({ company, role, date, status, notes }) => ({
    company, role, date, status, notes
  });
  const byCompany = (a, b) => a.company.localeCompare(b.company);
  expect(exported.map(strip).sort(byCompany)).toEqual([ACME, GLOBEX].sort(byCompany));
  exported.forEach((r) => expect(typeof r.id).toBe("string"));
});

test("imports with replace", async ({ page }) => {
  await addRecord(page, ACME);

  await importJson(page, [GLOBEX, INITECH]);
  await expect(page.locator("#import-dialog")).toBeVisible();
  await page.locator("#import-replace").click();

  await expect(page.locator("#rows tr")).toHaveCount(2);
  await expect(rowFor(page, "Globex")).toHaveCount(1);
  await expect(rowFor(page, "Initech")).toHaveCount(1);
  await expect(rowFor(page, "Acme Corp")).toHaveCount(0);
  await expect(page.locator("#message")).toContainText("Replaced all records");

  await page.reload();
  await expect(page.locator("#rows tr")).toHaveCount(2);
});

test("imports with merge without creating duplicates", async ({ page }) => {
  await addRecord(page, ACME);
  await addRecord(page, GLOBEX);

  // Acme matches an existing record apart from case and padding.
  const file = [
    { ...ACME, company: "  ACME corp ", role: "frontend engineer" },
    INITECH
  ];

  await importJson(page, file);
  await page.locator("#import-merge").click();

  await expect(page.locator("#rows tr")).toHaveCount(3);
  await expect(rowFor(page, "Initech")).toHaveCount(1);
  await expect(page.locator("#message")).toHaveText("Imported 1, skipped 1 duplicate.");

  // Importing the same file again adds nothing.
  await importJson(page, file);
  await page.locator("#import-merge").click();

  await expect(page.locator("#rows tr")).toHaveCount(3);
  await expect(page.locator("#message")).toHaveText("Imported 0, skipped 2 duplicates.");
});

test("rejects invalid import files and leaves data untouched", async ({ page }) => {
  await addRecord(page, ACME);

  await importJson(page, "this is not json", "bad.json");
  await expect(page.locator("#message")).toContainText("not valid JSON");
  await expect(page.locator("#import-dialog")).toBeHidden();
  await expect(page.locator("#rows tr")).toHaveCount(1);

  const { company, ...noCompany } = GLOBEX;
  await importJson(page, [noCompany]);
  await expect(page.locator("#message")).toContainText("Record 1: missing company");
  await expect(page.locator("#message")).toContainText("No changes were made");
  await expect(page.locator("#rows tr")).toHaveCount(1);
  await expect(rowFor(page, "Acme Corp")).toHaveCount(1);
});
