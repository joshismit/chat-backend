
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding users into PostgreSQL with PG adapter...');
    const users = [
        { name: 'Bhavesh Jain', phone: '9033868859' },
        { name: 'Alice Johnson', phone: '1234567890' },
        { name: 'Bob Smith', phone: '9876543210' },
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { phone: u.phone },
            update: { name: u.name },
            create: {
                name: u.name,
                phone: u.phone,
                token: Math.random().toString(36).substring(2),
                activeDevices: [],
            },
        });
        console.log(`✅ ${u.name} (${u.phone})`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
