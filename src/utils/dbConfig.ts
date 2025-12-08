/**
 * Database Configuration Utility
 * Gets MongoDB URI from environment variables
 */

/**
 * Get MongoDB connection URI from environment variables
 * @returns MongoDB connection string
 * @throws Error if MONGO_URI is not set
 */
export function getMongoURI(): string {
  const mongoURI = process.env.MONGO_URI;
  
  if (!mongoURI) {
    throw new Error(
      'MONGO_URI environment variable is required. Please set it in your .env file.'
    );
  }

  // If database name is provided separately, append it to URI if not already present
  const dbName = process.env.MONGO_DB_NAME;
  
  if (dbName && !mongoURI.includes(`/${dbName}`) && !mongoURI.match(/\/[^\/\?]+(\?|$)/)) {
    // No database name in URI, append it
    const separator = mongoURI.endsWith('/') ? '' : '/';
    const querySeparator = mongoURI.includes('?') ? '&' : '?';
    return `${mongoURI}${separator}${dbName}${querySeparator}retryWrites=true&w=majority`;
  }

  return mongoURI;
}

