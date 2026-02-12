/**
 * Database Check Script
 * Verifies PostgreSQL connection via Prisma and lists tables
 * 
 * Usage: node scripts/check-database.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Connecting to PostgreSQL...');
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      // Hide password in URL
      const hiddenUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
      console.log(`📍 URL: ${hiddenUrl}`);
    }
    
    // Test connection
    await prisma.$connect();
    console.log('\n✅ Successfully connected to PostgreSQL!');
    
    // Test database operations
    console.log('\n🧪 Testing database operations...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database ping successful');
    
    // List tables
    console.log('\n📚 Checking tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found in database.');
      console.log('💡 Tables will be created when you run: npx prisma migrate dev');
      console.log('\nExpected tables:');
      console.log('  - users');
      console.log('  - messages');
      console.log('  - conversations');
      console.log('  - conversation_members');
      console.log('  - conversation_archives');
      console.log('  - qr_challenges');
      console.log('  - refresh_tokens');
    } else {
      console.log(`\n✅ Found ${tables.length} table(s):`);
      for (const table of tables) {
        const count = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM "${table.table_name}"`
        );
        console.log(`  📄 ${table.table_name}: ${count[0].count} row(s)`);
      }
    }
    
    // Check expected tables
    const expectedTables = [
      'users',
      'messages',
      'conversations',
      'conversation_members',
      'conversation_archives',
      'qr_challenges',
      'refresh_tokens',
    ];
    const existingTables = tables.map(t => t.table_name);
    const missingTables = expectedTables.filter(name => !existingTables.includes(name));
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
      console.log('💡 Run: npx prisma migrate dev to create them.');
    } else {
      console.log('\n✅ All expected tables exist!');
    }
    
    await prisma.$disconnect();
    console.log('\n✅ Database check completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Database check failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.error('\n💡 Tip: Check your PostgreSQL credentials in DATABASE_URL');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n💡 Tip: Check your network connection and PostgreSQL server URL');
    } else if (error.message.includes('timeout')) {
      console.error('\n💡 Tip: Check if PostgreSQL server allows connections from your IP address');
    } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('\n💡 Tip: Run migrations: npx prisma migrate dev');
    }
    
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

checkDatabase();
