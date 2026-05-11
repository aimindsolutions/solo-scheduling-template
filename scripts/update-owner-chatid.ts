import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();

async function update() {
  // Get the owner's chat ID from the first client with a telegramChatId
  // You can change this to a specific chat ID
  const ownerChatId = process.argv[2];
  if (!ownerChatId) {
    console.error("Usage: npx tsx scripts/update-owner-chatid.ts <chatId>");
    process.exit(1);
  }

  await db.doc("businessConfig/main").update({
    ownerTelegramChatId: ownerChatId,
  });

  console.log(`Set ownerTelegramChatId to ${ownerChatId}`);
  process.exit(0);
}

update().catch(console.error);
