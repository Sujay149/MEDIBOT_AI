-- Environment Variables Setup for SMS Functionality
-- Copy these environment variables to your .env.local file

-- For Production SMS with Twilio:
-- TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
-- TWILIO_AUTH_TOKEN=your_twilio_auth_token_here  
-- TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

-- For Development (Demo Mode):
-- NODE_ENV=development

-- Instructions:
-- 1. Sign up for Twilio at https://www.twilio.com/
-- 2. Get your Account SID and Auth Token from Twilio Console
-- 3. Purchase a phone number from Twilio
-- 4. Add the environment variables above to your .env.local file
-- 5. Install Twilio SDK: npm install twilio
-- 6. Uncomment the Twilio code in /app/api/send-sms/route.ts

-- Demo Mode Features:
-- - SMS messages are logged to console instead of being sent
-- - All functionality works without Twilio setup
-- - Perfect for development and testing

-- Production Features:
-- - Real SMS messages sent via Twilio
-- - Phone number validation
-- - Delivery confirmations
-- - Error handling and retry logic
