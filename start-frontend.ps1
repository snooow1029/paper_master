# 啟動前端服務的 PowerShell 腳本

Write-Host "正在檢查並清理端口 3000..." -ForegroundColor Yellow

# 檢查並停止占用 3000 端口的進程
$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connections) {
    Write-Host "發現端口 3000 被占用，正在停止..." -ForegroundColor Yellow
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "已停止進程 PID: $pid" -ForegroundColor Green
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "啟動前端服務..." -ForegroundColor Cyan
Write-Host ""

Set-Location frontend
npm run dev

