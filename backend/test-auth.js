/**
 * Simple test script for JWT Authentication
 * Usage: node test-auth.js <token>
 */

const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || process.env.VITE_API_BASE_URL || 'http://localhost:8080';
const TOKEN = process.argv[2] || process.env.TOKEN;

if (!TOKEN) {
  console.error('❌ Please provide a JWT token as argument');
  console.log('Usage: node test-auth.js <token>');
  console.log('Or: TOKEN=your-token node test-auth.js');
  process.exit(1);
}

async function testAuth() {
  console.log('🧪 Testing JWT Authentication...\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);

  // Test 1: Health Check
  try {
    console.log('1️⃣  Health Check...');
    const healthRes = await axios.get(`${BACKEND_URL}/api/health`);
    console.log('✅ Health:', healthRes.data.status);
    console.log('   Database:', healthRes.data.database);
    console.log('');
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Get Current User
  try {
    console.log('2️⃣  Get Current User...');
    const userRes = await axios.get(`${BACKEND_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    console.log('✅ User Info:');
    console.log('   ID:', userRes.data.id);
    console.log('   Email:', userRes.data.email);
    console.log('   Name:', userRes.data.name);
    console.log('');
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('❌ Authentication failed: Invalid or expired token');
    } else {
      console.error('❌ Error:', error.message);
    }
    return;
  }

  // Test 3: Create Session
  try {
    console.log('3️⃣  Create Session...');
    const sessionRes = await axios.post(
      `${BACKEND_URL}/api/sessions`,
      {
        title: 'Test Session',
        description: 'Created by test script'
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Session Created:');
    console.log('   ID:', sessionRes.data.id);
    console.log('   Title:', sessionRes.data.title);
    console.log('');
  } catch (error) {
    console.error('❌ Create session failed:', error.response?.data || error.message);
  }

  // Test 4: Get All Sessions
  try {
    console.log('4️⃣  Get All Sessions...');
    const sessionsRes = await axios.get(`${BACKEND_URL}/api/sessions`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    console.log(`✅ Found ${sessionsRes.data.length} session(s)`);
    if (sessionsRes.data.length > 0) {
      console.log('   Latest:', sessionsRes.data[0].title);
    }
    console.log('');
  } catch (error) {
    console.error('❌ Get sessions failed:', error.response?.data || error.message);
  }

  console.log('✅ All tests completed!');
}

testAuth().catch(console.error);

