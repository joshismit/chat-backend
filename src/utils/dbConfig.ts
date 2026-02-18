/**
 * Database Configuration Utility
 * Gets PostgreSQL connection URL from environment variables
 */

/**
 * Get PostgreSQL connection URL from environment variables
 * @returns PostgreSQL connection string
 * @throws Error if DATABASE_URL is not set
 */
export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Please set it in your .env file.'
    );
  }

  // Log masked URL for debugging connection issues on Render
  try {
    const url = new URL(databaseUrl);
    console.log(`📡 Database target: ${url.host}${url.pathname}`);
  } catch (e) {
    console.log('📡 Database URL is set but could not be parsed as a URL.');
  }

  return databaseUrl;
}

