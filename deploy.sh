#!/bin/bash

# Define RTDB URLs as variables
RTDB_URL_LOCAL=""
RTDB_URL_STAGING=""
RTDB_URL_PRODUCTION=""

# Define RTDB location
REGION="asia-southeast1"

# Mailersend API key
MAILERSEND_API_KEY=""

# Function to update .env file.
update_env() {
  local env=$1
  local env_file="functions/.env"

  echo "Updating .env file"

  # Check if the .env file exists
  if [ ! -f "$env_file" ]; then
    echo "Error: ${env_file} does not exist."
    exit 1
  fi

  # Update the .env file
  sed -i '' "s|^MAILERSEND_API_KEY=.*|MAILERSEND_API_KEY=$MAILERSEND_API_KEY|" "$env_file" && echo "Set MAILERSEND_API_KEY in $env_file"

  echo "MAILERSEND_API_KEY is set to: $MAILERSEND_API_KEY"
}

# Function to update the ts file based on the environment
update_files() {
  local env=$1
  local ts_file="functions/env/${env}.ts"
  local rtdb_url

  echo "Updating ${env}.ts for environment: $env"

  # Check if the TypeScript file exists
  if [ ! -f "$ts_file" ]; then
    echo "Error: ${ts_file} does not exist."
    exit 1
  fi

  case $env in
    local)
      rtdb_url=$RTDB_URL_LOCAL
      ;;
    staging)
      rtdb_url=$RTDB_URL_STAGING
      ;;
    production)
      rtdb_url=$RTDB_URL_PRODUCTION
      ;;
    *)
      echo "Unknown environment: $env"
      exit 1
      ;;
  esac

  # Update the corresponding TypeScript file
  sed -i '' "s|^const REGION = .*|const REGION = \"$REGION\";|" "$ts_file" && echo "Set REGION to $REGION in $ts_file"
  sed -i '' "s|^const RTDB_URL = .*|const RTDB_URL = \"$rtdb_url\";|" "$ts_file" && echo "Set RTDB_URL to $rtdb_url in $ts_file"
  
  echo "RTDB_URL is set to: $rtdb_url"
  echo "REGION is set to: $REGION"
}

# Function to deploy firebase functions
deploy_firebase() {
  local env=$1

  echo "Changing directory to functions"
  cd functions || { echo "Failed to change directory to functions"; exit 1; }

  echo "Running firebase deploy for environment: $env"
  firebase deploy --only functions:"$env" --force || { echo "Failed to deploy firebase functions"; exit 1; }

  echo "Firebase deployment for $env environment completed successfully"
}

# Main script execution
main() {
  if [ -z "$1" ]; then
    echo "Usage: $0 {local|staging|production}"
    exit 1
  fi
  update_env
  local env=$1

  update_files "$env"
  deploy_firebase "$env"
}

main "$@"