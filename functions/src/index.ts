import { pubsub, region } from "firebase-functions";
import { App, initializeApp, deleteApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { UserRecord, getAuth } from "firebase-admin/auth";
import {
  FB_DEFAULT_CLOUD_REGION,
  ROLE_REMOVE_ACCESS,
  USER_ROLES,
  NOTFICATION_TYPE,
} from "./constant";
import { EmailParams, MailerSend, Recipient, Sender } from "mailersend";

const sgRegion = region(process.env.LOCAL_RTDB || FB_DEFAULT_CLOUD_REGION);

const cleanUpLinks = (app: App, time: number) => {
  const database = getDatabase(app);
  const dbname = database.app.name;
  console.info(`Running ${dbname} link cleanup job.`);
  database
    .ref("links")
    .once("value")
    .then((snapshot) => {
      snapshot.forEach((linkSnapshot) => {
        const congregation = linkSnapshot.key;
        const congregationLinkSnapshot = linkSnapshot.val();
        for (const id in congregationLinkSnapshot) {
          const link = congregationLinkSnapshot[id];
          const timestamp = link.tokenEndtime;
          const postalcode = link.postalCode;

          console.info(
            `Checking ${dbname} link id: ${congregation}, postalcode: ${postalcode}, timestamp: ${timestamp}`
          );
          if (time > timestamp) {
            database
              .ref(`links/${congregation}/${id}`)
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

const getTerritory = async (
  app: App,
  congregation: string,
  postalCode: string
) => {
  // check null
  if (!congregation || !postalCode) return;

  const database = getDatabase(app);

  // get territory from database using postalcode
  const territories = await database
    .ref(`congregations/${congregation}/territories`)
    .once("value");

  if (!territories.exists()) return;

  const territory_list = territories.val();

  let territoryCode = null;

  for (const index in territory_list) {
    const territory = territory_list[index];
    for (const addressIndex in territory.addresses) {
      const address = territory.addresses[addressIndex];
      if (address === postalCode) {
        territoryCode = index;
        break;
      }
    }
  }

  return territoryCode;
};

const getCongUsers = async (
  app: App,
  congregation: string,
  role: number | undefined = undefined
) => {
  let congregationUsers: any = {};
  try {
    const auth = getAuth(app);
    const userResults = await auth.listUsers();
    for (let index = 0; index < userResults.users.length; index++) {
      const user = userResults.users[index];
      if (!user.email) continue;
      const claims = user.customClaims;
      if (!claims) continue;
      if (!claims[congregation]) continue;
      const userRole = Number(claims[congregation]);
      if (role && userRole !== role) continue;
      congregationUsers[user.uid] = {
        name: user.displayName,
        email: user.email,
        verified: user.emailVerified,
        role: userRole,
      };
    }
  } catch (error) {
    console.error(`Error retrieving ${congregation} users. Reason: ${error}`);
    throw error;
  }
  return congregationUsers;
};

export const getCongregationUsers = sgRegion.https.onCall(
  async (data, context) => {
    let congregationUsers: any = {};
    const congregation = data.congregation;
    if (!congregation) return;

    const app = initializeApp();
    try {
      congregationUsers = await getCongUsers(app, congregation);
    } finally {
      deleteApp(app);
    }
    return congregationUsers;
  }
);

export const getUserByEmail = sgRegion.https.onCall(async (data, context) => {
  let user: UserRecord;
  const email = data.email;
  if (!email) return;

  const app = initializeApp();
  try {
    const auth = getAuth(app);
    user = await auth.getUserByEmail(email);
  } finally {
    deleteApp(app);
  }
  return user;
});

export const updateUserAccess = sgRegion.https.onCall(async (data, context) => {
  const userId = data.uid;
  const congregation = data.congregation;
  const role = data.role;
  if (!congregation || !userId || !role) return;

  const app = initializeApp();
  try {
    const auth = getAuth(app);
    const user = await auth.getUser(userId);
    if (!user) return;
    const currentClaims = user.customClaims || {};
    const roleValue = Number(role);
    switch (roleValue) {
      case ROLE_REMOVE_ACCESS:
        delete currentClaims[congregation];
        break;
      default:
        currentClaims[congregation] = roleValue;
    }
    await auth.setCustomUserClaims(userId, currentClaims);
  } finally {
    deleteApp(app);
  }
});

export const cleanLinksEveryday = pubsub
  .schedule("every 10 minutes")
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

export const triggerNotifications = pubsub
  .schedule("every 10 minutes")
  .onRun((_) => {
    const prodDatabaseURL = process.env.PRODUCTION_RTDB;
    if (prodDatabaseURL)
      processNotifications(
        initializeApp(
          {
            databaseURL: prodDatabaseURL,
          },
          "production"
        )
      );
    const stagingDatabaseURL = process.env.STAGING_RTDB;
    if (stagingDatabaseURL)
      processNotifications(
        initializeApp(
          {
            databaseURL: stagingDatabaseURL,
          },
          "staging"
        )
      );
    const localDatabaseURL = process.env.LOCAL_RTDB;
    if (localDatabaseURL)
      processNotifications(
        initializeApp(
          {
            databaseURL: localDatabaseURL,
          },
          "local"
        )
      );
    return null;
  });

const processNotifications = async (app: App) => {
  if (!process.env.MAILERSEND_API_KEY) return;
  try {
    const database = getDatabase(app);
    const mailersend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });

    const notificationData = await database.ref("notifications").once("value");
    if (!notificationData.exists()) return;

    const notification_list = notificationData.val();

    for (const index in notification_list) {
      const notification = notification_list[index];
      const notificationType = notification.type as number;
      const congregation = notification.congregation as string;
      const postalCode = notification.postalCode as string;
      const fromUser = notification.fromUser as string;
      if (!notificationType || !congregation || !postalCode) continue;

      const addressData = (
        await database
          .ref(`addresses/${congregation}/${postalCode}`)
          .once("value")
      ).val();
      const message = (
        notificationType === NOTFICATION_TYPE.FEEDBACK
          ? addressData.feedback
          : addressData.instructions
      ) as string;

      if (!message) {
        await database
          .ref(
            `notifications/${congregation}-${postalCode}-${notificationType}`
          )
          .remove();
        continue;
      }
      const congregationUsers = await getCongUsers(
        app,
        congregation,
        notificationType === NOTFICATION_TYPE.FEEDBACK
          ? USER_ROLES.ADMIN
          : USER_ROLES.CONDUCTOR
      );

      const territory = await getTerritory(app, congregation, postalCode);

      // get address name from database using postalcode
      const addressName = addressData.name;
      // list out congregationUsers by object with name and email
      const recipentData = Object.keys(congregationUsers).map((key) => {
        return new Recipient(
          congregationUsers[key].email,
          congregationUsers[key].name
        );
      });

      const recipentPersonalization = Object.keys(congregationUsers).map(
        (key) => {
          return {
            email: congregationUsers[key].email,
            data: {
              name: congregationUsers[key].name,
              postal: postalCode,
              address: addressName,
              territory: territory,
              message: message,
              fromUser: fromUser,
            },
          };
        }
      );
      const templateId =
        notificationType === NOTFICATION_TYPE.FEEDBACK
          ? process.env.FEEDBACK_TEMPLATE_ID || ""
          : process.env.INSTRUCTION_TEMPLATE_ID || "";

      const templateSubject =
        notificationType === NOTFICATION_TYPE.FEEDBACK
          ? `Feedback for ${addressName}`
          : `Instructions for ${addressName}`;
      const emailParams = new EmailParams()
        .setFrom(new Sender("noreply@ministry-mapper.com", "MM Support"))
        .setTo(recipentData)
        .setSubject(templateSubject)
        .setTemplateId(templateId)
        .setPersonalization(recipentPersonalization);

      try {
        await mailersend.email.send(emailParams);
        await database
          .ref(
            `notifications/${congregation}-${postalCode}-${notificationType}`
          )
          .remove();
      } catch (error) {
        console.error(`Error sending email. Reason: ${JSON.stringify(error)}`);
      }
    }
  } finally {
    deleteApp(app);
  }
};
