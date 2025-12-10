/**
 * Helper function to generate unique user token
 * Used in user creation scripts
 */

const crypto = require('crypto');

/**
 * Generate unique user token
 * Format: user_<random_64_char_hex_string>
 * This token is unique per user and stored in database
 */
function generateUserToken() {
  // Generate 32 bytes of random data and convert to hex (64 characters)
  const randomBytes = crypto.randomBytes(32);
  const token = `user_${randomBytes.toString('hex')}`;
  return token;
}

module.exports = { generateUserToken };

