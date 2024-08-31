import { getAuth } from 'firebase-admin/auth';
import { App } from 'firebase-admin/app';
import { log, error as errLogger, info } from 'firebase-functions/logger';

export const getCongregationUsers = async (
  app: App,
  congregation: string,
  role?: number
) => {
  let congregationUsers: any = {};
  try {
    const auth = getAuth(app);
    const userResults = await auth.listUsers();
    for (let index = 0; index < userResults.users.length; index++) {
      const user = userResults.users[index];
      if (!user.email) continue;
      const claims = user.customClaims?.congregations ?? {};
      if (!claims) continue;
      if (!claims[congregation]) continue;
      const userRole = Number(claims[congregation]);
      if (role !== undefined && userRole !== role) continue;
      congregationUsers[user.uid] = {
        name: user.displayName,
        email: user.email,
        verified: user.emailVerified,
        role: userRole,
      };
    }
  } catch (error) {
    errLogger(`Error retrieving ${congregation} users. Reason: ${error}`);
    throw error;
  } finally {
    log('congregationUsers:', congregationUsers);
  }
  return congregationUsers;
};

export const getCongregationUsersHelper = async (
  request: any,
  localApp: App
) => {
  let congregationUsers: any = {};
  const congregation = request.data.congregation;
  if (!congregation) {
    log('No congregation provided. Exiting getCongregationUsers...');
    return;
  }
  info(`Getting users for congregation: ${congregation}`);
  try {
    congregationUsers = await getCongregationUsers(localApp, congregation);
  } catch (error) {
    errLogger('Error in getCongUsersHelper:', error);
  }
  return congregationUsers;
};
