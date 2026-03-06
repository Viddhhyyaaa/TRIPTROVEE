// -------------------- DOM Elements --------------------
const planBtn = document.getElementById("planBtn");
const tripBox = document.getElementById("tripBox");
const plannerContainer = document.getElementById("plannerContainer");
const daysContainer = document.getElementById("daysContainer");
const dayPlanContainer = document.getElementById("dayPlanContainer");

let tripData = {};
let visitedPlaces = {};
let bookmarkedPlaces = {};
let selectedPlaces = {};
let currentDay = null;
let currentVibe = null;
let allDaySelections = {};
let shownPlacesPerVibe = {};

// -------------------- Plan My Day button --------------------
if (planBtn) {
  planBtn.addEventListener("click", () => {
    const city = document.getElementById("city").value.trim();
    const start = new Date(document.getElementById("startDate").value);
    const end = new Date(document.getElementById("endDate").value);

    if (!city || isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      alert("Please fill all details correctly.");
      return;
    }

    tripData = { city, start, end };
    visitedPlaces = {};
    bookmarkedPlaces = {};
    selectedPlaces = {};
    allDaySelections = {};
    shownPlacesPerVibe = {};

    tripBox.classList.add("hidden");
    plannerContainer.classList.remove("hidden");

    generateDays(start, end);
  });
}

// -------------------- Generate day cards --------------------
function generateDays(start, end) {
  daysContainer.innerHTML = "";

  const dates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }

  dates.forEach((date, index) => {
    const dayNum = index + 1;
    const dateStr = date.toDateString();
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });

    const card = document.createElement("div");
    card.className = "day-card text-white";
    card.innerHTML = `
      <h3 class="font-semibold">Day ${dayNum}</h3>
      <p class="text-sm text-white/80">${dayName}</p>
      <p class="text-xs text-gray-400">${dateStr}</p>
    `;
    card.addEventListener("click", () => selectDay(dayNum, dayName, dateStr));
    daysContainer.appendChild(card);
  });
}

// -------------------- Select a day --------------------
function selectDay(dayNum, dayName, dateStr) {
  currentDay = dayNum;
  selectedPlaces = {};
  if (!allDaySelections[dayNum]) allDaySelections[dayNum] = [];

  dayPlanContainer.innerHTML = `
    <div class="flex flex-col gap-4">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-semibold text-white">Day ${dayNum}: ${dayName}</h2>
          <p class="text-gray-400">${dateStr}</p>
        </div>
        <button id="viewAllSlotsBtn" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm">View All Saved</button>
      </div>
      <div class="flex gap-2 flex-nowrap overflow-x-auto mb-4 px-1" id="vibeButtons"></div>
      <div id="savedSummary" class="mb-2 text-gray-200 text-sm"></div>
      <div id="recommendations" class="grid md:grid-cols-2 gap-4"></div>
      <button id="endDayBtn" class="mt-4 px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold w-32 self-start">End Day</button>
    </div>
  `;

  renderVibes();
  updateSavedSummary();

  document.getElementById("viewAllSlotsBtn").addEventListener("click", showAllSavedSlots);
  document.getElementById("endDayBtn").addEventListener("click", () => {
    showToast(`Day ${currentDay} ended! Saved ${allDaySelections[currentDay].length} places.`, "red");
    document.getElementById("recommendations").innerHTML = "";
    selectedPlaces = {};
    updateSavedSummary();
  });
}

// -------------------- Render vibe buttons --------------------
function renderVibes() {
  const vibes = ["Historic", "Foodie", "Beach", "Nature", "Art & Culture", "Shopping", "Nightlife", "Wellness"];
  const vibeContainer = document.getElementById("vibeButtons");
  vibeContainer.innerHTML = "";

  vibes.forEach((vibe) => {
    const btn = document.createElement("button");
    btn.className = "vibe-btn px-3 py-1 text-sm";
    btn.textContent = vibe;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".vibe-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (currentVibe !== vibe) selectedPlaces = {};
      currentVibe = vibe;
      fetchVibePlaces(vibe);
    });
    vibeContainer.appendChild(btn);
  });
}

// -------------------- Fetch places from backend --------------------
async function fetchVibePlaces(vibe) {
  const rec = document.getElementById("recommendations");
  rec.innerHTML = "<p class='text-gray-400'>Loading...</p>";

  if (!shownPlacesPerVibe[vibe]) shownPlacesPerVibe[vibe] = [];

  try {
    const response = await fetch("/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: tripData.city,
        vibe: vibe,
        visited: Object.keys(visitedPlaces),
        bookmarked: Object.keys(bookmarkedPlaces),
        selected: Object.keys(selectedPlaces),
        shown: shownPlacesPerVibe[vibe],
      }),
    });

    const places = await response.json();
    if (!Array.isArray(places)) {
      rec.innerHTML = `<p class="text-red-500">Failed to fetch places. Check backend.</p>`;
      return;
    }

    places.forEach(p => {
      if (!shownPlacesPerVibe[vibe].includes(p.name)) {
        shownPlacesPerVibe[vibe].push(p.name);
      }
    });

    rec.innerHTML = "";
    places.forEach((place) => {
      const isAlreadySelected = !!selectedPlaces[place.name];
      const placeCard = document.createElement("div");
      placeCard.className = "recommendation-card";
      if (isAlreadySelected) {
        placeCard.style.opacity = "0.5";
        placeCard.style.pointerEvents = "none";
      }

      placeCard.innerHTML = `
        <h4 class="font-semibold text-lg">${place.name}</h4>
        <p class="text-gray-300 text-sm mb-2">${place.description}</p>
        <p class="text-gray-400 text-xs mb-3">${place.distance}</p>
        <div class="mt-2 flex gap-2 flex-wrap">
          <button class="select-btn px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm">Select</button>
          <button class="bookmark-btn px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">Bookmark</button>
          <button class="map-btn px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm">Open in Map</button>
        </div>
      `;

      placeCard.querySelector(".select-btn").addEventListener("click", () => {
        selectedPlaces[place.name] = true;
        visitedPlaces[place.name] = true;
        allDaySelections[currentDay].push(place);
        placeCard.style.opacity = "0.5";
        placeCard.style.pointerEvents = "none";
        updateSavedSummary();
        showToast(`Added: ${place.name}`, "green");
        logInteraction(place.name, tripData.city, currentVibe, "itinerary_selected");
      });

      placeCard.querySelector(".bookmark-btn").addEventListener("click", () => {
        bookmarkedPlaces[place.name] = true;
        showToast(`Bookmarked: ${place.name}`, "blue");
        logInteraction(place.name, tripData.city, currentVibe, "saved");
      });

      placeCard.querySelector(".map-btn").addEventListener("click", () => {
        window.open(place.mapUrl, "_blank");
      });

      rec.appendChild(placeCard);
    });
  } catch (err) {
    console.error("Error fetching places:", err);
    rec.innerHTML = `<p class="text-red-500">Failed to fetch recommendations.</p>`;
  }
}
async function logInteraction(name, city, vibe, action) {
  const token = localStorage.getItem('token');
  if (!token) return; // not logged in — skip silently

  try {
    await fetch('/interact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name,
        city,
        vibe,
        action
      })
    });
  } catch (err) {
    console.error('Interaction log failed:', err);
  }
}
// -------------------- Update saved summary --------------------
function updateSavedSummary() {
  const el = document.getElementById("savedSummary");
  if (!el || currentDay == null) return;
  const count = (allDaySelections[currentDay] || []).length;
  el.textContent = count > 0
    ? ` ${count} place(s) saved for Day ${currentDay}`
    : "No selections saved yet for this day";
}

// -------------------- Fetch budget from API --------------------
async function fetchBudgetForDay(city, places) {
  try {
    const response = await fetch("/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, places }),
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Budget fetch error:", err);
    return null;
  }
}

// -------------------- Show all saved slots --------------------
async function showAllSavedSlots() {
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50";
  modal.innerHTML = `
    <div class="bg-gray-900 rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto border border-white/10 shadow-2xl">
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-2xl font-bold text-white"> Your Itinerary</h3>
        <button id="closeModal" class="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
      </div>
      <div id="allSlotsContent">
        <p class="text-gray-400 text-center">Loading your itinerary & budget estimates...</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const content = document.getElementById("allSlotsContent");
  content.innerHTML = "";

  const dayKeys = Object.keys(allDaySelections).sort((a, b) => a - b);

  if (dayKeys.length === 0 || dayKeys.every(k => allDaySelections[k].length === 0)) {
    content.innerHTML = `<p class="text-gray-400 text-center">No places saved yet.</p>`;
  } else {
    // Process each day one by one
    for (const dayNum of dayKeys) {
      const daySlots = allDaySelections[dayNum];
      if (!daySlots || daySlots.length === 0) continue;

      // Create day section with loading budget
      const daySection = document.createElement("div");
      daySection.className = "mb-8";
      daySection.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <h4 class="text-lg font-bold text-white">Day ${dayNum}</h4>
          <span id="budget-day-${dayNum}" class="text-gray-400 font-semibold text-sm bg-white/10 px-3 py-1 rounded-full">
             Estimating budget...
          </span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="day-${dayNum}-list"></div>
      `;
      content.appendChild(daySection);

      // Render place cards
      const dayListContainer = document.getElementById(`day-${dayNum}-list`);
      daySlots.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "bg-white/10 border border-white/15 rounded-xl p-4";
        card.innerHTML = `
          <div class="flex items-start gap-2">
            <span class="text-white/40 font-bold text-sm mt-1">${index + 1}.</span>
            <div class="flex-1">
              <h5 class="font-semibold text-white">${item.name}</h5>
              <p class="text-gray-300 text-sm mt-1">${item.description}</p>
              <p class="text-gray-500 text-xs mt-1">${item.distance}</p>
              <button class="mt-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs" data-url="${item.mapUrl}">
                 Open in Map
              </button>
            </div>
          </div>
        `;
        card.querySelector("button").addEventListener("click", (e) => {
          window.open(e.target.dataset.url, "_blank");
        });
        dayListContainer.appendChild(card);
      });

      // Fetch budget for this day's selected places
      const budget = await fetchBudgetForDay(tripData.city, daySlots);
      const budgetEl = document.getElementById(`budget-day-${dayNum}`);
      if (budget && budget.total) {
        budgetEl.className = "text-green-400 font-semibold text-sm bg-green-900/30 px-3 py-1 rounded-full";
        budgetEl.innerHTML = `
           Est. ₹${budget.total}
          <span class="text-green-300/70 text-xs ml-1">(Entry: ₹${budget.breakdown?.entry || 0} | Food: ₹${budget.breakdown?.food || 0} | Transport: ₹${budget.breakdown?.transport || 0})</span>
        `;
      } else {
        budgetEl.textContent = " Budget unavailable";
      }
    }
  }

  document.getElementById("closeModal").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

// -------------------- Toast messages --------------------
function showToast(message, color = "green") {
  const toast = document.createElement("div");
  toast.className = `fixed top-4 right-4 bg-${color}-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}