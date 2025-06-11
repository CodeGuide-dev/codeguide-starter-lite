# 设置脚本说明

本项目提供了多个设置脚本来简化项目配置和验证过程。

## 📁 脚本文件

### 1. `setup.sh` (Linux/macOS)
自动化设置脚本，适用于 Linux 和 macOS 系统。

**功能:**
- 检查 Node.js 版本
- 自动检测包管理器 (npm/yarn/pnpm)
- 安装项目依赖
- 设置环境变量文件
- 可选安装和配置 Supabase CLI
- 创建文档目录
- 运行测试验证

**使用方法:**
```bash
chmod +x setup.sh  # 添加执行权限（如果需要）
./setup.sh
```

### 2. `setup.bat` (Windows)
自动化设置脚本，适用于 Windows 系统。

**功能:**
- 检查 Node.js 版本
- 自动检测包管理器 (npm/yarn/pnpm)
- 安装项目依赖
- 设置环境变量文件
- 可选安装和配置 Supabase CLI
- 创建文档目录
- 运行测试验证

**使用方法:**
```cmd
setup.bat
```

### 3. `verify-setup.js` (跨平台)
项目设置验证脚本，检查项目配置是否正确。

**功能:**
- 检查必需文件和目录
- 验证依赖安装状态
- 检查环境变量配置
- 验证配置文件
- 生成详细的验证报告

**使用方法:**
```bash
node verify-setup.js
# 或
npm run verify
# 或
npm run setup
```

## 🚀 快速开始

### 新项目设置
1. 克隆项目后，直接运行设置脚本：
   ```bash
   # Linux/macOS
   ./setup.sh
   
   # Windows
   setup.bat
   ```

2. 按照脚本提示完成配置

3. 验证设置：
   ```bash
   npm run verify
   ```

### 验证现有项目
如果项目已经设置，只需验证配置：
```bash
npm run verify
```

## 📋 脚本特性

### 智能检测
- **包管理器检测**: 自动识别 npm、yarn 或 pnpm
- **环境检测**: 检查 Node.js 版本和系统环境
- **配置状态**: 检查现有配置文件和环境变量

### 交互式配置
- **用户选择**: 可选择是否安装 Supabase CLI
- **配置提示**: 提供配置链接和说明
- **错误处理**: 友好的错误信息和解决建议

### 全面验证
- **文件检查**: 验证所有必需文件和目录
- **依赖验证**: 检查关键依赖是否正确安装
- **配置验证**: 检查环境变量和配置文件
- **状态报告**: 详细的验证结果和建议

## 🛠️ 新增的 npm 脚本

项目 `package.json` 中新增了以下有用的脚本：

```json
{
  "scripts": {
    "setup": "node verify-setup.js",
    "verify": "node verify-setup.js",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > types/database.types.ts"
  }
}
```

### 脚本说明

- **`npm run setup`**: 运行设置验证
- **`npm run verify`**: 验证项目配置
- **`npm run db:start`**: 启动本地 Supabase
- **`npm run db:stop`**: 停止本地 Supabase
- **`npm run db:reset`**: 重置本地数据库
- **`npm run db:types`**: 生成 TypeScript 类型定义

## 🔧 自定义配置

### 修改验证规则
编辑 `verify-setup.js` 文件来自定义验证规则：

```javascript
// 添加新的必需依赖
const requiredDeps = [
  'next',
  'react',
  'react-dom',
  '@clerk/nextjs',
  '@supabase/supabase-js',
  // 添加您的依赖
];

// 添加新的环境变量检查
const requiredVars = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  // 添加您的环境变量
];
```

### 修改设置流程
编辑 `setup.sh` 或 `setup.bat` 来自定义设置流程：

- 添加新的检查步骤
- 修改安装流程
- 添加额外的配置步骤

## 📖 相关文档

- **[SETUP.md](./SETUP.md)**: 详细的手动设置指南
- **[README.md](./README.md)**: 项目概述和快速开始
- **[.env.example](./.env.example)**: 环境变量模板

## 🐛 故障排除

### 常见问题

1. **权限错误 (Linux/macOS)**
   ```bash
   chmod +x setup.sh
   ```

2. **Node.js 版本过低**
   - 升级到 Node.js 18+
   - 使用 nvm 管理 Node.js 版本

3. **网络连接问题**
   - 检查网络连接
   - 配置 npm 代理（如果需要）

4. **Supabase CLI 安装失败**
   - 手动安装：https://supabase.com/docs/guides/cli
   - 检查系统权限

### 获取帮助

如果遇到问题：
1. 运行 `npm run verify` 查看详细错误
2. 查看相关文档
3. 在项目仓库中创建 Issue

## 🎯 最佳实践

1. **首次设置**: 使用自动化脚本
2. **定期验证**: 运行 `npm run verify`
3. **环境隔离**: 为不同环境使用不同的 `.env` 文件
4. **版本控制**: 不要提交 `.env` 文件到版本控制
5. **文档更新**: 保持设置文档与项目同步

---

这些脚本旨在简化项目设置过程，提高开发效率。如有建议或问题，欢迎反馈！
