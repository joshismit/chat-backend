
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding PostgreSQL database via Prisma...');

    const users = [
        {
            name: 'Bhavesh Jain',
            phone: '9033868859',
            token: crypto.randomUUID(),
        },
        {
            name: 'Alice Johnson',
            phone: '1234567890',
            token: crypto.randomUUID(),
        },
        {
            name: 'Bob Smith',
            phone: '9876543210',
            token: crypto.randomUUID(),
        },
    ];

    for (const userData of users) {
        const user = await prisma.user.upsert({
            where: { phone: userData.phone },
            update: { name: userData.name },
            create: {
                name: userData.name,
                phone: userData.phone,
                token: userData.token,
                activeDevices: [],
            },
        });
        console.log(`✅ User ${user.name} (${user.phone}) ready.`);
    }

    console.log('✨ Seeding completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
