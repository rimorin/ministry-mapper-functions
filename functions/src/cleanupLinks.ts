import { App } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { error, info } from 'firebase-functions/logger';

export const cleanUpLinks = async (app: App) => {
  const database = getDatabase(app);
  const dbname = database.app.options.databaseURL;
  info(`Processing Links with RTDB URL: ${dbname}`);
  try {
    const snapshot = await database.ref('links').once('value');
    const updates: { [key: string]: null } = {};
    const currentDate = Date.now();

    snapshot.forEach((linkSnapshot) => {
      const congregation = linkSnapshot.key;
      const congregationLinkSnapshot = linkSnapshot.val();

      for (const id in congregationLinkSnapshot) {
        const link = congregationLinkSnapshot[id];
        const tokenEndtimestamp = Number(link.tokenEndtime);

        if (currentDate > tokenEndtimestamp) {
          updates[`links/${congregation}/${id}`] = null;
        }
      }
    });

    if (Object.keys(updates).length > 0) {
      await database.ref().update(updates);
      info(`Removed expired links in ${dbname}`);
    } else {
      info(`No expired links to remove in ${dbname}`);
    }
  } catch (reason) {
    error(`Error retrieving ${dbname}. Reason: ${reason}`);
  } finally {
    info(`Completed ${dbname} link cleanup job.`);
  }
};
