import { ScheduleOptions } from 'firebase-functions/v2/scheduler';

const USER_ROLES = { READONLY: 1, CONDUCTOR: 2, ADMIN: 3 };
// Default to Singapore region
const FB_DEFAULT_CLOUD_REGION = 'asia-southeast1';
const ROLE_REMOVE_ACCESS = -1;

const FEEDBACK_ID = 1;
const INSTRUCTIONS_ID = 2;
const NOTFICATION_TYPE = {
  FEEDBACK: FEEDBACK_ID,
  INSTRUCTIONS: INSTRUCTIONS_ID,
};

const ACCESS_KEY = 'congregations';

const TERRITORY_AGGREGATES_SETTINGS = {
  // Every every hour from 1am to 1pm UTC (9am to 9pm SGT)
  schedule: '0 1-13 * * *',
  memory: '512MiB',
  timeoutSeconds: 600,
} as ScheduleOptions;

// Tolerance for cron job to run
const TERRITORY_CRON_TOLERANCE_SECONDS = 10;

export {
  USER_ROLES,
  FB_DEFAULT_CLOUD_REGION,
  ROLE_REMOVE_ACCESS,
  NOTFICATION_TYPE,
  ACCESS_KEY,
  TERRITORY_AGGREGATES_SETTINGS,
  TERRITORY_CRON_TOLERANCE_SECONDS,
};
