import { pubsub } from "firebase-functions";
import { App, initializeApp, deleteApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

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

export const cleanLinksEveryday = pubsub
  .schedule("every 5 minutes")
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
