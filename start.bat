@echo off
REM Start script for NewChatApp Backend (Windows)

echo 🚀 Starting NewChatApp Backend...

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found. Copying from .env.example...
    copy .env.example .env
    echo 📝 Please update .env with your configuration
)

REM Check if node_modules exists
if not exist node_modules (
    echo 📦 Installing dependencies...
    call npm install
)

REM Start the server
echo ✅ Starting development server...
call npm run dev

