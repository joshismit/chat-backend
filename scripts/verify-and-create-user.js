/**
 * Verify and Create Demo User Script
 * Verifies MongoDB connection and creates/verifies the demo user
 * 
 * Usage: node scripts/verify-and-create-user.js
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
  try {
    const userModule = require('../src/models/User');
    User = userModule.User;
  } catch (e2) {
    console.error('Could not load User model. Make sure to build the project first.');
    process.exit(1);
  }
}

// Get MongoDB URI from environment variables
const finalURI = getMongoURI();

async function verifyAndCreateUser() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    console.log(`📍 Connection String: ${finalURI.replace(/:[^:@]+@/, ':****@')}`);
    
    await mongoose.connect(finalURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    console.log(`✅ Connected to MongoDB`);
    console.log(`📦 Database Name: ${dbName}`);
    console.log(`🔗 Connection State: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}`);

    // List all collections
    const collections = await mongoose.connection.db?.listCollections().toArray();
    console.log(`\n📚 Collections in database: ${collections?.length || 0}`);
    if (collections && collections.length > 0) {
      collections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
    }

    // Check users collection
    const userCount = await User.countDocuments();
    console.log(`\n👥 Total users in database: ${userCount}`);

    // List all users
    if (userCount > 0) {
      console.log('\n📋 Existing users:');
      const users = await User.find({}).select('name phone _id createdAt').lean();
      users.forEach(user => {
        console.log(`   - ${user.name} (${user.phone}) - ID: ${user._id}`);
      });
    }

    const phoneNumber = '9033868859';
    const password = 'test1234';
    const name = 'Demo User';

    // Check if user already exists
    let user = await User.findOne({ phone: phoneNumber });

    if (user) {
      console.log(`\n⚠️  User with phone ${phoneNumber} already exists!`);
      console.log(`   User ID: ${user._id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Has password: ${user.password ? 'Yes (hashed)' : 'No'}`);
      
      // Update password if needed
      if (!user.password) {
        console.log(`   ⚠️  User has no password, adding password...`);
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        user.password = hashedPassword;
        await user.save();
        console.log(`   ✅ Password added`);
      } else {
        // Update password to ensure it's correct
        console.log(`   Updating password to ensure it's correct...`);
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        user.password = hashedPassword;
        await user.save();
        console.log(`   ✅ Password updated`);
      }
    } else {
      console.log(`\n👤 Creating demo user...`);
      
      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      user = await User.create({
        name: name,
        phone: phoneNumber,
        password: hashedPassword,
        avatarUrl: null,
      });
      
      console.log(`✅ Created demo user: ${user.name} (${user.phone})`);
    }

    // Verify the user was saved
    const verifyUser = await User.findOne({ phone: phoneNumber });
    if (verifyUser) {
      console.log('\n✅ Verification: User found in database!');
      console.log('\n📊 Final User Details:');
      console.log(`   Name: ${verifyUser.name}`);
      console.log(`   Phone: ${verifyUser.phone}`);
      console.log(`   ID: ${verifyUser._id}`);
      console.log(`   Password: ${password} (hashed in database)`);
      console.log(`   Created At: ${verifyUser.createdAt}`);
      
      // Test password verification
      if (verifyUser.password) {
        const passwordMatch = await bcrypt.compare(password, verifyUser.password);
        console.log(`   Password Verification: ${passwordMatch ? '✅ Match' : '❌ No Match'}`);
      }
    } else {
      console.log('\n❌ ERROR: User was not found after creation!');
    }

    // Show final count
    const finalCount = await User.countDocuments();
    console.log(`\n📊 Final user count: ${finalCount}`);

    await mongoose.connection.close();
    console.log('\n✅ Script completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error occurred!');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'MongoServerError') {
      console.error('\n💡 MongoDB Error Details:');
      console.error(`   Code: ${error.code}`);
      console.error(`   Code Name: ${error.codeName}`);
    }
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

verifyAndCreateUser();

