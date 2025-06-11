# CodeGuide Starter Lite - 设置指南

这个文档将指导您完成 CodeGuide Starter Lite 项目的完整设置过程。

## 快速开始

### 自动设置（推荐）

我们提供了自动化设置脚本来简化配置过程：

**Linux/macOS:**
```bash
./setup.sh
```

**Windows:**
```cmd
setup.bat
```

### 手动设置

如果您更喜欢手动设置，请按照以下步骤操作：

## 前置要求

在开始之前，请确保您的系统已安装：

- **Node.js 18+** - [下载地址](https://nodejs.org/)
- **Git** - [下载地址](https://git-scm.com/)
- **包管理器** - npm（Node.js 自带）、yarn 或 pnpm

## 详细设置步骤

### 1. 克隆项目

```bash
git clone <repository-url>
cd codeguide-starter-lite
```

### 2. 安装依赖

根据您的包管理器选择：

```bash
# 使用 npm
npm install

# 使用 yarn
yarn install

# 使用 pnpm
pnpm install
```

### 3. 环境变量配置

#### 3.1 创建环境文件

```bash
cp .env.example .env
```

#### 3.2 配置 Clerk 认证

1. 访问 [Clerk Dashboard](https://dashboard.clerk.com/)
2. 创建新应用或选择现有应用
3. 进入 **API Keys** 页面
4. 复制以下密钥到 `.env` 文件：

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxx
```

#### 3.3 配置 Supabase 数据库

1. 访问 [Supabase Dashboard](https://app.supabase.com/)
2. 创建新项目或选择现有项目
3. 进入 **Project Settings > API**
4. 复制以下信息到 `.env` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Supabase 本地开发（可选）

#### 4.1 安装 Supabase CLI

```bash
# 使用 npm
npm install -g supabase

# 使用 Homebrew (macOS)
brew install supabase/tap/supabase

# 使用 Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### 4.2 启动本地 Supabase

```bash
# 启动所有服务
supabase start

# 查看服务状态
supabase status
```

本地服务地址：
- **API URL**: http://localhost:54321
- **Studio**: http://localhost:54323
- **Inbucket**: http://localhost:54324

### 5. 文档设置

创建文档目录并添加 CodeGuide 生成的文档：

```bash
mkdir -p documentation
```

将以下文档文件放入 `documentation/` 目录：
- `project_requirements_document.md`
- `app_flow_document.md`
- `frontend_guideline_document.md`
- `backend_structure_document.md`

### 6. 运行项目

#### 6.1 启动开发服务器

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

#### 6.2 访问应用

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 7. 验证设置

#### 7.1 运行测试

```bash
npm test
# 或
yarn test
# 或
pnpm test
```

#### 7.2 代码检查

```bash
npm run lint
# 或
yarn lint
# 或
pnpm lint
```

## 常用命令

### 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint

# 运行测试
npm test

# 监听模式运行测试
npm run test:watch
```

### Supabase 命令

```bash
# 启动本地 Supabase
supabase start

# 停止本地 Supabase
supabase stop

# 重置本地数据库
supabase db reset

# 生成类型定义
supabase gen types typescript --local > types/database.types.ts

# 创建新迁移
supabase migration new <migration_name>

# 应用迁移
supabase db push
```

## 故障排除

### 常见问题

#### 1. Node.js 版本问题

**错误**: `Node.js version is not supported`

**解决方案**: 确保使用 Node.js 18 或更高版本

```bash
node --version  # 检查版本
nvm install 18  # 安装 Node.js 18 (如果使用 nvm)
nvm use 18      # 切换到 Node.js 18
```

#### 2. 依赖安装失败

**错误**: `npm install` 失败

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

#### 3. 环境变量未加载

**错误**: 认证或数据库连接失败

**解决方案**:
1. 确保 `.env` 文件在项目根目录
2. 检查环境变量名称是否正确
3. 重启开发服务器

#### 4. Supabase 连接问题

**错误**: 无法连接到 Supabase

**解决方案**:
1. 检查 Supabase URL 和 API Key 是否正确
2. 确保项目在 Supabase Dashboard 中处于活动状态
3. 检查网络连接

### 获取帮助

如果遇到其他问题：

1. 查看 [Next.js 文档](https://nextjs.org/docs)
2. 查看 [Clerk 文档](https://clerk.com/docs)
3. 查看 [Supabase 文档](https://supabase.com/docs)
4. 在项目仓库中创建 Issue

## 下一步

设置完成后，您可以：

1. 查看 `documentation/` 目录中的项目文档
2. 探索 `app/` 目录中的页面结构
3. 查看 `components/` 目录中的 UI 组件
4. 开始根据需求开发功能

祝您开发愉快！🚀
