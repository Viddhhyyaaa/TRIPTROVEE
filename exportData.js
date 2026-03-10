require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('./model/user');

async function exportInteractions() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const users = await User.find({});

  let csv = 'user_id,place_name,city,vibe,rating\n';
  let totalRows = 0;
  
  users.forEach(user => {
    // Export from interactions array
    user.interactions.forEach(interaction => {
      const placeName = (interaction.name || interaction.place_name || '').replace(/,/g, ' ');
      const city = (interaction.city || '').replace(/,/g, ' ');
      const vibe = (interaction.vibe || '').replace(/,/g, ' ');
      const rating = interaction.rating || 3;
      
      if (placeName) {
        csv += `${user._id},${placeName},${city},${vibe},${rating}\n`;
        totalRows++;
      }
    });

    // Export from saved_places array as rating 5
    user.saved_places.forEach(place => {
      const placeName = (place.name || '').replace(/,/g, ' ');
      const city = (place.city || '').replace(/,/g, ' ');
      const vibe = (place.vibe || '').replace(/,/g, ' ');
      
      if (placeName) {
        csv += `${user._id},${placeName},${city},${vibe},5\n`;
        totalRows++;
      }
    });
  });

  fs.writeFileSync('interact_real.csv', csv);
  console.log(`✅ Exported ${totalRows} interactions from ${users.length} users`);
  console.log('✅ File saved as interact_real.csv');
  
  await mongoose.disconnect()
}

exportInteractions().catch(console.error);