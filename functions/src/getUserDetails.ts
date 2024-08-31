import { App } from 'firebase-admin/app';
import { UserRecord, getAuth } from 'firebase-admin/auth';
import { info, warn, error as errLogger } from 'firebase-functions/logger';

export const getUserByEmailHelper = async (request: any, localApp: App) => {
  let user: UserRecord;
  const email = request.data.email;
  if (!email) {
    warn('No email provided. Exiting getUserByEmail...');
    return;
  }
  info(`Processing getUserByEmail with email: ${email}`);
  try {
    const auth = getAuth(localApp);
    user = await auth.getUserByEmail(email);
    if (!user) {
      warn('No user found. Exiting getUserByEmail...');
      return;
    }
  } catch (error) {
    errLogger('Error in getUserByEmail:', error);
    throw error;
  }
  info('Returning from getUserByEmail with:', user);
  return user;
};
