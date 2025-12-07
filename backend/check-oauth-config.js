/**
 * 检查 OAuth 配置脚本
 * 帮助诊断 redirect_uri_mismatch 错误
 * 
 * 使用方法：
 *   node check-oauth-config.js
 *   或
 *   GOOGLE_CALLBACK_URL=your-url node check-oauth-config.js
 */

require('dotenv').config({ path: '.env' });

console.log('🔍 检查 OAuth 配置...\n');

// 检查环境变量
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL;
const frontendUrl = process.env.FRONTEND_URL;

console.log('📋 环境变量检查:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (googleClientId) {
  console.log('✅ GOOGLE_CLIENT_ID: 已设置');
  console.log(`   值: ${googleClientId.substring(0, 20)}...`);
} else {
  console.log('❌ GOOGLE_CLIENT_ID: 未设置');
}

if (googleClientSecret) {
  console.log('✅ GOOGLE_CLIENT_SECRET: 已设置');
  console.log(`   值: ${googleClientSecret.substring(0, 20)}...`);
} else {
  console.log('❌ GOOGLE_CLIENT_SECRET: 未设置');
}

console.log('');

if (googleCallbackUrl) {
  console.log('✅ GOOGLE_CALLBACK_URL: 已设置');
  console.log(`   值: ${googleCallbackUrl}`);
  
  // 验证 URL 格式
  console.log('\n🔍 URL 格式检查:');
  
  if (!googleCallbackUrl.startsWith('http://') && !googleCallbackUrl.startsWith('https://')) {
    console.log('⚠️  警告: URL 应该以 http:// 或 https:// 开头');
  }
  
  if (googleCallbackUrl.startsWith('http://')) {
    console.log('⚠️  警告: 生产环境应该使用 HTTPS，不是 HTTP');
  }
  
  if (!googleCallbackUrl.endsWith('/api/auth/google/callback')) {
    console.log('⚠️  警告: URL 应该以 /api/auth/google/callback 结尾');
  }
  
  if (googleCallbackUrl.includes('localhost')) {
    console.log('⚠️  警告: 生产环境不应该使用 localhost');
  }
  
  // 提取域名
  try {
    const url = new URL(googleCallbackUrl);
    console.log(`\n📌 解析结果:`);
    console.log(`   协议: ${url.protocol}`);
    console.log(`   域名: ${url.hostname}`);
    console.log(`   路径: ${url.pathname}`);
    
    if (url.protocol === 'https:') {
      console.log('   ✅ 使用 HTTPS（正确）');
    } else {
      console.log('   ❌ 应该使用 HTTPS');
    }
    
  } catch (error) {
    console.log('❌ URL 格式无效:', error.message);
  }
  
} else {
  console.log('❌ GOOGLE_CALLBACK_URL: 未设置');
  console.log('   默认值将使用: /api/auth/google/callback');
  console.log('   ⚠️  这会导致 redirect_uri_mismatch 错误！');
}

console.log('');

if (frontendUrl) {
  console.log('✅ FRONTEND_URL: 已设置');
  console.log(`   值: ${frontendUrl}`);
} else {
  console.log('⚠️  FRONTEND_URL: 未设置（可选）');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 提供修复建议
console.log('💡 修复建议:\n');

if (!googleCallbackUrl) {
  console.log('1. 在 Railway Dashboard > Variables 中添加 GOOGLE_CALLBACK_URL');
  console.log('   格式: https://your-railway-url.up.railway.app/api/auth/google/callback\n');
} else {
  console.log('1. 确保 Google Cloud Console 中的 Redirect URI 与以下完全一致:');
  console.log(`   ${googleCallbackUrl}\n`);
  
  console.log('2. 在 Google Cloud Console 中:');
  console.log('   - 访问: https://console.cloud.google.com/apis/credentials');
  console.log('   - 选择你的 OAuth 2.0 Client ID');
  console.log('   - 在 "Authorized redirect URIs" 中添加:');
  console.log(`     ${googleCallbackUrl}\n`);
  
  console.log('3. 检查清单:');
  console.log('   ✅ 协议必须是 https://（不是 http://）');
  console.log('   ✅ 域名必须完全匹配 Railway Public Domain');
  console.log('   ✅ 路径必须是 /api/auth/google/callback');
  console.log('   ✅ 没有尾随斜杠');
  console.log('   ✅ 没有多余空格\n');
  
  console.log('4. 保存后等待几分钟让配置生效\n');
  
  console.log('5. 重新测试:');
  console.log(`   访问: ${googleCallbackUrl.replace('/api/auth/google/callback', '/api/auth/google')}\n`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

