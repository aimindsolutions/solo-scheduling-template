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

const projectId = process.env.FIREBASE_PROJECT_ID;

async function createIndex() {
  const accessToken = await (app.options.credential as { getAccessToken: () => Promise<{ access_token: string }> }).getAccessToken();

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/appointments/indexes`;

  const body = {
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "clientId", order: "ASCENDING" },
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "dateTime", order: "ASCENDING" },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (res.ok) {
    console.log("Index creation started:", data.name);
    console.log("It may take a few minutes to build.");
  } else {
    if (data.error?.message?.includes("already exists")) {
      console.log("Index already exists.");
    } else {
      console.error("Failed to create index:", data);
    }
  }

  process.exit(0);
}

createIndex();
