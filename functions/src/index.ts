import { pubsub } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getDatabase, Database } from "firebase-admin/database";

const cleanUpLinks = (database: Database, time: number) => {
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
    cleanUpLinks(
      getDatabase(
        initializeApp(
          {
            databaseURL: process.env.PRODUCTION_RTDB,
          },
          "production"
        )
      ),
      currentTimestamp
    );
    cleanUpLinks(
      getDatabase(
        initializeApp(
          {
            databaseURL: process.env.STAGING_RTDB,
          },
          "staging"
        )
      ),
      currentTimestamp
    );
    cleanUpLinks(
      getDatabase(
        initializeApp(
          {
            databaseURL: process.env.LOCAL_RTDB,
          },
          "local"
        )
      ),
      currentTimestamp
    );
    return null;
  });
