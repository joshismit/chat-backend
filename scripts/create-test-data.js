/**
 * Create Test Data Script
 * Creates sample users, conversations, and messages for testing
 * 
 * Usage: node scripts/create-test-data.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { getMongoURI } = require('./dbConfig');

// Import models
const User = require('../dist/models/User').User || require('../src/models/User').User;
const Conversation = require('../dist/models/Conversation').Conversation || require('../src/models/Conversation').Conversation;
const Message = require('../dist/models/Message').Message || require('../src/models/Message').Message;

// Get MongoDB URI from environment variables
const MONGO_URI = getMongoURI();

async function createTestData() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing test data (optional - comment out to keep existing data)
    // await User.deleteMany({ phone: { $in: ['+1234567890', '+0987654321'] } });
    // await Conversation.deleteMany({});
    // await Message.deleteMany({});

    // Create test users
    console.log('\n👤 Creating test users...');
    let user1 = await User.findOne({ phone: '+1234567890' });
    let user2 = await User.findOne({ phone: '+0987654321' });

    if (!user1) {
      user1 = await User.create({
        name: 'Alice',
        phone: '+1234567890',
        avatarUrl: null,
      });
      console.log(`✅ Created user: ${user1.name} (${user1.phone})`);
    } else {
      console.log(`ℹ️  User already exists: ${user1.name} (${user1.phone})`);
    }

    if (!user2) {
      user2 = await User.create({
        name: 'Bob',
        phone: '+0987654321',
        avatarUrl: null,
      });
      console.log(`✅ Created user: ${user2.name} (${user2.phone})`);
    } else {
      console.log(`ℹ️  User already exists: ${user2.name} (${user2.phone})`);
    }

    // Create conversation
    console.log('\n💬 Creating conversation...');
    let conversation = await Conversation.findOne({
      members: { $all: [user1._id, user2._id] },
      type: 'private',
    });

    if (!conversation) {
      conversation = await Conversation.create({
        type: 'private',
        members: [user1._id, user2._id],
        lastMessageAt: new Date(),
      });
      console.log(`✅ Created conversation: ${conversation._id}`);
    } else {
      console.log(`ℹ️  Conversation already exists: ${conversation._id}`);
    }

    // Create test messages
    console.log('\n📨 Creating test messages...');
    const messages = [
      {
        conversationId: conversation._id,
        senderId: user1._id,
        text: 'Hello Bob! 👋',
        status: 'sent',
      },
      {
        conversationId: conversation._id,
        senderId: user2._id,
        text: 'Hi Alice! How are you?',
        status: 'sent',
      },
      {
        conversationId: conversation._id,
        senderId: user1._id,
        text: 'I\'m doing great, thanks! 😊',
        status: 'sent',
      },
    ];

    for (const msgData of messages) {
      const existingMsg = await Message.findOne({
        conversationId: msgData.conversationId,
        senderId: msgData.senderId,
        text: msgData.text,
      });

      if (!existingMsg) {
        const message = await Message.create({
          ...msgData,
          deliveredTo: [user2._id],
          readBy: [],
        });
        console.log(`✅ Created message: "${message.text}"`);
      }
    }

    // Update conversation lastMessageAt
    const lastMessage = await Message.findOne({ conversationId: conversation._id })
      .sort({ createdAt: -1 });
    if (lastMessage) {
      conversation.lastMessageAt = lastMessage.createdAt;
      await conversation.save();
    }

    console.log('\n✅ Test data created successfully!');
    console.log('\n📊 Summary:');
    const userCount = await User.countDocuments();
    const conversationCount = await Conversation.countDocuments();
    const messageCount = await Message.countDocuments();
    console.log(`  Users: ${userCount}`);
    console.log(`  Conversations: ${conversationCount}`);
    console.log(`  Messages: ${messageCount}`);

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Failed to create test data!');
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTestData();

