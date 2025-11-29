# 啟動後端服務的 PowerShell 腳本

Write-Host "正在檢查並清理端口..." -ForegroundColor Yellow

# 檢查並停止占用 5001 和 8080 端口的進程
$ports = @(5001, 8080)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        Write-Host "發現端口 $port 被占用，正在停止..." -ForegroundColor Yellow
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $pids) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "已停止進程 PID: $pid" -ForegroundColor Green
        }
        Start-Sleep -Seconds 1
    }
}

# 停止所有 Node 進程（可選，取消註釋以啟用）
# Write-Host "停止所有 Node 進程..." -ForegroundColor Yellow
# Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "啟動後端服務..." -ForegroundColor Cyan
Write-Host ""

Set-Location backend
npm run dev

