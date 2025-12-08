# Create Random Users Script

This script creates multiple random users in the database for testing the conversation feature.

## Usage

```bash
# From the backend directory
npm run create-random-users

# Or directly with node
node scripts/create-random-users.js
```

## Database Configuration

**Important:** This script will create users in the database specified by your environment variables:

1. Set `MONGO_DB_NAME=newchattapp` in your `.env` file, OR
2. Ensure your `MONGO_URI` includes the database name `newchattapp`

The script will automatically use the database name "newchattapp" if `MONGO_DB_NAME` is not set, and will replace any existing database name in `MONGO_URI` to ensure users are created in the correct database.

## What it does

- Creates 20 random users with different names and phone numbers
- Sets a default password (`test1234`) for all users
- Skips users that already exist (but updates their password if missing)
- Shows a summary of created/updated/skipped users

## User List

The script creates the following users:

1. John Smith - +1234567890
2. Emma Johnson - +1234567891
3. Michael Brown - +1234567892
4. Sarah Davis - +1234567893
5. David Wilson - +1234567894
6. Lisa Anderson - +1234567895
7. James Taylor - +1234567896
8. Maria Garcia - +1234567897
9. Robert Martinez - +1234567898
10. Jennifer Lee - +1234567899
11. William Thomas - +1234567800
12. Jessica White - +1234567801
13. Christopher Harris - +1234567802
14. Amanda Clark - +1234567803
15. Daniel Lewis - +1234567804
16. Michelle Walker - +1234567805
17. Matthew Hall - +1234567806
18. Ashley Young - +1234567807
19. Andrew King - +1234567808
20. Stephanie Wright - +1234567809

## Default Password

All users are created with the password: `test1234`

## Testing the Feature

After running this script:

1. Login to the app with any of these users (phone + password)
2. Click the green floating action button (FAB) on the conversations screen
3. Search for users by phone number (e.g., "1234567890")
4. Select a user to start a conversation
5. The conversation will be created and you'll be navigated to the chat screen

## Notes

- Users that already exist will be skipped (unless they don't have a password)
- The script will update passwords for existing users if they're missing
- All users are searchable by their phone numbers in the app

