# Cloud Functions for Ministry Mapper

## List of Crons

- cleanLinksEveryday
- processNotifications
- processTerritoryAggregates

## List of Event Functions

- processAddressAggregates

## List of Callable Functions

- getCongregationUsers
- getUserByEmail
- updateUserAccess

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

