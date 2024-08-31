import { getDatabase } from 'firebase-admin/database';
import { error as logError, info, warn } from 'firebase-functions/logger';
import { MailerSend, Recipient, EmailParams, Sender } from 'mailersend';
import { NOTFICATION_TYPE, USER_ROLES } from './constant';
import { getCongregationUsers } from './getCongregationUsers';
import { App } from 'firebase-admin/app';

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
    .once('value');

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

export const handleNotifications = async (app: App) => {
  const apiKey = process.env.MAILERSEND_API_KEY;
  info(`Processing notifications. RTDB URL: ${app.options.databaseURL}`);

  if (!apiKey) {
    logError(`MAILERSEND_API_KEY not found. Exiting processNotifications...`);
    return;
  }

  try {
    const database = getDatabase(app);
    const mailersend = new MailerSend({ apiKey });

    const notificationData = await database.ref('notifications').once('value');
    if (!notificationData.exists()) {
      warn(` No notifications found. Exiting processNotifications...`);
      return;
    }

    const notification_list = notificationData.val();

    const promises = Object.values(notification_list).map(
      async (notification: any) => {
        info(`Processing notification: ${JSON.stringify(notification)}`);
        const notificationType = notification.type as number;
        const congregation = notification.congregation as string;
        const postalCode = notification.postalCode as string;
        const fromUser = notification.fromUser as string;
        if (!notificationType || !congregation || !postalCode) {
          warn(
            ` Missing notificationType, congregation, or postalCode. Skipping this notification...`
          );
          return;
        }

        const [congregationUsers, addressData, territory] = await Promise.all([
          getCongregationUsers(
            app,
            congregation,
            notificationType === NOTFICATION_TYPE.FEEDBACK
              ? USER_ROLES.ADMIN
              : USER_ROLES.CONDUCTOR
          ),
          database
            .ref(`addresses/${congregation}/${postalCode}`)
            .once('value')
            .then((snapshot) => snapshot.val()),
          getTerritory(app, congregation, postalCode),
        ]);

        if (Object.keys(congregationUsers).length === 0) {
          warn(
            ` No congregationUsers found for notification: ${JSON.stringify(
              notification
            )}. Removing notification...`
          );
          await database
            .ref(
              `notifications/${congregation}-${postalCode}-${notificationType}`
            )
            .remove();
          return;
        }

        const message = (
          notificationType === NOTFICATION_TYPE.FEEDBACK
            ? addressData.feedback
            : addressData.instructions
        ) as string;

        if (!message) {
          warn(
            ` No message found for notification: ${JSON.stringify(
              notification
            )}. Removing notification...`
          );
          await database
            .ref(
              `notifications/${congregation}-${postalCode}-${notificationType}`
            )
            .remove();
          return;
        }

        const addressName = addressData.name;
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
            ? process.env.FEEDBACK_TEMPLATE_ID || ''
            : process.env.INSTRUCTION_TEMPLATE_ID || '';

        const templateSubject =
          notificationType === NOTFICATION_TYPE.FEEDBACK
            ? `Feedback for ${addressName}`
            : `Instructions for ${addressName}`;
        const emailParams = new EmailParams()
          .setFrom(new Sender('noreply@ministry-mapper.com', 'MM Support'))
          .setTo(recipentData)
          .setSubject(templateSubject)
          .setTemplateId(templateId)
          .setPersonalization(recipentPersonalization);

        try {
          info(
            ` Sending email with parameters: ${JSON.stringify(emailParams)}`
          );
          await mailersend.email.send(emailParams);
          info(` Email sent successfully. Removing notification...`);
          await database
            .ref(
              `notifications/${congregation}-${postalCode}-${notificationType}`
            )
            .remove();
        } catch (error) {
          logError(` Error sending email. Reason: ${JSON.stringify(error)}`);
        }
      }
    );

    await Promise.all(promises);
  } catch (error) {
    logError(
      ` Error in processNotifications. Reason: ${JSON.stringify(error)}`
    );
    throw error;
  } finally {
    info(`Finished processNotifications.`);
  }
};
