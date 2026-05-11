import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

async function seed() {
  await db.doc("businessConfig/main").set({
    businessName: "Manicure Irina Udavikhina",
    serviceName: "Manicure",
    defaultDurationMinutes: 90,
    timezone: "Europe/Kyiv",
    jurisdiction: "UA",
    languages: ["uk", "en"],
    ownerEmail: "aimindsolutions@gmail.com",
    workingHours: {
      monday: { start: "09:00", end: "18:00" },
      tuesday: { start: "09:00", end: "18:00" },
      wednesday: { start: "09:00", end: "18:00" },
      thursday: { start: "09:00", end: "18:00" },
      friday: { start: "09:00", end: "17:00" },
      saturday: null,
      sunday: null,
    },
    breakSlots: [{ start: "13:00", end: "14:00" }],
  });

  console.log("Business config seeded successfully");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Failed to seed:", err);
  process.exit(1);
});
