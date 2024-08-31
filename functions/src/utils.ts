/**
 * Extracts the instance ID from a given Firebase Realtime Database URL.
 * @param url - The Firebase Realtime Database URL.
 * @returns The instance ID.
 */
const extractInstanceId = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  const regex = /^https:\/\/([^\.]+)\./;
  const match = url.match(regex);
  const instanceId = match ? match[1] : undefined;
  return instanceId;
};

export { extractInstanceId };
