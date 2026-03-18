(function () {
  const loginPanel = document.getElementById("login-panel");
  const adminPanel = document.getElementById("admin-panel");
  const statsRow = document.getElementById("stats-row");
  const tbody = document.getElementById("rsvp-tbody");
  const refreshBtn = document.getElementById("refresh-btn");
  const exportBtn = document.getElementById("export-btn");
  const exportGuestsBtn = document.getElementById("export-guests-btn");

  let currentRsvpRows = [];
  let currentGuestRows = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }

  function renderStats(rows) {
    const total = rows.length;
    const attending = rows.filter((row) => row.attending).length;
    const declined = rows.filter((row) => !row.attending).length;
    const totalGuests = rows
      .filter((row) => row.attending)
      .reduce((sum, row) => sum + Number(row.party_size || 0), 0);

    statsRow.innerHTML = `
      <div class="stat-card">
        <div class="stat-num">${total}</div>
        <div class="stat-label">RSVPs Received</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${attending}</div>
        <div class="stat-label">Attending</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${declined}</div>
        <div class="stat-label">Not Attending</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${totalGuests}</div>
        <div class="stat-label">Total Guests</div>
      </div>
    `;
  }

  function renderRsvpTable(rows) {
    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty">No RSVPs yet, check back soon.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map((row, index) => {
      const extras = Array.isArray(row.extra_guests) && row.extra_guests.length
        ? row.extra_guests.map((g) => g.full_name).join(", ")
        : "—";

      return `
        <tr>
          <td style="color:rgba(255,255,255,0.3)">${index + 1}</td>
          <td style="color:#fff;font-weight:400">${escapeHtml(row.guests?.full_name || "—")}</td>
          <td>${escapeHtml(row.guests?.phone || "—")}</td>
          <td>${escapeHtml(row.guests?.invite_group || "—")}</td>
          <td>
            <span class="badge badge-${row.attending ? "yes" : "no"}">
              ${row.attending ? "Attending" : "Declined"}
            </span>
          </td>
          <td>${row.attending ? escapeHtml(row.party_size || 1) : "—"}</td>
          <td>${escapeHtml(extras)}</td>
          <td>${escapeHtml(row.dietary || "None")}</td>
          <td>${escapeHtml(row.song_request || "—")}</td>
          <td style="font-size:0.7rem;color:rgba(255,255,255,0.35)">
            ${escapeHtml(formatDate(row.submitted_at))}
          </td>
        </tr>
      `;
    }).join("");
  }

  async function fetchResponses() {
    const { data, error } = await window.sb
      .from("rsvps")
      .select(`
        *,
        guests (
          full_name,
          phone,
          invite_group
        )
      `)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Failed to load RSVPs:", error);
      throw error;
    }

    return data || [];
  }

  async function fetchGuests() {
    const { data, error } = await window.sb
      .from("guests")
      .select("*")
      .order("full_name");

    if (error) {
      console.error("Failed to load guests:", error);
      throw error;
    }

    return data || [];
  }

  function downloadCsv(filename, headers, rows) {
    const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csvLines = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCsv).join(","))
    ];

    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportRsvpsCsv() {
    if (!currentRsvpRows.length) {
      alert("No RSVP data to export.");
      return;
    }

    const headers = [
      "Name",
      "Phone",
      "Invite Group",
      "Status",
      "Party Size",
      "Additional Guests",
      "Dietary",
      "Song Request",
      "Submitted"
    ];

    const rows = currentRsvpRows.map((row) => [
      row.guests?.full_name || "",
      row.guests?.phone || "",
      row.guests?.invite_group || "",
      row.attending ? "Attending" : "Declined",
      row.party_size || "",
      Array.isArray(row.extra_guests) ? row.extra_guests.map((g) => g.full_name).join(", ") : "",
      row.dietary || "",
      row.song_request || "",
      row.submitted_at || ""
    ]);

    downloadCsv("wedding-rsvps.csv", headers, rows);
  }

  function exportGuestsCsv() {
    if (!currentGuestRows.length) {
      alert("No guest data to export.");
      return;
    }

    const headers = [
      "Full Name",
      "Phone",
      "Invite Group",
      "Max Party Size",
      "Active",
      "Notes",
      "Created At",
      "Updated At"
    ];

    const rows = currentGuestRows.map((row) => [
      row.full_name || "",
      row.phone || "",
      row.invite_group || "",
      row.max_party_size || 1,
      row.is_active ? "Yes" : "No",
      row.notes || "",
      row.created_at || "",
      row.updated_at || ""
    ]);

    downloadCsv("wedding-guests.csv", headers, rows);
  }

  async function loadDashboard() {
    const [rsvpRows, guestRows] = await Promise.all([
      fetchResponses(),
      fetchGuests()
    ]);

    currentRsvpRows = rsvpRows;
    currentGuestRows = guestRows;

    renderStats(rsvpRows);
    renderRsvpTable(rsvpRows);

    if (typeof window.loadGuestsAdmin === "function") {
      await window.loadGuestsAdmin();
    }
  }

  async function boot() {
    const session = await window.AdminAuth.getSession();

    if (!session) {
      if (loginPanel) loginPanel.style.display = "block";
      if (adminPanel) adminPanel.style.display = "none";
      return;
    }

    if (loginPanel) loginPanel.style.display = "none";
    if (adminPanel) adminPanel.style.display = "block";

    await loadDashboard();
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async function () {
      try {
        await loadDashboard();
      } catch (error) {
        alert("Failed to refresh dashboard.");
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", exportRsvpsCsv);
  }

  if (exportGuestsBtn) {
    exportGuestsBtn.addEventListener("click", exportGuestsCsv);
  }

  window.addEventListener("guests-updated", async function () {
    await loadDashboard();
  });

  boot();
})();
