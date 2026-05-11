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

async function triggerIndex() {
  try {
    await db
      .collection("appointments")
      .where("clientId", "==", "test")
      .where("status", "in", ["booked", "confirmed"])
      .where("dateTime", ">=", new Date())
      .orderBy("dateTime", "asc")
      .limit(1)
      .get();
    console.log("Query succeeded — index already exists!");
  } catch (err: unknown) {
    const message = (err as Error).message || String(err);
    const urlMatch = message.match(/(https:\/\/console\.firebase\.google\.com\S+)/);
    if (urlMatch) {
      console.log("Open this URL to create the index:\n");
      console.log(urlMatch[1]);
    } else {
      console.error("Error:", message);
    }
  }
  process.exit(0);
}

triggerIndex();
