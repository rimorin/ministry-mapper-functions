# Cronjobs for Ministry Mapper

## List of Crons

- cleanUpLinks

## Command Line Activation

- export PRODUCTION\_RTDB=https://sample-rtdb.firebaseio.com/
- export GOOGLE\_APPLICATION\_CREDENTIALS=cert.json
- npx tsx src/purgelinks.ts
