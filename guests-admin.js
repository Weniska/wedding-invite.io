(function () {
  const form = document.getElementById("guest-form");
  if (!form) return;

  const guestIdInput       = document.getElementById("guest-id");
  const guestNameInput     = document.getElementById("guest-name");
  const guestPhoneInput    = document.getElementById("guest-phone");
  const guestGroupInput    = document.getElementById("guest-group");
  const guestGroupOptions  = document.getElementById("guest-group-options");
  const guestMaxPartyInput = document.getElementById("guest-max-party");
  const guestNotesInput    = document.getElementById("guest-notes");
  const guestActiveInput   = document.getElementById("guest-active");
  const guestTbody         = document.getElementById("guest-tbody");
  const resetBtn           = document.getElementById("guest-form-reset");
  const generateGroupBtn   = document.getElementById("guest-group-generate");
  const formMessage        = document.getElementById("guest-form-message");
  const importBtn          = document.getElementById("guest-import-btn");
  const importFileInput    = document.getElementById("guest-import-file");
  const importPreview      = document.getElementById("guest-import-preview");

  let guestRows = [];

  /* ── Utilities ──────────────────────────────────────────────────────── */

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function showMessage(message, type = "info") {
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.dataset.type = type;
  }

  function clearMessage() {
    if (!formMessage) return;
    formMessage.textContent = "";
    formMessage.dataset.type = "";
  }

  function resetForm() {
    guestIdInput.value       = "";
    guestNameInput.value     = "";
    guestPhoneInput.value    = "";
    guestGroupInput.value    = "";
    guestMaxPartyInput.value = "1";
    guestNotesInput.value    = "";
    if (guestActiveInput) guestActiveInput.checked = true;
    clearMessage();
  }

  function buildSuggestedGroup(name) {
    const base = slugify(name);
    return base ? `grp-${base}` : "";
  }

  function getUniqueGroups(rows) {
    return [...new Set(
      rows
        .map((row) => row.invite_group)
        .filter(Boolean)
        .map((v) => String(v).trim())
    )].sort((a, b) => a.localeCompare(b));
  }

  function renderGroupSuggestions(rows) {
    if (!guestGroupOptions) return;
    const groups = getUniqueGroups(rows);
    guestGroupOptions.innerHTML = groups
      .map((group) => `<option value="${escapeHtml(group)}"></option>`)
      .join("");
  }

  function getGroupMembers(groupName, excludingId = "") {
    const normalized = String(groupName || "").trim();
    if (!normalized) return [];
    return guestRows.filter(
      (row) => row.invite_group === normalized && row.id !== excludingId
    );
  }

  function validateForm() {
    const fullName    = guestNameInput.value.trim();
    const inviteGroup = guestGroupInput.value.trim();
    const maxPartySize = Number(guestMaxPartyInput.value || "1");

    if (!fullName)    return { ok: false, message: "Guest name is required." };
    if (!inviteGroup) return { ok: false, message: "Invite group is required." };
    if (!Number.isInteger(maxPartySize) || maxPartySize < 1)
      return { ok: false, message: "Max party size must be a whole number of at least 1." };

    const duplicateName = guestRows.find(
      (row) =>
        row.full_name.trim().toLowerCase() === fullName.toLowerCase() &&
        row.id !== guestIdInput.value
    );
    if (duplicateName)
      return { ok: false, message: "A guest with that full name already exists." };

    return { ok: true };
  }

  function getGroupWarningPayload() {
    const inviteGroup  = guestGroupInput.value.trim();
    const maxPartySize = Number(guestMaxPartyInput.value || "1");
    const otherMembers = getGroupMembers(inviteGroup, guestIdInput.value);
    const multiSeatMembers = otherMembers.filter(
      (row) => Number(row.max_party_size || 1) > 1
    );

    if (maxPartySize > 1 && multiSeatMembers.length > 0) {
      return {
        warn: true,
        message: `This invite group already has another guest with max party size above 1: ${multiSeatMembers.map((m) => m.full_name).join(", ")}. Usually only one person per group should control the full household seat count.`
      };
    }
    return { warn: false, message: "" };
  }

  /* ── Supabase helpers ────────────────────────────────────────────────── */

  async function fetchGuests() {
    const { data, error } = await window.sb
      .from("guests")
      .select("*")
      .order("full_name");
    if (error) throw error;
    return data || [];
  }

  /* ── Render guest table ──────────────────────────────────────────────── */

  function renderGuests(rows) {
    guestRows = rows.slice();
    renderGroupSuggestions(rows);

    if (!rows.length) {
      guestTbody.innerHTML = `<tr><td colspan="7">No guests found.</td></tr>`;
      return;
    }

    guestTbody.innerHTML = rows.map((row) => {
      const memberCount = row.invite_group
        ? rows.filter((r) => r.invite_group === row.invite_group).length
        : 0;

      return `
        <tr>
          <td>${escapeHtml(row.full_name)}</td>
          <td>${escapeHtml(row.phone || "—")}</td>
          <td>
            <div>${escapeHtml(row.invite_group || "—")}</div>
            ${row.invite_group ? `<small>${memberCount} in group</small>` : ""}
          </td>
          <td>${escapeHtml(row.max_party_size || 1)}</td>
          <td>${row.is_active ? "Active" : "Inactive"}</td>
          <td>${escapeHtml(row.notes || "—")}</td>
          <td>
            <button type="button" class="edit-guest-btn"   data-id="${row.id}">Edit</button>
            <button type="button" class="copy-group-btn"   data-group="${escapeHtml(row.invite_group || "")}">Use Group</button>
            <button type="button" class="toggle-guest-btn" data-id="${row.id}" data-active="${row.is_active}">
              ${row.is_active ? "Deactivate" : "Activate"}
            </button>
            <button type="button" class="delete-guest-btn" data-id="${row.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    guestTbody.querySelectorAll(".edit-guest-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const row = guestRows.find((item) => item.id === this.dataset.id);
        if (!row) return;

        guestIdInput.value       = row.id;
        guestNameInput.value     = row.full_name || "";
        guestPhoneInput.value    = row.phone || "";
        guestGroupInput.value    = row.invite_group || "";
        guestMaxPartyInput.value = String(row.max_party_size || 1);
        guestNotesInput.value    = row.notes || "";
        if (guestActiveInput) guestActiveInput.checked = !!row.is_active;

        clearMessage();
        const warning = getGroupWarningPayload();
        if (warning.warn) showMessage(warning.message, "warning");
      });
    });

    guestTbody.querySelectorAll(".copy-group-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        guestGroupInput.value = this.dataset.group || "";
        showMessage("Invite group copied into the form.", "info");
      });
    });

    guestTbody.querySelectorAll(".toggle-guest-btn").forEach((btn) => {
      btn.addEventListener("click", async function () {
        const row = guestRows.find((item) => item.id === this.dataset.id);
        if (!row) return;

        const { error } = await window.sb
          .from("guests")
          .update({ is_active: !row.is_active })
          .eq("id", row.id);

        if (error) {
          console.error(error);
          showMessage(`Failed to update guest status: ${error.message}`, "error");
          return;
        }

        await loadGuestsAdmin();
        window.dispatchEvent(new CustomEvent("guests-updated"));
        showMessage(
          `Guest ${row.is_active ? "deactivated" : "activated"} successfully.`,
          "success"
        );
      });
    });

    guestTbody.querySelectorAll(".delete-guest-btn").forEach((btn) => {
      btn.addEventListener("click", async function () {
        const row = guestRows.find((item) => item.id === this.dataset.id);
        if (!row) return;

        const confirmed = window.confirm(
          `Delete ${row.full_name}? This will also delete that guest's RSVP because rsvps.guest_id references guests.id with cascade delete.`
        );
        if (!confirmed) return;

        const { error } = await window.sb
          .from("guests")
          .delete()
          .eq("id", row.id);

        if (error) {
          console.error(error);
          showMessage(`Failed to delete guest: ${error.message}`, "error");
          return;
        }

        await loadGuestsAdmin();
        window.dispatchEvent(new CustomEvent("guests-updated"));
        showMessage("Guest deleted successfully.", "success");
      });
    });
  }

  /* ── Load ────────────────────────────────────────────────────────────── */

  async function loadGuestsAdmin() {
    try {
      clearMessage();
      const rows = await fetchGuests();
      renderGuests(rows);
    } catch (error) {
      console.error(error);
      guestTbody.innerHTML = `<tr><td colspan="7">Failed to load guests.</td></tr>`;
      showMessage(`Failed to load guests: ${error.message}`, "error");
    }
  }

  /* ── Form auto-fill ──────────────────────────────────────────────────── */

  guestNameInput.addEventListener("blur", function () {
    if (guestGroupInput.value.trim()) return;
    const generated = buildSuggestedGroup(this.value);
    if (generated) guestGroupInput.value = generated;
  });

  guestGroupInput.addEventListener("input", function () {
    clearMessage();
    const warning = getGroupWarningPayload();
    if (warning.warn) showMessage(warning.message, "warning");
  });

  guestMaxPartyInput.addEventListener("input", function () {
    clearMessage();
    const warning = getGroupWarningPayload();
    if (warning.warn) showMessage(warning.message, "warning");
  });

  if (generateGroupBtn) {
    generateGroupBtn.addEventListener("click", function () {
      const generated = buildSuggestedGroup(guestNameInput.value);
      if (!generated) {
        showMessage("Enter the guest name first, then generate the group.", "warning");
        return;
      }
      guestGroupInput.value = generated;
      showMessage("Invite group generated from guest name.", "success");
    });
  }

  /* ── Save single guest ───────────────────────────────────────────────── */

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearMessage();

    const validation = validateForm();
    if (!validation.ok) {
      showMessage(validation.message, "error");
      return;
    }

    const payload = {
      full_name:      guestNameInput.value.trim(),
      phone:          guestPhoneInput.value.trim() || null,
      invite_group:   guestGroupInput.value.trim(),
      max_party_size: Number(guestMaxPartyInput.value || "1"),
      notes:          guestNotesInput.value.trim() || null,
      is_active:      guestActiveInput ? !!guestActiveInput.checked : true
    };

    const groupWarning = getGroupWarningPayload();
    if (groupWarning.warn) {
      const proceed = window.confirm(
        `${groupWarning.message}\n\nDo you want to save anyway?`
      );
      if (!proceed) return;
    }

    let dbError;

    if (guestIdInput.value) {
      ({ error: dbError } = await window.sb
        .from("guests")
        .update(payload)
        .eq("id", guestIdInput.value));
    } else {
      ({ error: dbError } = await window.sb
        .from("guests")
        .insert(payload));
    }

    if (dbError) {
      console.error("Save guest error:", dbError);
      // Surface the actual Supabase error message so we can diagnose it
      showMessage(
        `Could not save guest — ${dbError.message || dbError.code || "unknown error"}`,
        "error"
      );
      return;
    }

    const savedName = payload.full_name;
    resetForm();
    await loadGuestsAdmin();
    window.dispatchEvent(new CustomEvent("guests-updated"));
    showMessage(`Guest saved: ${savedName}`, "success");
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", resetForm);
  }

  /* ── CSV Import ──────────────────────────────────────────────────────── */

  /**
   * Minimal RFC-4180-compatible CSV parser.
   * Returns an array of objects keyed by the header row.
   */
  function parseCsv(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (!lines.length) return [];

    function splitRow(line) {
      const fields = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') inQuotes = false;
          else cur += ch;
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === ",") { fields.push(cur.trim()); cur = ""; }
          else cur += ch;
        }
      }
      fields.push(cur.trim());
      return fields;
    }

    const headers = splitRow(lines[0]).map((h) =>
      h.toLowerCase().replace(/\s+/g, "_")
    );

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = splitRow(line);
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = values[idx] ?? ""; });
      records.push(obj);
    }
    return records;
  }

  /**
   * Map CSV row to a guests payload.
   * Accepted column names (case-insensitive, spaces→underscores):
   *   full_name / name
   *   phone
   *   invite_group / group
   *   max_party_size / party_size / max_party / seats
   *   notes
   *   is_active / active  (yes/true/1 → true, anything else → false; blank → true)
   */
  function mapCsvRow(row) {
    const fullName =
      (row["full_name"] || row["name"] || "").trim();

    const phone =
      (row["phone"] || "").trim() || null;

    const inviteGroup =
      (row["invite_group"] || row["group"] || "").trim();

    const maxPartyRaw =
      row["max_party_size"] || row["party_size"] || row["max_party"] || row["seats"] || "1";
    const maxPartySize = Math.max(1, parseInt(maxPartyRaw, 10) || 1);

    const notes = (row["notes"] || "").trim() || null;

    const activeRaw =
      (row["is_active"] ?? row["active"] ?? "").trim().toLowerCase();
    const isActive =
      activeRaw === "" ? true : ["yes", "true", "1"].includes(activeRaw);

    return { fullName, phone, inviteGroup, maxPartySize, notes, isActive };
  }

  function buildImportPreview(rows) {
    if (!importPreview) return;

    if (!rows.length) {
      importPreview.innerHTML = `<p style="color:rgba(255,255,255,0.4);font-style:italic;margin:0.5rem 0;">No valid rows found in CSV.</p>`;
      return;
    }

    const headerHtml = `
      <tr>
        <th>#</th><th>Full Name</th><th>Phone</th>
        <th>Invite Group</th><th>Party Size</th><th>Active</th><th>Notes</th><th>Status</th>
      </tr>`;

    const bodyHtml = rows.map((r, i) => {
      let statusBadge = "";
      if (!r.fullName) {
        statusBadge = `<span class="badge badge-no">Missing name</span>`;
      } else if (!r.inviteGroup) {
        statusBadge = `<span class="badge badge-no">Missing group</span>`;
      } else if (guestRows.some(
        (g) => g.full_name.trim().toLowerCase() === r.fullName.toLowerCase()
      )) {
        statusBadge = `<span class="badge" style="background:rgba(240,200,80,0.15);color:#f1cf7a;">Duplicate</span>`;
      } else {
        statusBadge = `<span class="badge badge-yes">OK</span>`;
      }

      return `<tr>
        <td style="color:rgba(255,255,255,0.3)">${i + 1}</td>
        <td>${escapeHtml(r.fullName || "—")}</td>
        <td>${escapeHtml(r.phone || "—")}</td>
        <td>${escapeHtml(r.inviteGroup || "—")}</td>
        <td>${r.maxPartySize}</td>
        <td>${r.isActive ? "Yes" : "No"}</td>
        <td>${escapeHtml(r.notes || "—")}</td>
        <td>${statusBadge}</td>
      </tr>`;
    }).join("");

    importPreview.innerHTML = `
      <p style="font-size:0.75rem;color:rgba(255,255,255,0.45);margin:0.5rem 0;">
        ${rows.length} rows detected. Review below, then click <strong style="color:var(--gold)">Import Valid Rows</strong>.
      </p>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem;margin-bottom:1rem;">
          <thead>${headerHtml}</thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;
  }

  let pendingImportRows = [];

  if (importFileInput) {
    importFileInput.addEventListener("change", async function () {
      pendingImportRows = [];
      if (!importPreview) return;
      importPreview.innerHTML = "";

      const file = this.files && this.files[0];
      if (!file) return;

      const text = await file.text();
      const records = parseCsv(text);

      pendingImportRows = records.map(mapCsvRow);
      buildImportPreview(pendingImportRows);
    });
  }

  if (importBtn) {
    importBtn.addEventListener("click", async function () {
      if (!pendingImportRows.length) {
        showMessage("Please choose a CSV file first.", "warning");
        return;
      }

      const validRows = pendingImportRows.filter(
        (r) =>
          r.fullName &&
          r.inviteGroup &&
          !guestRows.some(
            (g) => g.full_name.trim().toLowerCase() === r.fullName.toLowerCase()
          )
      );

      if (!validRows.length) {
        showMessage(
          "No importable rows (all rows are missing required fields or are duplicates).",
          "warning"
        );
        return;
      }

      const confirmed = window.confirm(
        `Import ${validRows.length} guest${validRows.length !== 1 ? "s" : ""}? Duplicate and invalid rows will be skipped.`
      );
      if (!confirmed) return;

      importBtn.disabled = true;
      showMessage(`Importing ${validRows.length} guests…`, "info");

      const payload = validRows.map((r) => ({
        full_name:      r.fullName,
        phone:          r.phone,
        invite_group:   r.inviteGroup,
        max_party_size: r.maxPartySize,
        notes:          r.notes,
        is_active:      r.isActive
      }));

      const { error: dbError } = await window.sb
        .from("guests")
        .insert(payload);

      importBtn.disabled = false;

      if (dbError) {
        console.error("CSV import error:", dbError);
        showMessage(
          `Import failed — ${dbError.message || dbError.code || "unknown error"}`,
          "error"
        );
        return;
      }

      // Reset import UI
      pendingImportRows = [];
      if (importFileInput) importFileInput.value = "";
      if (importPreview)   importPreview.innerHTML = "";

      await loadGuestsAdmin();
      window.dispatchEvent(new CustomEvent("guests-updated"));
      showMessage(
        `Successfully imported ${validRows.length} guest${validRows.length !== 1 ? "s" : ""}.`,
        "success"
      );
    });
  }

  /* ── Expose for admin.js ─────────────────────────────────────────────── */

  window.loadGuestsAdmin = loadGuestsAdmin;
})();
