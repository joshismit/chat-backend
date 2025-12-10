/**
 * Create Demo User Script
 * Creates a demo user for mobile authentication
 *
 * Usage: node scripts/create-demo-user.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();
const { getMongoURI } = require("./dbConfig");
const { generateUserToken } = require("./generateUserToken");

// Import User model
let User;
try {
  User = require("../dist/models/User").User;
} catch (e) {
  // If dist doesn't exist, try src (for development)
  const userModule = require("../src/models/User");
  User = userModule.User;
}

// Get MongoDB URI from environment variables
const finalURI = getMongoURI();

async function createDemoUser() {
  try {
    console.log("🔍 Connecting to MongoDB...");
    console.log(`📍 URI: ${finalURI.replace(/:[^:@]+@/, ":****@")}`); // Hide password

    await mongoose.connect(finalURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    const dbName = mongoose.connection.db?.databaseName || "unknown";
    console.log(`✅ Connected to MongoDB`);
    console.log(`📦 Database Name: ${dbName}`);
    console.log(
      `🔗 Connection State: ${
        mongoose.connection.readyState === 1 ? "connected" : "disconnected"
      }`
    );

    const phoneNumber = "9033868859";
    const password = "test1234";
    const name = "Demo User";

    // Check if user already exists
    let user = await User.findOne({ phone: phoneNumber });

    if (user) {
      console.log(`\n⚠️  User with phone ${phoneNumber} already exists!`);
      console.log(`   Updating password...`);

      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      user.password = hashedPassword;
      
      // Generate token if user doesn't have one
      if (!user.token) {
        const userToken = generateUserToken();
        user.token = userToken;
        console.log(`   Generated token: ${userToken}`);
      }
      
      await user.save();

      console.log(`✅ Password updated for user: ${user.name} (${user.phone})`);
    } else {
      console.log(`\n👤 Creating demo user...`);

      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Generate unique token for user
      const userToken = generateUserToken();
      
      user = await User.create({
        name: name,
        phone: phoneNumber,
        password: hashedPassword,
        avatarUrl: null,
        token: userToken,
      });

      console.log(`✅ Created demo user: ${user.name} (${user.phone})`);
    }

    console.log("\n📊 User Details:");
    console.log(`   Name: ${user.name}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   ID: ${user._id}`);
    console.log(`   Token: ${user.token}`);
    console.log(`   Password: ${password} (hashed in database)`);

    await mongoose.connection.close();
    console.log("\n✅ Demo user created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Failed to create demo user!");
    console.error("Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createDemoUser();
