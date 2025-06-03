#!/bin/bash

# CodeGuide Starter Lite - 项目设置脚本
# 此脚本将帮助您快速设置和配置项目

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查 Node.js 版本
check_node_version() {
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            print_message "Node.js 版本: v$NODE_VERSION ✓"
            return 0
        else
            print_error "需要 Node.js 18 或更高版本，当前版本: v$NODE_VERSION"
            return 1
        fi
    else
        print_error "未找到 Node.js，请先安装 Node.js 18+"
        return 1
    fi
}

# 检查包管理器
detect_package_manager() {
    if [ -f "package-lock.json" ]; then
        echo "npm"
    elif [ -f "yarn.lock" ]; then
        echo "yarn"
    elif [ -f "pnpm-lock.yaml" ]; then
        echo "pnpm"
    else
        echo "npm"  # 默认使用 npm
    fi
}

# 安装依赖
install_dependencies() {
    local pm=$1
    print_step "使用 $pm 安装依赖..."
    
    case $pm in
        "npm")
            npm install
            ;;
        "yarn")
            yarn install
            ;;
        "pnpm")
            pnpm install
            ;;
        *)
            print_error "不支持的包管理器: $pm"
            exit 1
            ;;
    esac
}

# 设置环境变量
setup_environment() {
    print_step "设置环境变量..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_message "已从 .env.example 创建 .env 文件"
        else
            print_warning ".env.example 文件不存在，创建基本的 .env 文件"
            cat > .env << EOF
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EOF
        fi
        
        print_warning "请编辑 .env 文件并填入正确的环境变量值"
        print_message "Clerk 配置: https://dashboard.clerk.com/"
        print_message "Supabase 配置: https://app.supabase.com/"
    else
        print_message ".env 文件已存在"
    fi
}

# 检查 Supabase CLI
check_supabase_cli() {
    if command_exists supabase; then
        print_message "Supabase CLI 已安装 ✓"
        return 0
    else
        print_warning "Supabase CLI 未安装"
        read -p "是否要安装 Supabase CLI? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_supabase_cli
        else
            print_message "跳过 Supabase CLI 安装"
            return 1
        fi
    fi
}

# 安装 Supabase CLI
install_supabase_cli() {
    print_step "安装 Supabase CLI..."
    
    if command_exists npm; then
        npm install -g supabase
    elif command_exists brew; then
        brew install supabase/tap/supabase
    else
        print_error "无法自动安装 Supabase CLI，请手动安装"
        print_message "安装指南: https://supabase.com/docs/guides/cli"
        return 1
    fi
}

# 初始化 Supabase（如果需要）
setup_supabase() {
    if [ -d "supabase" ] && [ -f "supabase/config.toml" ]; then
        print_message "Supabase 已配置 ✓"
        
        read -p "是否要启动本地 Supabase 实例? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_step "启动本地 Supabase..."
            supabase start
        fi
    else
        print_warning "Supabase 未初始化"
        read -p "是否要初始化 Supabase? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_step "初始化 Supabase..."
            supabase init
        fi
    fi
}

# 运行测试
run_tests() {
    print_step "运行测试..."
    local pm=$1
    
    case $pm in
        "npm")
            npm test
            ;;
        "yarn")
            yarn test
            ;;
        "pnpm")
            pnpm test
            ;;
    esac
}

# 创建文档目录
setup_documentation() {
    if [ ! -d "documentation" ]; then
        print_step "创建文档目录..."
        mkdir -p documentation
        print_message "已创建 documentation 目录"
        print_message "请将 CodeGuide 生成的文档文件放入此目录"
    else
        print_message "documentation 目录已存在 ✓"
    fi
}

# 主函数
main() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "    CodeGuide Starter Lite - 项目设置脚本"
    echo "=================================================="
    echo -e "${NC}"
    
    # 检查 Node.js
    if ! check_node_version; then
        exit 1
    fi
    
    # 检测包管理器
    PACKAGE_MANAGER=$(detect_package_manager)
    print_message "检测到包管理器: $PACKAGE_MANAGER"
    
    # 安装依赖
    install_dependencies $PACKAGE_MANAGER
    
    # 设置环境变量
    setup_environment
    
    # 设置文档目录
    setup_documentation
    
    # 检查和设置 Supabase
    if check_supabase_cli; then
        setup_supabase
    fi
    
    # 运行测试
    read -p "是否要运行测试? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_tests $PACKAGE_MANAGER
    fi
    
    echo -e "${GREEN}"
    echo "=================================================="
    echo "              设置完成！"
    echo "=================================================="
    echo -e "${NC}"
    
    print_message "下一步:"
    echo "  1. 编辑 .env 文件并填入正确的环境变量"
    echo "  2. 运行开发服务器: ${PACKAGE_MANAGER} run dev"
    echo "  3. 访问 http://localhost:3000"
    echo ""
    print_message "有用的命令:"
    echo "  - 开发服务器: ${PACKAGE_MANAGER} run dev"
    echo "  - 构建项目: ${PACKAGE_MANAGER} run build"
    echo "  - 运行测试: ${PACKAGE_MANAGER} test"
    echo "  - 代码检查: ${PACKAGE_MANAGER} run lint"
    
    if command_exists supabase; then
        echo "  - 启动 Supabase: supabase start"
        echo "  - 停止 Supabase: supabase stop"
        echo "  - Supabase 面板: http://localhost:54323"
    fi
}

# 运行主函数
main "$@"
