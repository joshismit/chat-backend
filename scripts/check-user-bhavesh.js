const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const user = await prisma.user.findUnique({
        where: { phone: '8690111115' }
    });

    console.log(JSON.stringify(user, null, 2));

    await prisma.$disconnect();
    await pool.end();
}

main();
