import { error, info, log } from 'firebase-functions/logger';
import { DataSnapshot, Reference } from 'firebase-admin/database';

const MIN_PERCENTAGE_DISPLAY = 10;
const DEFAULT_MULTPLE_OPTION_DELIMITER = ', ';
const STATUS_CODES = {
  DEFAULT: '-1',
  DONE: '1',
  NOT_HOME: '2',
  STILL_NOT_HOME: '3',
  DO_NOT_CALL: '4',
  INVALID: '5',
};
const COUNTABLE_HOUSEHOLD_STATUS = [
  STATUS_CODES.DONE,
  STATUS_CODES.DEFAULT,
  STATUS_CODES.NOT_HOME,
];

export interface unitDetails {
  number: string;
  note: string;
  type: string;
  status: string;
  nhcount: string;
  dnctime: number;
  sequence?: number;
}

/**
 * Helper function to process address aggregates.
 *
 * @param {any} event - The event object.
 * @returns {Promise<void>} - A promise that resolves when the address aggregates are processed.
 * @throws {Error} - If no address reference is found.
 */
export const processAddressAggregatesHelper = async (event: any) => {
  const { congregation, code } = event.params;
  log(
    `Processing address aggregates for Congregation: ${congregation}, Code: ${code}`
  );

  const addressRef = event.data.after.ref.parent;
  if (!addressRef) throw new Error('No address reference found');
  await processAddressData(congregation, addressRef);
};

export async function processAddressData(
  congregation: string,
  addressRef: Reference
) {
  if (!addressRef) throw new Error('No address reference found');
  if (!congregation) throw new Error('No congregation found');
  const addressValue = await addressRef.once('value');
  if (!addressValue.exists()) {
    error('No address data found. ');
    return;
  }

  const addressDetails = addressValue.val();
  const [congregationOptions, congregationDetails] =
    await fetchCongregationData(addressRef, congregation);

  if (!congregationOptions.exists() || !congregationDetails.exists()) {
    throw new Error('No congregation data found');
  }

  const aggregates = calculateAggregatesData(
    addressDetails,
    congregationOptions,
    congregationDetails
  );

  await updateDatabaseWithAggregates(addressRef, aggregates);
  info(
    `Updated aggregates for ${congregation} - ${addressRef.key} - ${addressDetails.name}`
  );
}

/**
 * Fetches congregation data from the database.
 *
 * @param addressRef - The reference to the address in the database.
 * @param congregation - The name of the congregation.
 * @returns A promise that resolves to an array containing the congregation options and details.
 */
async function fetchCongregationData(
  addressRef: Reference,
  congregation: string
) {
  const congOptionsRef = addressRef.root
    .child(`congregations/${congregation}/options/list`)
    .orderByChild('isCountable')
    .equalTo(true)
    .once('value');

  const congDetailsRef = addressRef.root
    .child(`congregations/${congregation}`)
    .once('value');

  return Promise.all([congOptionsRef, congDetailsRef]);
}

/**
 * Calculates the aggregates data based on the given parameters.
 *
 * @param addressDetails - The address details.
 * @param congregationOptions - The congregation options.
 * @param congregationDetails - The congregation details.
 * @returns An object containing the calculated aggregates data.
 */
function calculateAggregatesData(
  addressDetails: any,
  congregationOptions: DataSnapshot,
  congregationDetails: DataSnapshot
) {
  const countableOptions = Object.keys(congregationOptions.val());
  const { units: unitsData } = addressDetails;
  const {
    maxTries,
    options: { isMultiSelect },
  } = congregationDetails.val();
  const aggregates = calculateAggregates(
    unitsData,
    countableOptions,
    maxTries,
    isMultiSelect
  );
  const completedAggregate = calculateCompletedAggregate(
    aggregates.total,
    aggregates.completed
  );
  const completedDisplay = getCompletedDisplay(completedAggregate);

  return {
    ...aggregates,
    value: completedAggregate,
    display: completedDisplay,
  };
}

/**
 * Updates the database with the provided aggregates for the given address reference.
 *
 * @param {Reference} addressRef - The reference to the address in the database.
 * @param {any} aggregates - The aggregates to update the database with.
 * @returns {Promise<void>} - A promise that resolves when the update is complete.
 */
async function updateDatabaseWithAggregates(
  addressRef: Reference,
  aggregates: any
) {
  await addressRef.update({
    aggregates,
  });
}

/**
 * Calculates aggregates based on the provided units data.
 *
 * @param unitsData - The data containing units information.
 * @param countableOptions - An array of countable options.
 * @param maxTries - The maximum number of tries.
 * @param isMultiselect - A flag indicating whether multiselect is enabled.
 * @returns An object containing the calculated aggregates.
 */
const calculateAggregates = (
  unitsData: any,
  countableOptions: string[],
  maxTries: number,
  isMultiselect: boolean
) => {
  let total = 0;
  let completed = 0;
  let done = 0;
  let notHome = 0;
  let dnc = 0;
  let invalid = 0;

  const isCompleted = (unit: unitDetails) => {
    const tries = parseInt(unit.nhcount as string);
    return (
      unit.status === STATUS_CODES.DONE ||
      (unit.status === STATUS_CODES.NOT_HOME && tries >= maxTries)
    );
  };

  const isCountable = (unit: unitDetails) => {
    if (isMultiselect) {
      const multipleTypes = unit.type.split(DEFAULT_MULTPLE_OPTION_DELIMITER);
      return (
        COUNTABLE_HOUSEHOLD_STATUS.includes(unit.status) &&
        multipleTypes.some((type) => countableOptions.includes(type))
      );
    }
    return (
      COUNTABLE_HOUSEHOLD_STATUS.includes(unit.status) &&
      countableOptions.includes(unit.type)
    );
  };

  for (const [_, units] of Object.entries(unitsData || {})) {
    if (!units) continue;

    for (const [_, unitDetails] of Object.entries(units || {})) {
      if (!unitDetails) continue;

      if (isCountable(unitDetails)) {
        total++;
        if (isCompleted(unitDetails)) completed++;
        if (unitDetails.status === STATUS_CODES.DONE) done++;
        if (unitDetails.status === STATUS_CODES.NOT_HOME) notHome++;
        if (unitDetails.status === STATUS_CODES.DO_NOT_CALL) dnc++;
        if (unitDetails.status === STATUS_CODES.INVALID) invalid++;
      }
    }
  }

  return { total, completed, done, notHome, dnc, invalid };
};

/**
 * Calculates the percentage of completed items based on the total and completed counts.
 *
 * @param total - The total count of items.
 * @param completed - The count of completed items.
 * @returns The percentage of completed items.
 */
export const calculateCompletedAggregate = (
  total: number,
  completed: number
) => {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
};

/**
 * Calculates the display value for a completed aggregate.
 *
 * @param completedAggregate - The completed aggregate value.
 * @returns The display value for the completed aggregate.
 */
export const getCompletedDisplay = (completedAggregate: number) => {
  return completedAggregate > MIN_PERCENTAGE_DISPLAY
    ? `${completedAggregate}%`
    : '';
};
