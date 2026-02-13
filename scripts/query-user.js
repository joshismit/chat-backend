/**
 * Query User Script
 * Retrieves user details for phone: 9033868859
 */

const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function queryUser() {
    try {
        const user = await prisma.user.findUnique({
            where: { phone: '9033868859' }
        });

        if (user) {
            console.log('\n✅ User found in database:');
            console.log('━'.repeat(50));
            console.log(`📱 Phone:      ${user.phone}`);
            console.log(`👤 Name:       ${user.name}`);
            console.log(`🆔 ID:         ${user.id}`);
            console.log(`🔑 Token:      ${user.token}`);
            console.log(`🔒 Password:   test123 (stored as hash)`);
            console.log(`📅 Created:    ${user.createdAt}`);
            console.log(`👁️  Last Seen:  ${user.lastSeen}`);
            console.log('━'.repeat(50));
        } else {
            console.log('\n❌ User not found!');
        }

        await prisma.$disconnect();
        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        await prisma.$disconnect();
        await pool.end();
    }
}

queryUser();
