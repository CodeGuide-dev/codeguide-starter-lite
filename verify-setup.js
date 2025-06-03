#!/usr/bin/env node

/**
 * CodeGuide Starter Lite - 设置验证脚本
 * 此脚本检查项目设置是否正确
 */

const fs = require('fs');
const path = require('path');

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// 打印带颜色的消息
const print = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}[STEP]${colors.reset} ${msg}`)
};

// 检查结果统计
let checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

// 检查文件是否存在
function checkFileExists(filePath, description, required = true) {
  print.step(`检查 ${description}...`);
  
  if (fs.existsSync(filePath)) {
    print.success(`${description} 存在 ✓`);
    checks.passed++;
    return true;
  } else {
    if (required) {
      print.error(`${description} 不存在 ✗`);
      checks.failed++;
    } else {
      print.warning(`${description} 不存在（可选）`);
      checks.warnings++;
    }
    return false;
  }
}

// 检查目录是否存在
function checkDirectoryExists(dirPath, description, required = true) {
  print.step(`检查 ${description}...`);
  
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    print.success(`${description} 存在 ✓`);
    checks.passed++;
    return true;
  } else {
    if (required) {
      print.error(`${description} 不存在 ✗`);
      checks.failed++;
    } else {
      print.warning(`${description} 不存在（可选）`);
      checks.warnings++;
    }
    return false;
  }
}

// 检查环境变量
function checkEnvironmentVariables() {
  print.step('检查环境变量配置...');
  
  if (!fs.existsSync('.env')) {
    print.error('.env 文件不存在 ✗');
    checks.failed++;
    return false;
  }
  
  const envContent = fs.readFileSync('.env', 'utf8');
  const requiredVars = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  let allConfigured = true;
  
  requiredVars.forEach(varName => {
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = envContent.match(regex);
    
    if (match && match[1] && !match[1].includes('your_') && !match[1].includes('xxxxxx')) {
      print.success(`${varName} 已配置 ✓`);
      checks.passed++;
    } else {
      print.warning(`${varName} 未配置或使用默认值`);
      checks.warnings++;
      allConfigured = false;
    }
  });
  
  return allConfigured;
}

// 检查 package.json 依赖
function checkDependencies() {
  print.step('检查 package.json 依赖...');
  
  if (!fs.existsSync('package.json')) {
    print.error('package.json 不存在 ✗');
    checks.failed++;
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = [
    'next',
    'react',
    'react-dom',
    '@clerk/nextjs',
    '@supabase/supabase-js'
  ];
  
  let allPresent = true;
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      print.success(`${dep} 依赖存在 ✓`);
      checks.passed++;
    } else {
      print.error(`${dep} 依赖缺失 ✗`);
      checks.failed++;
      allPresent = false;
    }
  });
  
  return allPresent;
}

// 检查 node_modules
function checkNodeModules() {
  print.step('检查 node_modules...');
  
  if (fs.existsSync('node_modules') && fs.statSync('node_modules').isDirectory()) {
    // 检查一些关键包是否安装
    const keyPackages = ['next', 'react', '@clerk/nextjs', '@supabase/supabase-js'];
    let allInstalled = true;
    
    keyPackages.forEach(pkg => {
      const pkgPath = path.join('node_modules', pkg);
      if (fs.existsSync(pkgPath)) {
        print.success(`${pkg} 已安装 ✓`);
        checks.passed++;
      } else {
        print.error(`${pkg} 未安装 ✗`);
        checks.failed++;
        allInstalled = false;
      }
    });
    
    return allInstalled;
  } else {
    print.error('node_modules 目录不存在，请运行 npm install ✗');
    checks.failed++;
    return false;
  }
}

// 检查 TypeScript 配置
function checkTypeScriptConfig() {
  print.step('检查 TypeScript 配置...');
  
  if (fs.existsSync('tsconfig.json')) {
    print.success('tsconfig.json 存在 ✓');
    checks.passed++;
    return true;
  } else {
    print.warning('tsconfig.json 不存在');
    checks.warnings++;
    return false;
  }
}

// 检查 Tailwind CSS 配置
function checkTailwindConfig() {
  print.step('检查 Tailwind CSS 配置...');
  
  const configFiles = ['tailwind.config.ts', 'tailwind.config.js'];
  let found = false;
  
  configFiles.forEach(file => {
    if (fs.existsSync(file)) {
      print.success(`${file} 存在 ✓`);
      checks.passed++;
      found = true;
    }
  });
  
  if (!found) {
    print.error('Tailwind 配置文件不存在 ✗');
    checks.failed++;
  }
  
  return found;
}

// 主验证函数
function main() {
  console.log(`${colors.blue}==================================================`);
  console.log('    CodeGuide Starter Lite - 设置验证');
  console.log(`==================================================${colors.reset}\n`);
  
  // 检查基本文件
  checkFileExists('package.json', 'package.json');
  checkFileExists('.env', '环境变量文件 (.env)');
  checkFileExists('next.config.mjs', 'Next.js 配置文件');
  checkFileExists('README.md', 'README 文档');
  
  // 检查目录结构
  checkDirectoryExists('app', 'app 目录');
  checkDirectoryExists('components', 'components 目录');
  checkDirectoryExists('utils', 'utils 目录');
  checkDirectoryExists('public', 'public 目录');
  checkDirectoryExists('documentation', 'documentation 目录', false);
  checkDirectoryExists('supabase', 'supabase 目录', false);
  
  // 检查配置文件
  checkTypeScriptConfig();
  checkTailwindConfig();
  checkFileExists('jest.config.js', 'Jest 配置文件', false);
  checkFileExists('jest.setup.js', 'Jest 设置文件', false);
  
  // 检查依赖和安装
  checkDependencies();
  checkNodeModules();
  
  // 检查环境变量
  checkEnvironmentVariables();
  
  // 检查可选文件
  checkFileExists('supabase/config.toml', 'Supabase 配置文件', false);
  checkFileExists('.gitignore', '.gitignore 文件', false);
  checkFileExists('postcss.config.mjs', 'PostCSS 配置文件', false);
  
  // 输出结果
  console.log(`\n${colors.blue}==================================================`);
  console.log('                验证结果');
  console.log(`==================================================${colors.reset}`);
  
  print.success(`通过检查: ${checks.passed}`);
  if (checks.warnings > 0) {
    print.warning(`警告: ${checks.warnings}`);
  }
  if (checks.failed > 0) {
    print.error(`失败检查: ${checks.failed}`);
  }
  
  console.log('');
  
  if (checks.failed === 0) {
    print.success('🎉 项目设置验证通过！');
    print.info('您可以运行以下命令启动开发服务器:');
    console.log('  npm run dev');
    console.log('  # 或');
    console.log('  yarn dev');
    console.log('  # 或');
    console.log('  pnpm dev');
  } else {
    print.error('❌ 项目设置存在问题，请检查上述错误并修复');
    print.info('建议运行设置脚本: ./setup.sh (Linux/macOS) 或 setup.bat (Windows)');
  }
  
  if (checks.warnings > 0) {
    print.info('💡 警告项目为可选配置，不影响基本功能');
  }
  
  console.log('');
  
  // 返回适当的退出码
  process.exit(checks.failed > 0 ? 1 : 0);
}

// 运行验证
main();
