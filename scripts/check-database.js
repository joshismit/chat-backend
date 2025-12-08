/**
 * Database Check Script
 * Verifies MongoDB connection and lists collections
 * 
 * Usage: node scripts/check-database.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { getMongoURI } = require('./dbConfig');

// Get MongoDB URI from environment variables
const finalURI = getMongoURI();

async function checkDatabase() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    console.log(`📍 URI: ${finalURI.replace(/:[^:@]+@/, ':****@')}`); // Hide password
    
    await mongoose.connect(finalURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    
    console.log('\n✅ Successfully connected to MongoDB!');
    console.log(`📦 Database Name: ${dbName}`);
    console.log(`🔗 Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    
    // List all collections
    console.log('\n📚 Checking collections...');
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('⚠️  No collections found in database.');
      console.log('💡 Collections will be created automatically when first document is saved.');
      console.log('\nExpected collections:');
      console.log('  - users');
      console.log('  - messages');
      console.log('  - conversations');
      console.log('  - qrchallenges');
    } else {
      console.log(`\n✅ Found ${collections.length} collection(s):`);
      for (const collection of collections) {
        const count = await db.collection(collection.name).countDocuments();
        console.log(`  📄 ${collection.name}: ${count} document(s)`);
        
        // Show indexes
        const indexes = await db.collection(collection.name).indexes();
        if (indexes.length > 1) { // More than just _id index
          console.log(`     Indexes: ${indexes.map(idx => idx.name).join(', ')}`);
        }
      }
    }
    
    // Check expected collections
    const expectedCollections = ['users', 'messages', 'conversations', 'qrchallenges'];
    const existingCollections = collections.map(c => c.name);
    const missingCollections = expectedCollections.filter(name => !existingCollections.includes(name));
    
    if (missingCollections.length > 0) {
      console.log(`\n⚠️  Missing collections: ${missingCollections.join(', ')}`);
      console.log('💡 These will be created automatically when models are used.');
    } else {
      console.log('\n✅ All expected collections exist!');
    }
    
    // Test database operations
    console.log('\n🧪 Testing database operations...');
    const testResult = await db.admin().ping();
    console.log(`✅ Database ping: ${JSON.stringify(testResult)}`);
    
    await mongoose.connection.close();
    console.log('\n✅ Database check completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Database check failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.error('\n💡 Tip: Check your MongoDB credentials in MONGO_URI');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n💡 Tip: Check your network connection and MongoDB cluster URL');
    } else if (error.message.includes('timeout')) {
      console.error('\n💡 Tip: Check if MongoDB Atlas allows connections from your IP address');
    }
    
    process.exit(1);
  }
}

checkDatabase();

