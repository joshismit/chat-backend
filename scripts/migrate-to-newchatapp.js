/**
 * Migrate Data to newchatapp Database Script
 * Migrates all data from chatdb to newchatapp database
 * 
 * Usage: node scripts/migrate-to-newchatapp.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { getMongoURI } = require('./dbConfig');

// Get source and target URIs from environment variables
// SOURCE_MONGO_URI can be set for migration from a different database
// If not set, uses MONGO_URI with MONGO_SOURCE_DB_NAME
const sourceBaseURI = process.env.SOURCE_MONGO_URI || process.env.MONGO_URI;
if (!sourceBaseURI) {
  console.error('❌ SOURCE_MONGO_URI or MONGO_URI environment variable is required');
  process.exit(1);
}

const sourceDbName = process.env.MONGO_SOURCE_DB_NAME || 'chatdb';
let SOURCE_URI = sourceBaseURI;
if (!sourceBaseURI.includes(`/${sourceDbName}`) && !sourceBaseURI.match(/\/[^\/\?]+(\?|$)/)) {
  const separator = sourceBaseURI.endsWith('/') ? '' : '/';
  const querySeparator = sourceBaseURI.includes('?') ? '&' : '?';
  SOURCE_URI = `${sourceBaseURI}${separator}${sourceDbName}${querySeparator}retryWrites=true&w=majority`;
}

// Target URI uses MONGO_URI with MONGO_DB_NAME
const TARGET_URI = getMongoURI();

async function migrateDatabase() {
  let sourceConnection, targetConnection;
  
  try {
    console.log('🔍 Connecting to source database (chatdb)...');
    sourceConnection = await mongoose.createConnection(SOURCE_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }).asPromise();
    
    const sourceDb = sourceConnection.db;
    const sourceDbName = sourceDb.databaseName;
    console.log(`✅ Connected to source database: ${sourceDbName}`);

    console.log('\n🔍 Connecting to target database (newchatapp)...');
    targetConnection = await mongoose.createConnection(TARGET_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }).asPromise();
    
    const targetDb = targetConnection.db;
    const targetDbName = targetDb.databaseName;
    console.log(`✅ Connected to target database: ${targetDbName}`);

    // List collections in source database
    const collections = await sourceDb.listCollections().toArray();
    console.log(`\n📚 Found ${collections.length} collections in source database:`);
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });

    if (collections.length === 0) {
      console.log('\n⚠️  No collections to migrate. Source database is empty.');
      console.log('✅ Migration complete (nothing to migrate)');
      await sourceConnection.close();
      await targetConnection.close();
      process.exit(0);
    }

    // Migrate each collection
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`\n📦 Migrating collection: ${collectionName}...`);
      
      const sourceCollection = sourceDb.collection(collectionName);
      const targetCollection = targetDb.collection(collectionName);
      
      // Count documents
      const count = await sourceCollection.countDocuments();
      console.log(`   Found ${count} documents`);
      
      if (count === 0) {
        console.log(`   ⏭️  Skipping empty collection`);
        continue;
      }
      
      // Copy all documents
      const documents = await sourceCollection.find({}).toArray();
      if (documents.length > 0) {
        await targetCollection.insertMany(documents, { ordered: false });
        console.log(`   ✅ Migrated ${documents.length} documents`);
      }
      
      // Copy indexes
      const indexes = await sourceCollection.indexes();
      for (const index of indexes) {
        if (index.name !== '_id_') { // Skip default _id index
          try {
            await targetCollection.createIndex(index.key, index.options || {});
            console.log(`   ✅ Created index: ${index.name}`);
          } catch (err) {
            if (err.code !== 85) { // Ignore duplicate key errors
              console.log(`   ⚠️  Could not create index ${index.name}: ${err.message}`);
            }
          }
        }
      }
    }

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const targetCollections = await targetDb.listCollections().toArray();
    console.log(`✅ Target database now has ${targetCollections.length} collections`);
    
    for (const col of targetCollections) {
      const count = await targetDb.collection(col.name).countDocuments();
      console.log(`   - ${col.name}: ${count} documents`);
    }

    await sourceConnection.close();
    await targetConnection.close();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Verify data in newchatapp database');
    console.log('   2. Update your application to use newchatapp database');
    console.log('   3. (Optional) Delete old chatdb database after verification');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error(error.stack);
    
    if (sourceConnection) await sourceConnection.close().catch(() => {});
    if (targetConnection) await targetConnection.close().catch(() => {});
    
    process.exit(1);
  }
}

migrateDatabase();

