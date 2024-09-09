# Cloud Functions for Ministry Mapper

## List of Crons

- cleanLinksEveryday
- processNotifications
- processTerritoryAggregates

### What are Crons?

Crons are scheduled tasks that run at specified intervals. They are typically used for repetitive tasks such as cleaning up data, sending notifications, or processing aggregates. These tasks are automated and run in the background without user intervention.

**Underlying Technology**:

- **Firebase Cloud Functions**: Uses Firebase's `pubsub.schedule` to define and deploy cron jobs.
- **Google Cloud Scheduler**: Can also be used to trigger HTTP endpoints at scheduled times.

## List of Event Functions

- processAddressAggregates

### What are Event Functions?

Event functions are triggered by specific events in your system, such as changes to the database or user actions. These functions respond to events and perform actions based on the event data.

**Underlying Technology**:

- **Google Pub/Sub**: Uses Google Cloud Pub/Sub to publish and subscribe to messages, allowing functions to be triggered by specific events.

## List of Callable Functions

- getCongregationUsers
- getUserByEmail
- updateUserAccess

### What are Callable Functions?

Callable functions are functions that can be called directly by clients, such as web or mobile applications. These functions are typically used to perform operations that require server-side logic, such as fetching user data or updating user access permissions. Callable functions provide a secure way to execute server-side code from the client.

**Underlying Technology**:

- **Firebase Cloud Functions**: Uses `functions.https.onCall` to define functions that can be called directly from the client using Firebase SDK.
- **Google Cloud Functions**: Can also be used to create HTTP endpoints that clients can call.

## Getting Started

1. Install Node 20
2. `npm install -g firebase-tools` to install Firebase CLI
3. `firebase login` to connect Firebase account

## Deployment Script

This script will allow multiple environments to be deployed within a single Firebase project. The script will automatically update the environment variables in the environment files and deploy the functions to the desired environment.

You can use the `deploy.sh` script to deploy functions to different environments. Follow these steps:

1. **Modify the Template File**: Update the template file in the `functions/env/` folder to match your environment. For example, if you are deploying to the staging environment, modify `functions/env/staging.ts`.

2. **Set Environment Variables in `deploy.sh`**: Ensure that the relevant environment variables are set in the `deploy.sh` file. This includes variables like `REGION` and `RTDB_URL` for each environment.

3. **Export Environment Variables**: Ensure that the environment variables are exported in your main `index.ts` file. The `deploy.sh` script will handle this automatically.

### Example

Your `index.ts` file should look like this after running the `deploy.sh` script:

```typescript
import * as localDeployments from "./env/local";
import * as stagingDeployments from "./env/staging";
import * as productionDeployments from "./env/production";

exports.local = localDeployments;
exports.staging = stagingDeployments;
exports.production = productionDeployments;
```

3. **Run the Deployment Script**: Execute the deployment script with the desired environment as an argument.

### Example

To deploy to the local environment:

```sh
./deploy.sh local
```
