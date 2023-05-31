# Cloud Functions for Ministry Mapper

## List of Crons

- cleanLinksEveryday

## List of Functions

- getCongregationUsers
- getUserByEmail
- updateUserAccess

## Environment Settings

- Node 16.19.0
- Firebase tools 11.20.0

## How to deploy function

1. install node 16
2. `npm install -g firebase-tools@11.20.0` to install firebase tools
3. `firebase login` to connect firebase account
4. `firebase init functions` to setup firebase functions environment
5. go to functions folder
6. Setup dotenv file with PRODUCTION_RTDB, STAGING_RTDB or LOCAL_RTDB
7. `npm install` to install libraries
8. `npm run deploy` to deploy function
