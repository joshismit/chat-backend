/**
 * Create Random Users Script
 * Creates multiple random users for testing the conversation feature
 * 
 * Usage: node scripts/create-random-users.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();
const { getMongoURI } = require('./dbConfig');

// Import User model
let User;
try {
  User = require('../dist/models/User').User;
} catch (e) {
  // If dist doesn't exist, try src (for development)
  const userModule = require('../src/models/User');
  User = userModule.User;
}

// Get MongoDB URI from environment variables
let finalURI = getMongoURI();

// Ensure database name is set to "newchattapp"
const targetDbName = process.env.MONGO_DB_NAME || 'newchattapp';

// Parse and reconstruct URI to ensure correct database name
// Extract the base URI (before database name)
const uriMatch = finalURI.match(/^(mongodb\+?srv?:\/\/[^\/]+)(\/[^\/\?]*)?(\?.*)?$/);
if (uriMatch) {
  const baseUri = uriMatch[1]; // mongodb://host or mongodb+srv://host
  const queryString = uriMatch[3] || ''; // Query parameters
  
  // Reconstruct URI with target database name
  finalURI = `${baseUri}/${targetDbName}${queryString ? queryString : '?retryWrites=true&w=majority'}`;
} else {
  // Fallback: try simple replacement
  if (!finalURI.includes(`/${targetDbName}`)) {
    // Replace any existing database name
    finalURI = finalURI.replace(/\/[^\/\?]+(\?|$)/, `/${targetDbName}$1`);
    // If still no database name, add it
    if (!finalURI.match(/\/[^\/\?]+(\?|$)/)) {
      const separator = finalURI.endsWith('/') ? '' : '/';
      const querySeparator = finalURI.includes('?') ? '&' : '?';
      finalURI = `${finalURI}${separator}${targetDbName}${querySeparator}retryWrites=true&w=majority`;
    }
  }
}

// Random user data
const randomUsers = [
  { name: 'John Smith', phone: '+1234567890' },
  { name: 'Emma Johnson', phone: '+1234567891' },
  { name: 'Michael Brown', phone: '+1234567892' },
  { name: 'Sarah Davis', phone: '+1234567893' },
  { name: 'David Wilson', phone: '+1234567894' },
  { name: 'Lisa Anderson', phone: '+1234567895' },
  { name: 'James Taylor', phone: '+1234567896' },
  { name: 'Maria Garcia', phone: '+1234567897' },
  { name: 'Robert Martinez', phone: '+1234567898' },
  { name: 'Jennifer Lee', phone: '+1234567899' },
  { name: 'William Thomas', phone: '+1234567800' },
  { name: 'Jessica White', phone: '+1234567801' },
  { name: 'Christopher Harris', phone: '+1234567802' },
  { name: 'Amanda Clark', phone: '+1234567803' },
  { name: 'Daniel Lewis', phone: '+1234567804' },
  { name: 'Michelle Walker', phone: '+1234567805' },
  { name: 'Matthew Hall', phone: '+1234567806' },
  { name: 'Ashley Young', phone: '+1234567807' },
  { name: 'Andrew King', phone: '+1234567808' },
  { name: 'Stephanie Wright', phone: '+1234567809' },
];

// Default password for all test users
const defaultPassword = 'test1234';

async function createRandomUsers() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    console.log(`📍 URI: ${finalURI.replace(/:[^:@]+@/, ':****@')}`); // Hide password
    console.log(`🎯 Target Database: ${targetDbName}`);

    await mongoose.connect(finalURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    console.log(`✅ Connected to MongoDB`);
    console.log(`📦 Database Name: ${dbName}`);
    
    if (dbName !== targetDbName && dbName !== 'unknown') {
      console.log(`⚠️  WARNING: Connected to database "${dbName}" but expected "${targetDbName}"`);
      console.log(`   Please check your MONGO_URI and MONGO_DB_NAME environment variables`);
    } else if (dbName === targetDbName) {
      console.log(`✅ Successfully connected to target database: ${targetDbName}`);
    }
    console.log(
      `🔗 Connection State: ${
        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      }`
    );

    console.log(`\n👤 Creating ${randomUsers.length} random users...`);
    console.log(`   Default password for all users: ${defaultPassword}\n`);

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const userData of randomUsers) {
      try {
        // Check if user already exists
        let user = await User.findOne({ phone: userData.phone });

        if (user) {
          // Update password if user exists
          if (!user.password) {
            user.password = hashedPassword;
            await user.save();
            console.log(`✅ Updated password for: ${userData.name} (${userData.phone})`);
            updatedCount++;
          } else {
            console.log(`⏭️  Skipped (exists): ${userData.name} (${userData.phone})`);
            skippedCount++;
          }
        } else {
          // Create new user
          user = await User.create({
            name: userData.name,
            phone: userData.phone,
            password: hashedPassword,
            avatarUrl: null,
          });
          console.log(`✅ Created: ${userData.name} (${userData.phone})`);
          createdCount++;
        }
      } catch (error) {
        console.error(`❌ Error creating user ${userData.name}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${createdCount} users`);
    console.log(`   Updated: ${updatedCount} users`);
    console.log(`   Skipped: ${skippedCount} users`);
    console.log(`   Total: ${randomUsers.length} users`);

    // Show all users
    const allUsers = await User.find({}).select('name phone _id').sort({ name: 1 }).lean();
    console.log(`\n📋 All users in database (${allUsers.length} total):`);
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} - ${user.phone} (ID: ${user._id})`);
    });

    console.log(`\n💡 You can now search for these users by phone number in the app!`);
    console.log(`   Example: Search for "1234567890" to find John Smith`);

    await mongoose.connection.close();
    console.log('\n✅ Random users created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to create random users!');
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createRandomUsers();

