document.getElementById("recommendationForm").addEventListener("submit", async (e) => {
    e.preventDefault();
  
    const city = document.getElementById("city").value.trim();
    const radius = document.getElementById("travelRadius").value;
    const vibes = Array.from(document.querySelectorAll("input[name='vibe']:checked")).map(v => v.value);
  
    if (!city || vibes.length === 0) {
      alert("Please enter a city and select at least one vibe.");
      return;
    }
  
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "<p class='text-white'>Loading recommendations...</p>";
  
    try {
      const response = await fetch("/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, radius, vibes })
      });
  
      const data = await response.json();
  
      if (!data || data.length === 0) {
        resultsDiv.innerHTML = "<p class='text-white'>No recommendations found.</p>";
        return;
      }
  
      // Sort by rating descending
      data.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  
      resultsDiv.innerHTML = data.map(p => `
        <div class="recommendation-card">
          <h3 class="text-lg font-semibold text-white mb-1">${p.name}</h3>
          <p class="text-white mb-1">${p.description}</p>
          <p class="text-white mb-1">📍 Distance: ${p.distance || '?'} km</p>
          <p class="text-white mb-1">⭐ Rating: ${p.rating || '?'} / 5</p>
          <p class="text-white mb-2">💰 Estimated Fare: ₹${p.fare || '?'}</p>
          <div class="flex gap-2">
            <a href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}" target="_blank" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm">Open in Maps</a>
            <a 
  href="https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${p.latitude}&dropoff[longitude]=${p.longitude}&dropoff[nickname]=${encodeURIComponent(p.name)}" 
  target="_blank" 
  class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm">
  Book Cab
</a>

          </div>
        </div>
      `).join('');
  
    } catch (err) {
      console.error(err);
      resultsDiv.innerHTML = "<p class='text-white'>Something went wrong. Please try again.</p>";
    }
  });