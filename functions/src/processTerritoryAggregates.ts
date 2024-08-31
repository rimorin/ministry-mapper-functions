import { getDatabase } from 'firebase-admin/database';
import {
  calculateCompletedAggregate,
  getCompletedDisplay,
} from './processAddressAggregates';
import { info, log } from 'firebase-functions/logger';
import { App } from 'firebase-admin/app';

export const processTerritoryAggregates = async (app: App) => {
  info(`Processing territory aggregates. RTDB URL: ${app.options.databaseURL}`);
  const database = getDatabase(app);

  const congregationsSnapshot = await database
    .ref('congregations')
    .once('value');
  const congregations = congregationsSnapshot.val();

  if (!congregations) {
    log('No congregations found.');
    return;
  }

  const congregationKeys = Object.keys(congregations);

  for (const congregationKey of congregationKeys) {
    const congregationData = congregations[congregationKey];
    const territories = congregationData.territories;

    if (!territories) {
      log(`No territories found for congregation ${congregationKey}`);
      continue;
    }

    // Fetch addresses in chunks to avoid loading all at once
    const addressSnapshot = await database
      .ref(`addresses/${congregationKey}`)
      .once('value');

    if (!addressSnapshot.exists()) {
      log(`No addresses found for congregation ${congregationKey}`);
      continue;
    }

    const addressData = addressSnapshot.val();
    const territoryUpdates: { [key: string]: any } = {};

    for (const territoryId of Object.keys(territories)) {
      const addresses = territories[territoryId].addresses;

      if (!addresses) {
        continue;
      }

      let territoryTotal = 0;
      let territoryCompleted = 0;

      for (const addressKey of Object.keys(addresses)) {
        const addressCode = addresses[addressKey];
        const aggregateData = addressData[addressCode]?.aggregates || {
          value: 0,
        };
        territoryTotal += 100;
        territoryCompleted += aggregateData.value;
      }

      const territoryAggregate = calculateCompletedAggregate(
        territoryTotal,
        territoryCompleted
      );
      const territoryAggDisplay = getCompletedDisplay(territoryAggregate);

      territoryUpdates[
        `congregations/${congregationKey}/territories/${territoryId}/aggregates`
      ] = {
        value: territoryAggregate,
        display: territoryAggDisplay,
      };
    }

    try {
      // Perform the batch update
      await database.ref().update(territoryUpdates);
      info(`Updated territory aggregates for congregation ${congregationKey}`);
    } catch (error) {
      console.error('Error updating territories in batch update: ', error);
    }
  }

  info('Finished processing territory aggregates.');
};
