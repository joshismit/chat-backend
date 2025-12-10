/**
 * Seed Dummy Data Script
 * Creates dummy users, conversations, and messages for testing
 * 
 * Usage: node scripts/seed-dummy-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getMongoURI } = require('./dbConfig');
const { generateUserToken } = require('./generateUserToken');

// Import models (using compiled JS files)
let User, Conversation, Message;
try {
  User = require('../dist/models/User').User;
  Conversation = require('../dist/models/Conversation').Conversation;
  Message = require('../dist/models/Message').Message;
} catch (e) {
  // If dist doesn't exist, try src (for development)
  User = require('../src/models/User').User;
  Conversation = require('../src/models/Conversation').Conversation;
  Message = require('../src/models/Message').Message;
}

// MongoDB connection
const MONGO_URI = getMongoURI();

// Dummy users data
const dummyUsers = [
  {
    name: 'Alice Johnson',
    phone: '1234567890',
    avatarUrl: null,
  },
  {
    name: 'Bob Smith',
    phone: '9876543210',
    avatarUrl: null,
  },
  {
    name: 'Charlie Brown',
    phone: '5551234567',
    avatarUrl: null,
  },
  {
    name: 'Diana Prince',
    phone: '5559876543',
    avatarUrl: null,
  },
  {
    name: 'Emma Watson',
    phone: '5555555555',
    avatarUrl: null,
  },
  {
    name: 'Frank Miller',
    phone: '5554443333',
    avatarUrl: null,
  },
];

// Current user phone (the one you're logged in with)
const CURRENT_USER_PHONE = '9033868859';

// Sample messages for conversations
const sampleMessages = [
  // Casual greetings
  'Hey! How are you?',
  'Hi there! 👋',
  'Hello! What\'s up?',
  'Hey, long time no see!',
  'Hi! How have you been?',
  
  // Work related
  'Can we schedule a meeting for tomorrow?',
  'I finished the project, want to review it?',
  'The deadline is approaching, need your help.',
  'Great work on the presentation!',
  'Let\'s discuss this in detail.',
  
  // Casual chat
  'Did you watch the game last night?',
  'That movie was amazing!',
  'Want to grab lunch together?',
  'Thanks for your help yesterday!',
  'See you later!',
  
  // Questions
  'What time works for you?',
  'Are you free this weekend?',
  'Can you send me those files?',
  'Did you get my message?',
  'What do you think about this?',
  
  // Responses
  'Sure, that sounds good!',
  'I\'ll get back to you soon.',
  'Thanks for letting me know.',
  'Perfect! Let\'s do that.',
  'I\'ll check and get back to you.',
  
  // Longer messages
  'I wanted to discuss the project timeline with you. Can we find a time that works for both of us?',
  'The meeting went really well. Everyone was impressed with your presentation.',
  'I\'m running a bit late, but I\'ll be there in about 15 minutes.',
  'Thanks for your patience. I really appreciate it!',
];

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

/**
 * Get random item from array
 */
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Create dummy users
 */
async function createUsers() {
  console.log('Creating dummy users...');
  const createdUsers = [];
  
  for (const userData of dummyUsers) {
    try {
      // Check if user already exists
      let user = await User.findOne({ phone: userData.phone });
      
      if (!user) {
        const userToken = generateUserToken();
        user = new User({
          ...userData,
          token: userToken,
          lastSeen: new Date(),
          createdAt: randomDate(30),
        });
        await user.save();
        console.log(`✅ Created user: ${userData.name} (${userData.phone})`);
        console.log(`   Token: ${userToken}`);
      } else {
        // Generate token if user doesn't have one
        if (!user.token) {
          const userToken = generateUserToken();
          user.token = userToken;
          await user.save();
          console.log(`   Generated token: ${userToken}`);
        }
        console.log(`⏭️  User already exists: ${userData.name} (${userData.phone})`);
      }
      
      createdUsers.push(user);
    } catch (error) {
      console.error(`❌ Error creating user ${userData.name}:`, error.message);
    }
  }
  
  return createdUsers;
}

/**
 * Create conversations between users
 */
async function createConversations(users) {
  console.log('\nCreating conversations...');
  const conversations = [];
  
  // Get current user (the logged-in user with phone 9033868859)
  const currentUser = await User.findOne({ phone: CURRENT_USER_PHONE });
  
  if (!currentUser) {
    console.log(`⚠️  Current user (${CURRENT_USER_PHONE}) not found. Creating conversations between dummy users only.`);
  }
  
  // Create conversations between current user and dummy users
  // This ensures the logged-in user sees conversations
  if (currentUser) {
    for (let i = 0; i < Math.min(users.length, 5); i++) {
      try {
        const otherUser = users[i];
        
        if (!otherUser || otherUser._id.toString() === currentUser._id.toString()) continue;
        
        // Check if conversation already exists
        const existingConv = await Conversation.findOne({
          type: 'private',
          members: { $all: [currentUser._id, otherUser._id] },
        });
        
        if (existingConv) {
          console.log(`⏭️  Conversation already exists: ${currentUser.name} - ${otherUser.name}`);
          conversations.push(existingConv);
          continue;
        }
        
        const conversation = new Conversation({
          type: 'private',
          members: [currentUser._id, otherUser._id],
          createdAt: randomDate(14),
          lastMessageAt: null,
          archivedBy: [],
        });
        
        await conversation.save();
        console.log(`✅ Created conversation: ${currentUser.name} ↔ ${otherUser.name}`);
        conversations.push(conversation);
      } catch (error) {
        console.error(`❌ Error creating conversation:`, error.message);
      }
    }
  }
  
  // Also create some conversations between dummy users (optional)
  const dummyPairs = [
    [0, 1], // First two dummy users
    [1, 2], // Second and third
    [2, 3], // Third and fourth
  ];
  
  for (const [idx1, idx2] of dummyPairs) {
    try {
      const user1 = users[idx1];
      const user2 = users[idx2];
      
      if (!user1 || !user2) continue;
      
      // Skip if either user is the current user
      if (currentUser && 
          (user1._id.toString() === currentUser._id.toString() || 
           user2._id.toString() === currentUser._id.toString())) {
        continue;
      }
      
      // Check if conversation already exists
      const existingConv = await Conversation.findOne({
        type: 'private',
        members: { $all: [user1._id, user2._id] },
      });
      
      if (existingConv) {
        console.log(`⏭️  Conversation already exists: ${user1.name} - ${user2.name}`);
        conversations.push(existingConv);
        continue;
      }
      
      const conversation = new Conversation({
        type: 'private',
        members: [user1._id, user2._id],
        createdAt: randomDate(14),
        lastMessageAt: null,
        archivedBy: [],
      });
      
      await conversation.save();
      console.log(`✅ Created conversation: ${user1.name} ↔ ${user2.name}`);
      conversations.push(conversation);
    } catch (error) {
      console.error(`❌ Error creating conversation:`, error.message);
    }
  }
  
  return conversations;
}

/**
 * Create messages for conversations
 */
async function createMessages(users, conversations) {
  console.log('\nCreating messages...');
  let totalMessages = 0;
  
  // Get current user for message creation
  const currentUser = await User.findOne({ phone: CURRENT_USER_PHONE });
  const allUsers = currentUser ? [currentUser, ...users] : users;
  
  for (const conversation of conversations) {
    try {
      const members = conversation.members;
      if (members.length !== 2) continue;
      
      const user1 = allUsers.find(u => u._id.toString() === members[0].toString());
      const user2 = allUsers.find(u => u._id.toString() === members[1].toString());
      
      if (!user1 || !user2) continue;
      
      // Create 5-15 messages per conversation
      const messageCount = Math.floor(Math.random() * 11) + 5;
      const messages = [];
      let lastMessageTime = conversation.createdAt || new Date();
      
      for (let i = 0; i < messageCount; i++) {
        // Alternate between users
        const sender = i % 2 === 0 ? user1 : user2;
        const receiver = i % 2 === 0 ? user2 : user1;
        
        // Increment time for each message (few minutes to few hours apart)
        const minutesAgo = messageCount - i;
        const messageTime = new Date(lastMessageTime);
        messageTime.setMinutes(messageTime.getMinutes() + (minutesAgo * (Math.random() * 60 + 5)));
        
        const message = new Message({
          senderId: sender._id,
          receiverId: receiver._id,
          conversationId: conversation._id,
          content: randomItem(sampleMessages),
          type: 'text',
          status: Math.random() > 0.7 ? 'read' : Math.random() > 0.5 ? 'delivered' : 'sent',
          timestamp: messageTime,
          createdAt: messageTime,
          deliveredTo: [receiver._id],
          readBy: Math.random() > 0.5 ? [receiver._id] : [],
          attachments: [],
        });
        
        messages.push(message);
        lastMessageTime = messageTime;
      }
      
      // Save all messages
      await Message.insertMany(messages);
      
      // Update conversation's lastMessageAt
      conversation.lastMessageAt = lastMessageTime;
      await conversation.save();
      
      totalMessages += messages.length;
      console.log(`✅ Created ${messages.length} messages for conversation ${user1.name} ↔ ${user2.name}`);
    } catch (error) {
      console.error(`❌ Error creating messages:`, error.message);
    }
  }
  
  return totalMessages;
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');
    console.log(`📦 Connecting to MongoDB: ${MONGO_URI.replace(/\/\/.*@/, '//***@')}`);
    
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    // Create users
    const users = await createUsers();
    
    if (users.length === 0) {
      console.log('❌ No users created. Exiting.');
      process.exit(1);
    }
    
    // Create conversations
    const conversations = await createConversations(users);
    
    if (conversations.length === 0) {
      console.log('⚠️  No conversations created.');
    }
    
    // Create messages
    const totalMessages = await createMessages(users, conversations);
    
    console.log('\n✨ Seeding completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Conversations: ${conversations.length}`);
    console.log(`   - Messages: ${totalMessages}`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed.');
    process.exit(0);
  }
}

// Run seeding
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };

