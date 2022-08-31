import { pubsub } from "firebase-functions";
import { database, initializeApp } from "firebase-admin";

const productionAdmin = initializeApp(
  {
    databaseURL: process.env.PRODUCTION_RTDB,
  },
  "production"
);
const production_rtdb = productionAdmin.database();

const stagingAdmin = initializeApp(
  {
    databaseURL: process.env.STAGING_RTDB,
  },
  "staging"
);
const staging_rtdb = stagingAdmin.database();

const cleanUpLinks = (database: database.Database, time: number) => {
  const dbname = database.app.name;
  console.info(`Running ${dbname} link cleanup job.`);
  database
    .ref("links")
    .once("value")
    .then((snapshot) => {
      snapshot.forEach((idSnapshot) => {
        const id = idSnapshot.key;
        const timestamp = idSnapshot.val();
        console.info(
          `Checking ${dbname} link id: ${id}, timestamp: ${timestamp}`
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
    });
};

export const cleanLinksEveryday = pubsub
  .schedule("every 5 minutes")
  .onRun((_) => {
    const currentTimestamp = new Date().getTime();
    cleanUpLinks(staging_rtdb, currentTimestamp);
    cleanUpLinks(production_rtdb, currentTimestamp);
    return null;
  });
