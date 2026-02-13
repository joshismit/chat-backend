/**
 * Create Test User Script for Prisma/PostgreSQL
 * Creates a user with phone: 8690111116, name: Deepak, password: test123
 * 
 * Usage: node scripts/create-user-deepak.js
 */

const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');
const { randomBytes } = require('crypto');
require('dotenv').config();

// Setup database connection with adapter
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Generate a unique token for the user
function generateUserToken() {
    return randomBytes(32).toString('hex');
}

async function createUser() {
    try {
        console.log('🔍 Connecting to PostgreSQL...');

        const phoneNumber = '8690111116';
        const password = 'test123';
        const name = 'Deepak';

        // Check if user already exists
        let user = await prisma.user.findUnique({
            where: { phone: phoneNumber }
        });

        if (user) {
            console.log(`\n⚠️  User with phone ${phoneNumber} already exists!`);
            console.log(`   Updating user details...`);

            // Hash the password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            user = await prisma.user.update({
                where: { phone: phoneNumber },
                data: {
                    name: name,
                    password: hashedPassword,
                }
            });

            console.log(`✅ Updated user: ${user.name} (${user.phone})`);
        } else {
            console.log(`\n👤 Creating user...`);

            // Hash the password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Generate unique token for user
            const userToken = generateUserToken();

            user = await prisma.user.create({
                data: {
                    name: name,
                    phone: phoneNumber,
                    password: hashedPassword,
                    avatarUrl: null,
                    token: userToken,
                    activeDevices: [],
                }
            });

            console.log(`✅ Created user: ${user.name} (${user.phone})`);
        }

        console.log('\n📊 User Details:');
        console.log(`   Name: ${user.name}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Token: ${user.token}`);
        console.log(`   Password: ${password} (hashed in database)`);

        await prisma.$disconnect();
        await pool.end();
        console.log('\n✅ User created successfully!');
    } catch (error) {
        console.error('\n❌ Failed to create user!');
        console.error('Error:', error.message);
        console.error(error.stack);
        await prisma.$disconnect();
        await pool.end();
    }
}

createUser();
