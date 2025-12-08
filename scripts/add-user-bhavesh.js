/**
 * Add User: Bhavesh Jain
 * Creates user and conversation with current logged-in user
 * 
 * Usage: node scripts/add-user-bhavesh.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getMongoURI } = require('./dbConfig');

// Import models
let User, Conversation, Message;
try {
  User = require('../dist/models/User').User;
  Conversation = require('../dist/models/Conversation').Conversation;
  Message = require('../dist/models/Message').Message;
} catch (e) {
  User = require('../src/models/User').User;
  Conversation = require('../src/models/Conversation').Conversation;
  Message = require('../src/models/Message').Message;
}

const MONGO_URI = getMongoURI();
const CURRENT_USER_PHONE = '9033868859';
const BHAVESH_PHONE = '8690111115';
const BHAVESH_NAME = 'Bhavesh Jain';

/**
 * Generate random date within last N days
 */
function randomDate(daysAgo = 7) {
  const now = new Date();
  const days = Math.floor(Math.random() * daysAgo);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() - hours);
  date.setMinutes(date.getMinutes() - minutes);
  return date;
}

async function addBhaveshUser() {
  try {
    console.log('🌱 Adding user: Bhavesh Jain\n');
    console.log(`📦 Connecting to MongoDB...`);
    
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    // Get or create current user
    let currentUser = await User.findOne({ phone: CURRENT_USER_PHONE });
    if (!currentUser) {
      currentUser = new User({
        name: 'Demo User',
        phone: CURRENT_USER_PHONE,
        avatarUrl: null,
        lastSeen: new Date(),
        createdAt: new Date(),
      });
      await currentUser.save();
      console.log(`✅ Created current user: ${currentUser.name} (${currentUser.phone})`);
    } else {
      console.log(`✅ Found current user: ${currentUser.name} (${currentUser.phone})`);
    }
    
    // Create or get Bhavesh user
    let bhavesh = await User.findOne({ phone: BHAVESH_PHONE });
    if (!bhavesh) {
      bhavesh = new User({
        name: BHAVESH_NAME,
        phone: BHAVESH_PHONE,
        avatarUrl: null,
        lastSeen: new Date(),
        createdAt: randomDate(30),
      });
      await bhavesh.save();
      console.log(`✅ Created user: ${bhavesh.name} (${bhavesh.phone})`);
    } else {
      console.log(`⏭️  User already exists: ${bhavesh.name} (${bhavesh.phone})`);
    }
    
    // Create conversation between current user and Bhavesh
    console.log('\n💬 Creating conversation...');
    let conversation = await Conversation.findOne({
      type: 'private',
      members: { $all: [currentUser._id, bhavesh._id] },
    });
    
    if (!conversation) {
      conversation = new Conversation({
        type: 'private',
        members: [currentUser._id, bhavesh._id],
        createdAt: randomDate(7),
        lastMessageAt: null,
        archivedBy: [],
      });
      await conversation.save();
      console.log(`✅ Created conversation: ${currentUser.name} ↔ ${bhavesh.name}`);
    } else {
      console.log(`⏭️  Conversation already exists: ${currentUser.name} ↔ ${bhavesh.name}`);
    }
    
    // Create some initial messages for real-time conversation
    console.log('\n📨 Creating initial messages...');
    const initialMessages = [
      {
        sender: currentUser,
        receiver: bhavesh,
        content: 'Hey Bhavesh! 👋',
      },
      {
        sender: bhavesh,
        receiver: currentUser,
        content: 'Hi! How are you doing?',
      },
      {
        sender: currentUser,
        receiver: bhavesh,
        content: 'I\'m doing great! Thanks for asking. How about you?',
      },
      {
        sender: bhavesh,
        receiver: currentUser,
        content: 'All good here! Ready for some real-time chat?',
      },
    ];
    
    let messageTime = conversation.createdAt || new Date();
    let createdCount = 0;
    
    for (const msgData of initialMessages) {
      // Check if message already exists
      const existingMsg = await Message.findOne({
        conversationId: conversation._id,
        senderId: msgData.sender._id,
        content: msgData.content,
      });
      
      if (!existingMsg) {
        messageTime = new Date(messageTime);
        messageTime.setMinutes(messageTime.getMinutes() + (createdCount * 5));
        
        const message = new Message({
          senderId: msgData.sender._id,
          receiverId: msgData.receiver._id,
          conversationId: conversation._id,
          content: msgData.content,
          type: 'text',
          status: 'read',
          timestamp: messageTime,
          createdAt: messageTime,
          deliveredTo: [msgData.receiver._id],
          readBy: [msgData.receiver._id],
          attachments: [],
        });
        
        await message.save();
        createdCount++;
        console.log(`✅ Created message: "${msgData.content}"`);
      }
    }
    
    // Update conversation's lastMessageAt
    const lastMessage = await Message.findOne({ conversationId: conversation._id })
      .sort({ timestamp: -1 });
    if (lastMessage) {
      conversation.lastMessageAt = lastMessage.timestamp;
      await conversation.save();
    }
    
    console.log('\n✨ User added successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - User: ${bhavesh.name} (${bhavesh.phone})`);
    console.log(`   - Conversation: ${currentUser.name} ↔ ${bhavesh.name}`);
    console.log(`   - Initial messages: ${createdCount}`);
    
  } catch (error) {
    console.error('❌ Error adding user:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed.');
    process.exit(0);
  }
}

// Run
if (require.main === module) {
  addBhaveshUser();
}

module.exports = { addBhaveshUser };

