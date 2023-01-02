import * as admin from "firebase-admin";

export const cleanUpLinks = async (database: database.Database, time: number) => {
  var promises = [];
  const dbname = database.app.name;
  console.info(`Running ${dbname} link cleanup job.`);
  await database
    .ref("links")
    .once("value")
    .then(async (snapshot) => {
      snapshot.forEach((idSnapshot) => {
        const id = idSnapshot.key;
        const link = idSnapshot.val();
        var timestamp;
        var postalcode;
        if (typeof link === 'number') {
            timestamp = link;
            postalcode = 'unknown';
        } else {
            timestamp = link.tokenEndtime;
            postalcode = link.postalCode;
        }
        const strtimestamp = new Date(timestamp).toLocaleString();
        console.info(
          `Checking ${dbname} link id: ${id}, postalcode: ${postalcode}, timestamp: ${strtimestamp}`
        );
        if (time > timestamp) {
          promises.push(database
            .ref(`links/${id}/`)
            .remove()
            .then(() => {
              console.info(`Removed expired ${dbname} link id : ${id}`);
            })
            .catch((reason) => {
              console.error(
                `Error when removing ${dbname} link id : ${id}. Reason: ${reason}`
              );
            })
          );
        }
      });
      await Promise.all(promises);
    })
    .catch((reason) => {
      console.error(`Error retrieving ${dbname}. Reason: ${reason}`);
    })
    .finally(() => {
      console.info(`Completed ${dbname} link cleanup job.`);
    });
};
