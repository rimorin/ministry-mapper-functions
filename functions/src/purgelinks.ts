import * as admin from 'firebase-admin';
import { cleanUpLinks } from './common';

const app = admin.initializeApp({
  "databaseURL": process.env.PRODUCTION_RTDB
});

const currentTimestamp = new Date().getTime();
cleanUpLinks(app.database(), currentTimestamp)
  .then(() => {
    app.delete();
});
