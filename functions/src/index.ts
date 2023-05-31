import { pubsub, region } from "firebase-functions";
import { App, initializeApp, deleteApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { UserRecord, getAuth } from "firebase-admin/auth";
import { FB_DEFAULT_CLOUD_REGION, ROLE_REMOVE_ACCESS } from "./constant";

const sgRegion = region(process.env.LOCAL_RTDB || FB_DEFAULT_CLOUD_REGION);

const cleanUpLinks = (app: App, time: number) => {
  const database = getDatabase(app);
  const dbname = database.app.name;
  console.info(`Running ${dbname} link cleanup job.`);
  database
    .ref("links")
    .once("value")
    .then((snapshot) => {
      snapshot.forEach((idSnapshot) => {
        const id = idSnapshot.key;
        const link = idSnapshot.val();
        let timestamp = link;
        let postalcode = "unknown";
        if (typeof link === "object") {
          timestamp = link.tokenEndtime;
          postalcode = link.postalCode;
        }
        console.info(
          `Checking ${dbname} link id: ${id}, postalcode: ${postalcode}, timestamp: ${timestamp}`
        );
        if (time > timestamp) {
          database
            .ref(`links/${id}/`)
            .remove()
            .then(() => {
              console.info(`Removed expired ${dbname} link id : ${id}`);
            })
            .catch((reason) => {
              console.error(
                `Error when removing ${dbname} link id : ${id}. Reason: ${reason}`
              );
            });
        }
      });
    })
    .catch((reason) => {
      console.error(`Error retrieving ${dbname}. Reason: ${reason}`);
    })
    .finally(() => {
      console.info(`Completed ${dbname} link cleanup job.`);
      deleteApp(app);
    });
};

export const getCongregationUsers = sgRegion.https.onCall(
  async (data, context) => {
    let congregationUsers: any = {};
    const congregation = data.congregation;
    if (!congregation) return;

    const app = initializeApp();
    try {
      const auth = getAuth(app);
      const userResults = await auth.listUsers();
      for (let index = 0; index < userResults.users.length; index++) {
        const user = userResults.users[index];
        if (!user.email) continue;
        const claims = user.customClaims;
        if (!claims) continue;
        if (!claims[congregation]) continue;
        congregationUsers[user.uid] = {
          name: user.displayName,
          email: user.email,
          verified: user.emailVerified,
          role: Number(claims[congregation]),
        };
      }
    } finally {
      deleteApp(app);
    }
    return congregationUsers;
  }
);

export const getUserByEmail = sgRegion.https.onCall(async (data, context) => {
  let user: UserRecord;
  const email = data.email;
  if (!email) return;

  const app = initializeApp();
  try {
    const auth = getAuth(app);
    user = await auth.getUserByEmail(email);
  } finally {
    deleteApp(app);
  }
  return user;
});

export const updateUserAccess = sgRegion.https.onCall(async (data, context) => {
  const userId = data.uid;
  const congregation = data.congregation;
  const role = data.role;
  if (!congregation || !userId || !role) return;

  const app = initializeApp();
  try {
    const auth = getAuth(app);
    const user = await auth.getUser(userId);
    if (!user) return;
    const currentClaims = user.customClaims || {};
    const roleValue = Number(role);
    switch (roleValue) {
      case ROLE_REMOVE_ACCESS:
        delete currentClaims[congregation];
        break;
      default:
        currentClaims[congregation] = roleValue;
    }
    await auth.setCustomUserClaims(userId, currentClaims);
  } finally {
    deleteApp(app);
  }
});

export const cleanLinksEveryday = pubsub
  .schedule("every 10 minutes")
  .onRun((_) => {
    const currentTimestamp = new Date().getTime();
    const prodDatabaseURL = process.env.PRODUCTION_RTDB;
    if (prodDatabaseURL)
      cleanUpLinks(
        initializeApp(
          {
            databaseURL: prodDatabaseURL,
          },
          "production"
        ),
        currentTimestamp
      );
    const stagingDatabaseURL = process.env.STAGING_RTDB;
    if (stagingDatabaseURL)
      cleanUpLinks(
        initializeApp(
          {
            databaseURL: stagingDatabaseURL,
          },
          "staging"
        ),
        currentTimestamp
      );
    const localDatabaseURL = process.env.LOCAL_RTDB;
    if (localDatabaseURL)
      cleanUpLinks(
        initializeApp(
          {
            databaseURL: localDatabaseURL,
          },
          "local"
        ),
        currentTimestamp
      );
    return null;
  });
