/**
 * Database Configuration Utility for Scripts
 * Gets PostgreSQL connection URL from environment variables
 */

/**
 * Get PostgreSQL connection URL from environment variables
 * @returns {string} PostgreSQL connection string
 * @throws {Error} If DATABASE_URL is not set
 */
function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Please set it in your .env file.'
    );
  }

  return databaseUrl;
}

module.exports = { getDatabaseUrl };

