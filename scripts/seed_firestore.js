const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, Timestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAmm0JLX7uATj-Xtw6tHK0Gs8LLljk21XM",
  authDomain: "keepinitreal-ee191.firebaseapp.com",
  projectId: "keepinitreal-ee191",
  storageBucket: "keepinitreal-ee191.firebasestorage.app",
  messagingSenderId: "322946442988",
  appId: "1:322946442988:web:e4534233e401a6b941e7c9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

async function seed() {
  console.log('--- Starting Firestore Seeding ---');

  // 1. Seed Videos
  const videosPath = path.join(__dirname, '../public/videos.json');
  if (fs.existsSync(videosPath)) {
    const rawVideos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
    console.log(`Found ${rawVideos.length} videos in videos.json.`);

    const existingVideosSnap = await getDocs(collection(db, 'site_videos'));
    if (existingVideosSnap.empty) {
      console.log('Seeding site_videos collection...');
      for (let i = 0; i < rawVideos.length; i++) {
        const item = rawVideos[i];
        const youtubeId = item.id || extractYouTubeId(item.url || item.embedUrl || '');
        if (!youtubeId) continue;

        const docData = {
          title: item.title || "Keepin' It Real Episode",
          youtubeId: youtubeId,
          order: i + 1,
          createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, 'site_videos'), docData);
        console.log(`[${i + 1}/${rawVideos.length}] Added video: ${docData.title} (${docRef.id})`);
      }
      console.log('site_videos seeding complete!');
    } else {
      console.log(`site_videos already contains ${existingVideosSnap.size} documents. Skipping seed.`);
    }
  }

  // 2. Seed Merch
  const merchPath = path.join(__dirname, '../public/merch.json');
  if (fs.existsSync(merchPath)) {
    const rawMerch = JSON.parse(fs.readFileSync(merchPath, 'utf8'));
    console.log(`Found ${rawMerch.length} items in merch.json.`);

    const existingMerchSnap = await getDocs(collection(db, 'site_merch'));
    if (existingMerchSnap.empty) {
      console.log('Seeding site_merch collection...');
      for (let i = 0; i < rawMerch.length; i++) {
        const item = rawMerch[i];
        const docData = {
          title: item.name || item.title || 'Merch Item',
          price: item.price,
          imageUrl: item.imageUrl || '/merch-polo.jpg',
          order: i + 1,
          hasSizes: !!item.hasSizes,
          description: item.description || "Official Keepin' It Real Gear. Shipping included.",
          businessEmail: item.businessEmail || 'gary@lisaslight.com',
          createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, 'site_merch'), docData);
        console.log(`[${i + 1}/${rawMerch.length}] Added merch: ${docData.title} (${docRef.id})`);
      }
      console.log('site_merch seeding complete!');
    } else {
      console.log(`site_merch already contains ${existingMerchSnap.size} documents. Skipping seed.`);
    }
  }

  console.log('--- Firestore Seeding Finished ---');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
