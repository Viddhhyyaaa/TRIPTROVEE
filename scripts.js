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
let allDaySelections = {}; // dayNumber -> array of selected place objects
// -------------------- Get User Current Location --------------------


    

// -------------------- Plan My Day button --------------------
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

  tripBox.classList.add("hidden");
  plannerContainer.classList.remove("hidden");

  generateDays(start, end);
});

// -------------------- Generate day cards --------------------
function generateDays(start, end) {
  daysContainer.innerHTML = "";
  let dayCounter = 1;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toDateString();
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });

    const card = document.createElement("div");
    card.className = "day-card text-white";
    card.innerHTML = `
      <h3 class="font-semibold">${dayName}</h3>
      <p class="text-sm text-gray-400">${dateStr}</p>
    `;
    card.addEventListener("click", () =>
      selectDay(dayCounter, dayName, dateStr)
    );
    daysContainer.appendChild(card);
    dayCounter++;
  }
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
}

// -------------------- Render vibe buttons --------------------
function renderVibes() {
  const vibes = ["Historic","Foodie","Beach","Nature","Art & Culture","Shopping","Nightlife","Wellness"];
  const vibeContainer = document.getElementById("vibeButtons");
  vibeContainer.innerHTML = "";

  vibes.forEach((vibe) => {
    const btn = document.createElement("button");
    btn.className = "vibe-btn px-3 py-1 text-sm";
    btn.textContent = vibe;
    btn.addEventListener("click", () => {
      if (currentVibe !== vibe) selectedPlaces = {};
      currentVibe = vibe;
      fetchVibePlaces(vibe);
    });
    vibeContainer.appendChild(btn);
  });
}

// -------------------- Fetch 4 places from backend --------------------
async function fetchVibePlaces(vibe) {
  const rec = document.getElementById("recommendations");
  rec.innerHTML = "<p class='text-gray-400'>Loading...</p>";

  try {
    const response = await fetch("/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: tripData.city,
        vibe: vibe,
        visited: Object.keys(visitedPlaces),
        bookmarked: Object.keys(bookmarkedPlaces),
        selected: Object.keys(selectedPlaces),
      }),
    });

    const places = await response.json();
    if (!Array.isArray(places)) {
      rec.innerHTML = `<p class="text-red-500">Failed to fetch places. Check backend.</p>`;
      console.error("Backend returned invalid data:", places);
      return;
    }

    rec.innerHTML = "";
    places.forEach((place) => {
      const placeCard = document.createElement("div");
      placeCard.className = "recommendation-card";

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

      // Select button
      placeCard.querySelector(".select-btn").addEventListener("click", () => {
        selectedPlaces[place.name] = true;
        visitedPlaces[place.name] = true;
        allDaySelections[currentDay].push(place);
        placeCard.style.opacity = "0.5";
        placeCard.style.pointerEvents = "none";
        updateSavedSummary();
      });

      // Bookmark button
      placeCard.querySelector(".bookmark-btn").addEventListener("click", () => {
        bookmarkedPlaces[place.name] = true;
        showToast(`Bookmarked: ${place.name}`, "blue");
      });

      // Map button
      placeCard.querySelector(".map-btn").addEventListener("click", () => {
        window.open(place.mapUrl, "_blank");
      });

      rec.appendChild(placeCard);
    });
  } catch (err) {
    console.error("Error fetching places:", err);
    rec.innerHTML = `<p class="text-red-500">Failed to fetch recommendations.</p>`;
  }

  // End Day button
  document.getElementById("endDayBtn").onclick = () => {
    showToast(`Day ${currentDay} ended! Saved ${allDaySelections[currentDay].length} places.`, "red");
    rec.innerHTML = "";
    selectedPlaces = {};
    updateSavedSummary();
  };
}

// -------------------- Update saved selections summary --------------------
function updateSavedSummary() {
  const el = document.getElementById("savedSummary");
  if (!el || currentDay == null) return;
  const count = (allDaySelections[currentDay] || []).length;
  el.textContent = count > 0 ? `Saved for Day ${currentDay}: ${count} place(s)` : "No selections saved yet";
}

// -------------------- Show all saved slots --------------------
function showAllSavedSlots() {
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold text-white">All Your Saved Places</h3>
        <button id="closeModal" class="text-gray-400 hover:text-white text-2xl">&times;</button>
      </div>
      <div id="allSlotsContent"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const content = document.getElementById("allSlotsContent");
  content.innerHTML = "";

  Object.keys(allDaySelections).forEach((dayNum) => {
    const daySlots = allDaySelections[dayNum];
    if (daySlots && daySlots.length > 0) {
      const daySection = document.createElement("div");
      daySection.className = "mb-6";
      daySection.innerHTML = `
        <h4 class="text-lg font-semibold text-white mb-3">Day ${dayNum}</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="day-${dayNum}-list"></div>
      `;
      content.appendChild(daySection);

      const dayListContainer = document.getElementById(`day-${dayNum}-list`);
      daySlots.forEach((item) => {
        const card = document.createElement("div");
        card.className = "recommendation-card";
        card.innerHTML = `
          <h5 class="font-semibold text-lg">${item.name}</h5>
          <p class="text-sm mb-1">${item.description}</p>
          <p class="text-xs mb-2">${item.distance}</p>
          <button class="px-2 py-1 bg-green-600 text-white rounded text-xs" data-url="${item.mapUrl}">Open in Map</button>
        `;
        card.querySelector("button").addEventListener("click", (e) => {
          window.open(e.target.dataset.url, "_blank");
        });
        dayListContainer.appendChild(card);
      });
    }
  });

  // Close modal
  document.getElementById("closeModal").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

// -------------------- Toast messages --------------------
function showToast(message, color = "green") {
  const toast = document.createElement("div");
  toast.className = `fixed top-4 right-4 bg-${color}-500 text-white px-4 py-2 rounded shadow-lg z-50`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
