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
  console.log("cleanUpLinks called with time:", time);

  const database = getDatabase(app);
  const dbname = database.app.name;
  console.info(`Running ${dbname} link cleanup job.`);
  database
    .ref("links")
    .once("value")
    .then((snapshot) => {
      console.log("Received snapshot from database");
      snapshot.forEach((linkSnapshot) => {
        const congregation = linkSnapshot.key;
        const congregationLinkSnapshot = linkSnapshot.val();
        console.log(`Processing congregation: ${congregation}`);
        for (const id in congregationLinkSnapshot) {
          const link = congregationLinkSnapshot[id];
          const timestamp = link.tokenEndtime;
          const postalcode = link.postalCode;

          console.info(
            `Checking ${dbname} link id: ${congregation}, postalcode: ${postalcode}, timestamp: ${timestamp}`
          );
          if (time > timestamp) {
            console.log(`Link ${id} is expired. Removing...`);
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
          } else {
            console.log(`Link ${id} is not expired. Skipping...`);
          }
        }
      });
    })
    .catch((reason) => {
      console.error(`Error retrieving ${dbname}. Reason: ${reason}`);
    })
    .finally(() => {
      console.info(`Completed ${dbname} link cleanup job.`);
      console.log("Deleting app...");
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
    console.log("getCongregationUsers called with data:", data);

    let congregationUsers: any = {};
    const congregation = data.congregation;
    if (!congregation) {
      console.log("No congregation provided. Exiting getCongregationUsers...");
      return;
    }

    console.log(`Initializing app for congregation: ${congregation}`);
    const app = initializeApp();
    try {
      console.log("Calling getCongUsers...");
      congregationUsers = await getCongUsers(app, congregation);
      console.log(
        "getCongUsers returned:",
        Object.keys(congregationUsers).length
      );
    } catch (error) {
      console.error("Error in getCongUsers:", error);
    } finally {
      console.log("Deleting app...");
      deleteApp(app);
    }
    console.log(
      "Returning from getCongregationUsers with:",
      Object.keys(congregationUsers).length
    );
    return congregationUsers;
  }
);

export const getUserByEmail = sgRegion.https.onCall(async (data, context) => {
  console.log("getUserByEmail called with data:", data);

  let user: UserRecord;
  const email = data.email;
  if (!email) {
    console.log("No email provided. Exiting getUserByEmail...");
    return;
  }

  console.log(`Initializing app for email: ${email}`);
  const app = initializeApp();
  try {
    console.log("Getting auth...");
    const auth = getAuth(app);
    console.log("Getting user by email...");
    user = await auth.getUserByEmail(email);
    if (!user) {
      console.log("No user found. Exiting getUserByEmail...");
      return;
    }
    console.log("User found:", user);
  } finally {
    console.log("Deleting app...");
    deleteApp(app);
  }
  console.log("Returning from getUserByEmail with:", user);
  return user;
});

export const updateUserAccess = sgRegion.https.onCall(async (data, context) => {
  console.log("updateUserAccess called with data:", data);

  const userId = data.uid;
  const congregation = data.congregation;
  const role = data.role;
  if (!congregation || !userId || !role) {
    console.log("Missing required data. Exiting updateUserAccess...");
    return;
  }

  console.log(
    `Initializing app for user: ${userId} and congregation: ${congregation}`
  );
  const app = initializeApp();
  try {
    console.log("Getting auth...");
    const auth = getAuth(app);
    console.log("Getting user...");
    const user = await auth.getUser(userId);
    if (!user) {
      console.log("No user found. Exiting updateUserAccess...");
      return;
    }
    console.log("User found:", user);
    const currentClaims = user.customClaims || {};
    const roleValue = Number(role);
    console.log(`Processing role: ${roleValue}`);
    switch (roleValue) {
      case ROLE_REMOVE_ACCESS:
        console.log("Removing access...");
        delete currentClaims[congregation];
        break;
      default:
        console.log("Setting role...");
        currentClaims[congregation] = roleValue;
    }
    console.log("Setting custom user claims...");
    await auth.setCustomUserClaims(userId, currentClaims);
  } finally {
    console.log("Deleting app...");
    deleteApp(app);
  }
  console.log("Finished updateUserAccess");
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
  console.log("Starting processNotifications...");
  if (!process.env.MAILERSEND_API_KEY) {
    console.log(
      "MAILERSEND_API_KEY not found. Exiting processNotifications..."
    );
    return;
  }
  try {
    const database = getDatabase(app);
    const mailersend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });

    const notificationData = await database.ref("notifications").once("value");
    if (!notificationData.exists()) {
      console.log("No notifications found. Exiting processNotifications...");
      return;
    }

    const notification_list = notificationData.val();

    for (const index in notification_list) {
      const notification = notification_list[index];
      console.log(`Processing notification: ${JSON.stringify(notification)}`);
      const notificationType = notification.type as number;
      const congregation = notification.congregation as string;
      const postalCode = notification.postalCode as string;
      const fromUser = notification.fromUser as string;
      if (!notificationType || !congregation || !postalCode) {
        console.log(
          "Missing notificationType, congregation, or postalCode. Skipping this notification..."
        );
        continue;
      }

      const congregationUsers = await getCongUsers(
        app,
        congregation,
        notificationType === NOTFICATION_TYPE.FEEDBACK
          ? USER_ROLES.ADMIN
          : USER_ROLES.CONDUCTOR
      );

      if (Object.keys(congregationUsers).length === 0) {
        console.log(
          `No congregationUsers found for notification: ${JSON.stringify(
            notification
          )}. Removing notification...`
        );
        await database
          .ref(
            `notifications/${congregation}-${postalCode}-${notificationType}`
          )
          .remove();
        continue;
      }

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
        console.log(
          `No message found for notification: ${JSON.stringify(
            notification
          )}. Removing notification...`
        );
        await database
          .ref(
            `notifications/${congregation}-${postalCode}-${notificationType}`
          )
          .remove();
        continue;
      }

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
        console.log(
          `Sending email with parameters: ${JSON.stringify(emailParams)}`
        );
        await mailersend.email.send(emailParams);
        console.log("Email sent successfully. Removing notification...");
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
    console.log("Deleting app...");
    deleteApp(app);
    console.log("Finished processNotifications.");
  }
};
