// AWS SDK configuration
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { S3Client } from '@aws-sdk/client-s3';

// AWS Region
export const REGION = 'us-east-1';

// Cognito configuration
export const USER_POOL_ID = process.env.REACT_APP_USER_POOL_ID || '';
export const USER_POOL_CLIENT_ID = process.env.REACT_APP_USER_POOL_CLIENT_ID || '';

// API Gateway configuration
export const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT || '';

// S3 configuration
export const S3_BUCKET = process.env.REACT_APP_S3_BUCKET || '';

// Initialize AWS clients
export const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
export const s3Client = new S3Client({ region: REGION });
