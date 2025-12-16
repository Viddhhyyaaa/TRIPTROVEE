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
  allDaySelections = {};

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
  currentVibe = null;

  if (!allDaySelections[dayNum]) allDaySelections[dayNum] = [];

  dayPlanContainer.innerHTML = `
    <div class="flex flex-col gap-4">
      <div>
        <h2 class="text-2xl font-semibold text-white">Day ${dayNum}: ${dayName}</h2>
        <p class="text-gray-400">${dateStr}</p>
      </div>

      <div class="flex gap-2 overflow-x-auto" id="vibeButtons"></div>

      <div id="savedSummary" class="text-gray-300 text-sm"></div>

      <div id="recommendations" class="grid md:grid-cols-2 gap-4"></div>
    </div>
  `;

  renderVibes();
  updateSavedSummary();
}

// -------------------- Render vibe buttons --------------------
function renderVibes() {
  const vibes = [
    "Historic",
    "Foodie",
    "Beach",
    "Nature",
    "Art & Culture",
    "Shopping",
    "Nightlife",
    "Wellness",
  ];

  const vibeContainer = document.getElementById("vibeButtons");
  vibeContainer.innerHTML = "";

  vibes.forEach((vibe) => {
    const btn = document.createElement("button");
    btn.className = "vibe-btn px-3 py-1 bg-purple-600 text-white rounded text-sm";
    btn.textContent = vibe;

    btn.addEventListener("click", () => {
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

  try {
    const response = await fetch("/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: tripData.city,
        vibes: [vibe], // ✅ VERY IMPORTANT
      }),
    });

    const places = await response.json();

    if (!Array.isArray(places)) {
      rec.innerHTML = `<p class="text-red-500">Invalid response from server</p>`;
      console.error("Backend response:", places);
      return;
    }

    rec.innerHTML = "";

    places.forEach((place) => {
      const placeCard = document.createElement("div");
      placeCard.className = "recommendation-card bg-gray-800 p-4 rounded";

      placeCard.innerHTML = `
        <h4 class="font-semibold text-lg text-white">${place.name}</h4>
        <p class="text-gray-300 text-sm mb-2">${place.description}</p>
        <p class="text-gray-400 text-xs mb-3">${place.distance}</p>

        <div class="flex gap-2">
          <button class="select-btn bg-green-600 text-white px-3 py-1 rounded text-sm">Select</button>
          <button class="map-btn bg-orange-600 text-white px-3 py-1 rounded text-sm">Map</button>
        </div>
      `;

      // Select
      placeCard.querySelector(".select-btn").onclick = () => {
        allDaySelections[currentDay].push(place);
        visitedPlaces[place.name] = true;
        placeCard.style.opacity = "0.5";
        placeCard.style.pointerEvents = "none";
        updateSavedSummary();
      };

      // Map
      placeCard.querySelector(".map-btn").onclick = () => {
        window.open(place.mapUrl, "_blank");
      };

      rec.appendChild(placeCard);
    });

  } catch (err) {
    console.error(err);
    rec.innerHTML = `<p class="text-red-500">Failed to fetch recommendations</p>`;
  }
}

// -------------------- Update saved summary --------------------
function updateSavedSummary() {
  const el = document.getElementById("savedSummary");
  if (!el || currentDay == null) return;

  const count = allDaySelections[currentDay].length;
  el.textContent =
    count > 0
      ? `Saved for Day ${currentDay}: ${count} place(s)`
      : "No places saved yet";
}
