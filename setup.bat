@echo off
setlocal enabledelayedexpansion

REM CodeGuide Starter Lite - 项目设置脚本 (Windows 版本)
REM 此脚本将帮助您快速设置和配置项目

echo ================================================== 
echo     CodeGuide Starter Lite - 项目设置脚本
echo ==================================================
echo.

REM 检查 Node.js 是否安装
echo [STEP] 检查 Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未找到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 获取 Node.js 版本
for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
echo [INFO] Node.js 版本: %NODE_VERSION% ✓

REM 检测包管理器
echo [STEP] 检测包管理器...
set PACKAGE_MANAGER=npm
if exist "package-lock.json" set PACKAGE_MANAGER=npm
if exist "yarn.lock" set PACKAGE_MANAGER=yarn
if exist "pnpm-lock.yaml" set PACKAGE_MANAGER=pnpm
echo [INFO] 检测到包管理器: %PACKAGE_MANAGER%

REM 安装依赖
echo [STEP] 使用 %PACKAGE_MANAGER% 安装依赖...
if "%PACKAGE_MANAGER%"=="npm" (
    npm install
) else if "%PACKAGE_MANAGER%"=="yarn" (
    yarn install
) else if "%PACKAGE_MANAGER%"=="pnpm" (
    pnpm install
) else (
    echo [ERROR] 不支持的包管理器: %PACKAGE_MANAGER%
    pause
    exit /b 1
)

if %errorlevel% neq 0 (
    echo [ERROR] 依赖安装失败
    pause
    exit /b 1
)

echo [INFO] 依赖安装完成 ✓

REM 设置环境变量
echo [STEP] 设置环境变量...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [INFO] 已从 .env.example 创建 .env 文件
    ) else (
        echo [WARNING] .env.example 文件不存在，创建基本的 .env 文件
        (
            echo # Clerk Authentication
            echo NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxx
            echo CLERK_SECRET_KEY=sk_test_xxxxxx
            echo.
            echo # Supabase
            echo NEXT_PUBLIC_SUPABASE_URL=your_project_url
            echo NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
        ) > .env
    )
    echo [WARNING] 请编辑 .env 文件并填入正确的环境变量值
    echo [INFO] Clerk 配置: https://dashboard.clerk.com/
    echo [INFO] Supabase 配置: https://app.supabase.com/
) else (
    echo [INFO] .env 文件已存在 ✓
)

REM 创建文档目录
echo [STEP] 设置文档目录...
if not exist "documentation" (
    mkdir documentation
    echo [INFO] 已创建 documentation 目录
    echo [INFO] 请将 CodeGuide 生成的文档文件放入此目录
) else (
    echo [INFO] documentation 目录已存在 ✓
)

REM 检查 Supabase CLI
echo [STEP] 检查 Supabase CLI...
supabase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Supabase CLI 未安装
    set /p INSTALL_SUPABASE="是否要安装 Supabase CLI? (y/n): "
    if /i "!INSTALL_SUPABASE!"=="y" (
        echo [STEP] 安装 Supabase CLI...
        npm install -g supabase
        if %errorlevel% neq 0 (
            echo [ERROR] Supabase CLI 安装失败
            echo [INFO] 请手动安装: https://supabase.com/docs/guides/cli
        ) else (
            echo [INFO] Supabase CLI 安装完成 ✓
        )
    )
) else (
    echo [INFO] Supabase CLI 已安装 ✓
)

REM 设置 Supabase
if exist "supabase\config.toml" (
    echo [INFO] Supabase 已配置 ✓
    set /p START_SUPABASE="是否要启动本地 Supabase 实例? (y/n): "
    if /i "!START_SUPABASE!"=="y" (
        echo [STEP] 启动本地 Supabase...
        supabase start
    )
) else (
    set /p INIT_SUPABASE="是否要初始化 Supabase? (y/n): "
    if /i "!INIT_SUPABASE!"=="y" (
        echo [STEP] 初始化 Supabase...
        supabase init
    )
)

REM 运行测试
set /p RUN_TESTS="是否要运行测试? (y/n): "
if /i "!RUN_TESTS!"=="y" (
    echo [STEP] 运行测试...
    if "%PACKAGE_MANAGER%"=="npm" (
        npm test
    ) else if "%PACKAGE_MANAGER%"=="yarn" (
        yarn test
    ) else if "%PACKAGE_MANAGER%"=="pnpm" (
        pnpm test
    )
)

echo.
echo ==================================================
echo               设置完成！
echo ==================================================
echo.
echo [INFO] 下一步:
echo   1. 编辑 .env 文件并填入正确的环境变量
echo   2. 运行开发服务器: %PACKAGE_MANAGER% run dev
echo   3. 访问 http://localhost:3000
echo.
echo [INFO] 有用的命令:
echo   - 开发服务器: %PACKAGE_MANAGER% run dev
echo   - 构建项目: %PACKAGE_MANAGER% run build
echo   - 运行测试: %PACKAGE_MANAGER% test
echo   - 代码检查: %PACKAGE_MANAGER% run lint

supabase --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   - 启动 Supabase: supabase start
    echo   - 停止 Supabase: supabase stop
    echo   - Supabase 面板: http://localhost:54323
)

echo.
pause
