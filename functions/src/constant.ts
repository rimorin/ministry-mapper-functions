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
  schedule: 'every 5 minutes',
  memory: '512MiB',
} as ScheduleOptions;

export {
  USER_ROLES,
  FB_DEFAULT_CLOUD_REGION,
  ROLE_REMOVE_ACCESS,
  NOTFICATION_TYPE,
  ACCESS_KEY,
  TERRITORY_AGGREGATES_SETTINGS,
};
