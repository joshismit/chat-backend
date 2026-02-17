
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding users into PostgreSQL...');
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
    .finally(() => prisma.$disconnect());
