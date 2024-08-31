import { getAuth } from 'firebase-admin/auth';
import { info, log, error as errLogger } from 'firebase-functions/logger';
import { ROLE_REMOVE_ACCESS, ACCESS_KEY } from './constant';
import { App } from 'firebase-admin/app';

export const updateUserAccessHelper = async (request: any, localApp: App) => {
  const { uid: userId, congregation, role } = request.data;
  await UpdateUserAccess(localApp, userId, congregation, role);
};

export const UpdateUserAccess = async (
  app: App,
  userId: string,
  congregation: string,
  role: number
) => {
  info(
    `Processing Update User Access with RTDB URL: ${app.options.databaseURL}`
  );

  if (!congregation || !userId || !role) {
    log('Missing required data. Exiting updateUserAccess...');
    return;
  }

  log(
    `Initializing app for user: ${userId}, congregation: ${congregation} and role: ${role}`
  );
  try {
    const auth = getAuth(app);
    const user = await auth.getUser(userId);
    if (!user) {
      log('No user found. Exiting updateUserAccess...');
      return;
    }
    log('User found:', user);

    const currentClaims = user.customClaims?.congregations ?? {};
    const roleValue = Number(role);
    log(`Processing role: ${roleValue}`);

    switch (roleValue) {
      case ROLE_REMOVE_ACCESS:
        log('Removing access...');
        delete currentClaims[congregation];
        break;
      default:
        log('Setting role...');
        currentClaims[congregation] = roleValue;
    }

    log('Setting custom user claims...');
    await auth.setCustomUserClaims(userId, {
      [ACCESS_KEY]: currentClaims,
    });
  } catch (error) {
    errLogger('Error in updateUserAccess:', error);
    throw error;
  }

  log('Finished updateUserAccess');
};
