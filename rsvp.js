(function () {
  const form = document.getElementById("rsvp-form");
  if (!form) return;

  const primarySel = document.getElementById("primary-name");
  const phoneInput = document.getElementById("phone");
  const partySizeInput = document.getElementById("party-size");
  const songInput = document.getElementById("song");
  const dietaryInput = document.getElementById("dietary");
  const successMsg = document.getElementById("success-msg");
  const partySizeGroup = document.getElementById("party-size-group");
  const extraNamesContainer = document.getElementById("extra-names");

  let guests = [];
  let existingRsvps = [];
  let selectedGuest = null;

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function populateSelect(selectEl, options, placeholder, valueKey = "id", labelKey = "full_name") {
    if (!selectEl) return;

    clearNode(selectEl);

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    selectEl.appendChild(placeholderOption);

    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = item[valueKey];
      option.textContent = item[labelKey];
      selectEl.appendChild(option);
    });
  }

  function getGuestById(id) {
    return guests.find((g) => g.id === id) || null;
  }

  function getClaimedGuestIds() {
    const claimed = new Set();

    existingRsvps.forEach((row) => {
      if (row.guest_id) claimed.add(row.guest_id);

      if (Array.isArray(row.extra_guests)) {
        row.extra_guests.forEach((g) => {
          if (g && g.id) claimed.add(g.id);
        });
      }
    });

    return claimed;
  }

  function getEligiblePrimaryGuests() {
    const claimedIds = getClaimedGuestIds();

    return guests.filter((guest) => {
      if (!guest.is_active) return false;
      return !claimedIds.has(guest.id);
    });
  }

  function getSelectedExtraGuestIds() {
    return Array.from(document.querySelectorAll(".extra-guest-sel"))
      .map((el) => el.value)
      .filter(Boolean);
  }

  function rebuildPartySizeOptions(maxSize) {
    if (!partySizeInput) return;

    clearNode(partySizeInput);

    const safeMax = Math.max(1, Number(maxSize || 1));

    for (let i = 1; i <= safeMax; i += 1) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = i === 1 ? "Just me" : `${i} persons`;
      partySizeInput.appendChild(option);
    }
  }

  function refreshExtraGuestSelectOptions() {
    const selects = Array.from(document.querySelectorAll(".extra-guest-sel"));

    selects.forEach((selectEl, index) => {
      const currentValue = selectEl.value;

      const otherSelectedIds = selects
        .filter((_, i) => i !== index)
        .map((el) => el.value)
        .filter(Boolean);

      const claimedIds = getClaimedGuestIds();

      const allowed = guests.filter((guest) => {
        if (!selectedGuest) return false;
        if (!guest.is_active) return false;
        if (guest.id === selectedGuest.id) return false;
        if (guest.invite_group !== selectedGuest.invite_group) return false;
        if (claimedIds.has(guest.id) && guest.id !== currentValue) return false;
        if (otherSelectedIds.includes(guest.id)) return false;
        return true;
      });

      populateSelect(selectEl, allowed, `— Select guest ${index + 2} —`);

      if (currentValue && allowed.some((g) => g.id === currentValue)) {
        selectEl.value = currentValue;
      }
    });
  }

  function rebuildExtraGuestRows(count) {
    if (!extraNamesContainer) return;

    clearNode(extraNamesContainer);

    const totalRows = Math.max(0, Number(count || 1) - 1);

    for (let i = 0; i < totalRows; i += 1) {
      const row = document.createElement("div");
      row.className = "extra-name-row";

      const select = document.createElement("select");
      select.className = "form-select extra-guest-sel";
      select.dataset.index = String(i);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "✕";

      removeBtn.addEventListener("click", function () {
        row.remove();
        refreshExtraGuestSelectOptions();
      });

      select.addEventListener("change", function () {
        refreshExtraGuestSelectOptions();
      });

      row.appendChild(select);
      row.appendChild(removeBtn);
      extraNamesContainer.appendChild(row);
    }

    refreshExtraGuestSelectOptions();
  }

  function setPartySectionVisible(isVisible) {
    if (!partySizeGroup) return;
    partySizeGroup.style.display = isVisible ? "block" : "none";
  }

  function resetDependentFields() {
    if (partySizeInput) partySizeInput.value = "1";
    if (extraNamesContainer) clearNode(extraNamesContainer);
  }

  async function loadGuestsAndRsvps() {
    const guestsResult = await window.sb
      .from("guests")
      .select("id, full_name, phone, invite_group, max_party_size, is_active")
      .eq("is_active", true)
      .order("full_name");

    if (guestsResult.error) {
      console.error("Failed to load guests:", guestsResult.error);
      alert("Could not load guest list.");
      return;
    }

    const rsvpsResult = await window.sb
      .from("rsvps")
      .select("guest_id, extra_guests");

    if (rsvpsResult.error) {
      console.error("Failed to load existing RSVPs:", rsvpsResult.error);
      alert("Could not load RSVP state.");
      return;
    }

    guests = guestsResult.data || [];
    existingRsvps = rsvpsResult.data || [];

    const eligiblePrimaryGuests = getEligiblePrimaryGuests();
    populateSelect(primarySel, eligiblePrimaryGuests, "— Select your name —");
  }

  primarySel?.addEventListener("change", function () {
    selectedGuest = getGuestById(this.value);

    resetDependentFields();

    if (!selectedGuest) {
      return;
    }

    if (phoneInput && !phoneInput.value && selectedGuest.phone) {
      phoneInput.value = selectedGuest.phone;
    }

    rebuildPartySizeOptions(selectedGuest.max_party_size || 1);

    const attendingValue = document.querySelector('input[name="attending"]:checked')?.value;
    if (attendingValue === "yes") {
      rebuildExtraGuestRows(Number(partySizeInput?.value || "1"));
    }
  });

  document.querySelectorAll('input[name="attending"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      const isAttending = this.value === "yes";
      setPartySectionVisible(isAttending);

      if (!isAttending) {
        resetDependentFields();
        return;
      }

      if (selectedGuest) {
        rebuildPartySizeOptions(selectedGuest.max_party_size || 1);
        rebuildExtraGuestRows(Number(partySizeInput?.value || "1"));
      }
    });
  });

  partySizeInput?.addEventListener("change", function () {
    if (!selectedGuest) return;

    const requested = Number(this.value || "1");
    const maxAllowed = Number(selectedGuest.max_party_size || 1);
    const safeCount = Math.min(Math.max(requested, 1), maxAllowed);

    if (requested !== safeCount) {
      this.value = String(safeCount);
    }

    rebuildExtraGuestRows(safeCount);
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const guestId = primarySel?.value || "";
    const attending = document.querySelector('input[name="attending"]:checked')?.value || "";
    const phone = phoneInput?.value?.trim() || null;
    const dietary = dietaryInput?.value?.trim() || null;
    const songRequest = songInput?.value?.trim() || null;

    selectedGuest = getGuestById(guestId);

    if (!selectedGuest || !phone || !attending) {
      alert("Please fill in all required fields.");
      return;
    }

    const maxAllowed = Number(selectedGuest.max_party_size || 1);
    const requestedPartySize = attending === "yes"
      ? Number(partySizeInput?.value || "1")
      : 0;

    const safePartySize = attending === "yes"
      ? Math.min(Math.max(requestedPartySize, 1), maxAllowed)
      : 0;

    const extraGuestIds = Array.from(document.querySelectorAll(".extra-guest-sel"))
      .map((el) => el.value)
      .filter(Boolean);

    if (new Set(extraGuestIds).size !== extraGuestIds.length) {
      alert("Please do not select the same extra guest more than once.");
      return;
    }

    if (attending === "yes" && safePartySize !== extraGuestIds.length + 1) {
      alert("Party size must match the number of selected guests.");
      return;
    }

    const invalidExtra = extraGuestIds.find((id) => {
      const guest = getGuestById(id);
      if (!guest) return true;
      if (guest.id === selectedGuest.id) return true;
      if (guest.invite_group !== selectedGuest.invite_group) return true;
      return false;
    });

    if (invalidExtra) {
      alert("One or more selected guests are not valid for this invitation.");
      return;
    }

    const extraGuests = extraGuestIds.map((id) => {
      const guest = getGuestById(id);
      return {
        id: guest.id,
        full_name: guest.full_name
      };
    });

    const { error } = await window.sb
      .from("rsvps")
      .upsert(
        {
          guest_id: selectedGuest.id,
          attending: attending === "yes",
          party_size: safePartySize,
          extra_guests: extraGuests,
          dietary,
          song_request: songRequest
        },
        { onConflict: "guest_id" }
      );

    if (error) {
      console.error("Failed to save RSVP:", error);
      alert("Could not save RSVP.");
      return;
    }

    form.style.display = "none";
    if (successMsg) {
      successMsg.style.display = "block";
      successMsg.textContent = "Thank you, your RSVP has been saved.";
    }
  });

  loadGuestsAndRsvps();
})();
