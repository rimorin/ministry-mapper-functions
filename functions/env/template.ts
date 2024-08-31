import { initializeApp } from 'firebase-admin/app';
import { cleanUpLinks } from '../src/cleanupLinks';
import { handleNotifications } from '../src/processNotifications';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { processTerritoryAggregates } from '../src/processTerritoryAggregates';
import { onCall } from 'firebase-functions/v2/https';
import { updateUserAccessHelper } from '../src/updateUserAccess';
import { getCongregationUsersHelper } from '../src/getCongregationUsers';
import { getUserByEmailHelper } from '../src/getUserDetails';
import { processAddressAggregatesHelper } from '../src/processAddressAggregates';
import { onValueUpdated } from 'firebase-functions/v2/database';
import { extractInstanceId } from '../src/utils';

const REGION = '';
const RTDB_URL = '';
const CALLABLE_OPTIONS = {
  region: REGION,
};

const INSTANCE_ID = extractInstanceId(RTDB_URL);

const app = initializeApp(
  {
    databaseURL: RTDB_URL,
  },
  INSTANCE_ID
);

exports.processAddressAggregates = onValueUpdated(
  {
    ref: '/addresses/{congregation}/{code}/delta',
    region: REGION,
    instance: INSTANCE_ID,
  },
  async (event) => await processAddressAggregatesHelper(event)
);

exports.linkCleanup = onSchedule('every 30 minutes', () => cleanUpLinks(app));
exports.processNotifications = onSchedule('every 30 minutes', () =>
  handleNotifications(app)
);
exports.processTerritoryAggregates = onSchedule('every 5 minutes', () =>
  processTerritoryAggregates(app)
);
exports.updateUserAccess = onCall(CALLABLE_OPTIONS, (request) =>
  updateUserAccessHelper(request, app)
);

exports.getCongregationUsers = onCall(CALLABLE_OPTIONS, async (request) =>
  getCongregationUsersHelper(request, app)
);

exports.getUserByEmail = onCall(CALLABLE_OPTIONS, async (request) =>
  getUserByEmailHelper(request, app)
);
