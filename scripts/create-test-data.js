/**
 * Create Test Data Script
 * Creates sample users, conversations, and messages for testing
 * 
 * Usage: node scripts/create-test-data.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { generateUserToken } = require('../dist/utils/tokenGenerator').generateUserToken || require('../src/utils/tokenGenerator').generateUserToken;

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('🔍 Connecting to PostgreSQL...');
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL');

    // Create test users
    console.log('\n👤 Creating test users...');
    let user1 = await prisma.user.findUnique({ where: { phone: '+1234567890' } });
    let user2 = await prisma.user.findUnique({ where: { phone: '+0987654321' } });

    if (!user1) {
      user1 = await prisma.user.create({
        data: {
          name: 'Alice',
          phone: '+1234567890',
          avatarUrl: null,
          token: generateUserToken(),
          activeDevices: [],
          lastSeen: new Date(),
        },
      });
      console.log(`✅ Created user: ${user1.name} (${user1.phone})`);
    } else {
      console.log(`ℹ️  User already exists: ${user1.name} (${user1.phone})`);
    }

    if (!user2) {
      user2 = await prisma.user.create({
        data: {
          name: 'Bob',
          phone: '+0987654321',
          avatarUrl: null,
          token: generateUserToken(),
          activeDevices: [],
          lastSeen: new Date(),
        },
      });
      console.log(`✅ Created user: ${user2.name} (${user2.phone})`);
    } else {
      console.log(`ℹ️  User already exists: ${user2.name} (${user2.phone})`);
    }

    // Create conversation
    console.log('\n💬 Creating conversation...');
    let conversation = await prisma.conversation.findFirst({
      where: {
        type: 'PRIVATE',
        members: {
          every: {
            userId: { in: [user1.id, user2.id] },
          },
        },
      },
      include: {
        members: true,
      },
    });

    // Verify it's exactly these two users
    if (conversation && conversation.members.length === 2) {
      const memberUserIds = conversation.members.map(m => m.userId);
      if (!memberUserIds.includes(user1.id) || !memberUserIds.includes(user2.id)) {
        conversation = null;
      }
    } else {
      conversation = null;
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          type: 'PRIVATE',
          members: {
            create: [
              { userId: user1.id },
              { userId: user2.id },
            ],
          },
          lastMessageAt: new Date(),
        },
      });
      console.log(`✅ Created conversation: ${conversation.id}`);
    } else {
      console.log(`ℹ️  Conversation already exists: ${conversation.id}`);
    }

    // Create test messages
    console.log('\n📨 Creating test messages...');
    const messages = [
      {
        conversationId: conversation.id,
        senderId: user1.id,
        receiverId: user2.id,
        content: 'Hello Bob! 👋',
        type: 'TEXT',
        status: 'SENT',
      },
      {
        conversationId: conversation.id,
        senderId: user2.id,
        receiverId: user1.id,
        content: 'Hi Alice! How are you?',
        type: 'TEXT',
        status: 'SENT',
      },
      {
        conversationId: conversation.id,
        senderId: user1.id,
        receiverId: user2.id,
        content: 'I\'m doing great, thanks! 😊',
        type: 'TEXT',
        status: 'SENT',
      },
    ];

    for (const msgData of messages) {
      const existingMsg = await prisma.message.findFirst({
        where: {
          conversationId: msgData.conversationId,
          senderId: msgData.senderId,
          content: msgData.content,
        },
      });

      if (!existingMsg) {
        const message = await prisma.message.create({
          data: {
            ...msgData,
            timestamp: new Date(),
            createdAt: new Date(),
            attachments: [],
            deliveredTo: {
              connect: { id: user2.id },
            },
          },
        });
        console.log(`✅ Created message: "${message.content}"`);
      }
    }

    // Update conversation lastMessageAt
    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
    });
    if (lastMessage) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: lastMessage.createdAt },
      });
    }

    console.log('\n✅ Test data created successfully!');
    console.log('\n📊 Summary:');
    const userCount = await prisma.user.count();
    const conversationCount = await prisma.conversation.count();
    const messageCount = await prisma.message.count();
    console.log(`  Users: ${userCount}`);
    console.log(`  Conversations: ${conversationCount}`);
    console.log(`  Messages: ${messageCount}`);

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Failed to create test data!');
    console.error('Error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

createTestData();
