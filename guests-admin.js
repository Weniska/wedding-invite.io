(function () {
  const form = document.getElementById("guest-form");
  if (!form) return;

  const guestIdInput = document.getElementById("guest-id");
  const guestNameInput = document.getElementById("guest-name");
  const guestPhoneInput = document.getElementById("guest-phone");
  const guestGroupInput = document.getElementById("guest-group");
  const guestGroupOptions = document.getElementById("guest-group-options");
  const guestMaxPartyInput = document.getElementById("guest-max-party");
  const guestNotesInput = document.getElementById("guest-notes");
  const guestActiveInput = document.getElementById("guest-active");
  const guestTbody = document.getElementById("guest-tbody");
  const resetBtn = document.getElementById("guest-form-reset");
  const generateGroupBtn = document.getElementById("guest-group-generate");
  const formMessage = document.getElementById("guest-form-message");

  let guestRows = [];

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
    guestIdInput.value = "";
    guestNameInput.value = "";
    guestPhoneInput.value = "";
    guestGroupInput.value = "";
    guestMaxPartyInput.value = "1";
    guestNotesInput.value = "";
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

    return guestRows.filter((row) => {
      return row.invite_group === normalized && row.id !== excludingId;
    });
  }

  function validateForm() {
    const fullName = guestNameInput.value.trim();
    const inviteGroup = guestGroupInput.value.trim();
    const maxPartySize = Number(guestMaxPartyInput.value || "1");

    if (!fullName) {
      return { ok: false, message: "Guest name is required." };
    }

    if (!inviteGroup) {
      return { ok: false, message: "Invite group is required." };
    }

    if (!Number.isInteger(maxPartySize) || maxPartySize < 1) {
      return { ok: false, message: "Max party size must be a whole number of at least 1." };
    }

    const duplicateName = guestRows.find((row) => {
      return row.full_name.trim().toLowerCase() === fullName.toLowerCase()
        && row.id !== guestIdInput.value;
    });

    if (duplicateName) {
      return { ok: false, message: "A guest with that full name already exists." };
    }

    return { ok: true };
  }

  function getGroupWarningPayload() {
    const inviteGroup = guestGroupInput.value.trim();
    const maxPartySize = Number(guestMaxPartyInput.value || "1");
    const otherMembers = getGroupMembers(inviteGroup, guestIdInput.value);

    const multiSeatMembers = otherMembers.filter((row) => Number(row.max_party_size || 1) > 1);

    if (maxPartySize > 1 && multiSeatMembers.length > 0) {
      return {
        warn: true,
        message: `This invite group already has another guest with max party size above 1: ${multiSeatMembers.map((m) => m.full_name).join(", ")}. Usually only one person per group should control the full household seat count.`
      };
    }

    return { warn: false, message: "" };
  }

  async function fetchGuests() {
    const { data, error } = await window.sb
      .from("guests")
      .select("*")
      .order("full_name");

    if (error) throw error;
    return data || [];
  }

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
            <button type="button" class="edit-guest-btn" data-id="${row.id}">Edit</button>
            <button type="button" class="copy-group-btn" data-group="${escapeHtml(row.invite_group || "")}">Use Group</button>
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

        guestIdInput.value = row.id;
        guestNameInput.value = row.full_name || "";
        guestPhoneInput.value = row.phone || "";
        guestGroupInput.value = row.invite_group || "";
        guestMaxPartyInput.value = String(row.max_party_size || 1);
        guestNotesInput.value = row.notes || "";
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
          showMessage("Failed to update guest status.", "error");
          return;
        }

        await loadGuestsAdmin();
        window.dispatchEvent(new CustomEvent("guests-updated"));
        showMessage(`Guest ${row.is_active ? "deactivated" : "activated"} successfully.`, "success");
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
          showMessage("Failed to delete guest.", "error");
          return;
        }

        await loadGuestsAdmin();
        window.dispatchEvent(new CustomEvent("guests-updated"));
        showMessage("Guest deleted successfully.", "success");
      });
    });
  }

  async function loadGuestsAdmin() {
    try {
      clearMessage();
      const rows = await fetchGuests();
      renderGuests(rows);
    } catch (error) {
      console.error(error);
      guestTbody.innerHTML = `<tr><td colspan="7">Failed to load guests.</td></tr>`;
      showMessage("Failed to load guests.", "error");
    }
  }

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

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearMessage();

    const validation = validateForm();
    if (!validation.ok) {
      showMessage(validation.message, "error");
      return;
    }

    const payload = {
      full_name: guestNameInput.value.trim(),
      phone: guestPhoneInput.value.trim() || null,
      invite_group: guestGroupInput.value.trim(),
      max_party_size: Number(guestMaxPartyInput.value || "1"),
      notes: guestNotesInput.value.trim() || null,
      is_active: guestActiveInput ? !!guestActiveInput.checked : true
    };

    const groupWarning = getGroupWarningPayload();
    if (groupWarning.warn) {
      const proceed = window.confirm(`${groupWarning.message}

Do you want to save anyway?`);
      if (!proceed) return;
    }

    let error;

    if (guestIdInput.value) {
      ({ error } = await window.sb
        .from("guests")
        .update(payload)
        .eq("id", guestIdInput.value));
    } else {
      ({ error } = await window.sb
        .from("guests")
        .insert(payload));
    }

    if (error) {
      console.error(error);
      showMessage("Could not save guest.", "error");
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

  window.loadGuestsAdmin = loadGuestsAdmin;
})();
