import { getDatabase } from 'firebase-admin/database';
import {
  calculateCompletedAggregate,
  getCompletedDisplay,
} from './processAddressAggregates';
import { info, log } from 'firebase-functions/logger';
import { App } from 'firebase-admin/app';
import * as cronp from 'cron-parser';
import {
  TERRITORY_AGGREGATES_SETTINGS,
  TERRITORY_CRON_TOLERANCE_SECONDS,
} from './constant';

export const processTerritoryAggregates = async (
  app: App,
  congregationList?: string[]
) => {
  info(`Processing territory aggregates. RTDB URL: ${app.options.databaseURL}`);
  const database = getDatabase(app);

  const intervalInSeconds = getIntervalInSeconds();
  const dateStart = new Date().getTime() - intervalInSeconds * 1000;
  const congregationsSnapshot = await database
    .ref('congregations')
    .orderByChild('updatedDate')
    .startAt(dateStart)
    .once('value');

  const congregations = congregationsSnapshot.val();

  if (!congregations) {
    log('No congregations found.');
    return;
  }

  let congregationKeys = Object.keys(congregations);

  if (congregationList && congregationList.length > 0) {
    congregationKeys = congregationKeys.filter((key) =>
      congregationList.includes(key)
    );
  }

  for (const congregationKey of congregationKeys) {
    const congregationData = congregations[congregationKey];
    const territories = congregationData.territories;

    if (!territories) {
      log(`No territories found for congregation ${congregationKey}`);
      continue;
    }

    const territoryUpdates: { [key: string]: any } = {};

    for (const territoryId of Object.keys(territories)) {
      const addresses = territories[territoryId].addresses;

      if (!addresses) {
        continue;
      }

      let territoryTotal = 0;
      let territoryCompleted = 0;

      const addressPromises = Object.keys(addresses).map(async (addressKey) => {
        const addressCode = addresses[addressKey];
        const addressAggregatesSnapshot = await database
          .ref(`addresses/${congregationKey}/${addressCode}/aggregates`)
          .once('value');
        const aggregateData = addressAggregatesSnapshot.exists()
          ? addressAggregatesSnapshot.val()
          : { value: 0 };
        return { addressCode, aggregateData };
      });

      const addressResults = await Promise.all(addressPromises);

      addressResults.forEach(({ aggregateData }) => {
        territoryTotal += 100;
        territoryCompleted += aggregateData.value;
      });

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

const getIntervalInSeconds = () => {
  const interval = cronp.parseExpression(
    TERRITORY_AGGREGATES_SETTINGS.schedule
  );

  // Get the first two occurrences to calculate the difference
  const firstOccurrence = interval.next();
  const secondOccurrence = interval.next();

  // Calculate the difference in seconds between two cron job occurrences
  const differenceInSeconds =
    (secondOccurrence.getTime() - firstOccurrence.getTime()) / 1000;

  // Add a tolerance to the difference to ensure the cron job runs successfully. This is to account for any latency or delay in the execution of the cron job.
  return differenceInSeconds + TERRITORY_CRON_TOLERANCE_SECONDS;
};
