# ==============================================================================
# AI Dev Hub: Запуск FastAPI бэкенда и aiogram бота с Hot-Reload (Windows PowerShell)
# ==============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Set-Location $RootDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "⚡ Запуск Telegram Mini App & Bot в Mock/Dev режиме" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Поиск интерпретатора Python
$PythonExe = "python"
if (Test-Path "$RootDir\.venv\Scripts\python.exe") {
    $PythonExe = "$RootDir\.venv\Scripts\python.exe"
    Write-Host "✓ Использование .venv Python: $PythonExe" -ForegroundColor Green
}

if (-not (Test-Path "$RootDir\.env")) {
    Write-Host "⚠ Создание .env из .env.example..." -ForegroundColor Yellow
    Copy-Item "$RootDir\.env.example" "$RootDir\.env"
}

Write-Host "🚀 [1/2] Запуск FastAPI на http://localhost:8000..." -ForegroundColor Green
$BackendProc = Start-Process -FilePath $PythonExe -ArgumentList "-m uvicorn tma_service.backend.main:app --host 0.0.0.0 --port 8000 --reload" -PassThru -NoNewWindow

Start-Sleep -Seconds 2

Write-Host "🤖 [2/2] Запуск Telegram-бота..." -ForegroundColor Green
$BotProc = Start-Process -FilePath $PythonExe -ArgumentList "-m tma_service.bot.bot" -PassThru -NoNewWindow

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "✨ Сервисы успешно запущены!" -ForegroundColor Green
Write-Host "• Веб-интерфейс TMA (браузер): http://localhost:8000" -ForegroundColor White
Write-Host "• API документация Swagger:     http://localhost:8000/docs" -ForegroundColor White
Write-Host "• Нажмите Ctrl+C или закройте окно для остановки" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

try {
    Wait-Process -Id $BackendProc.Id, $BotProc.Id
}
finally {
    Write-Host "🛑 Остановка сервисов..." -ForegroundColor Yellow
    Stop-Process -Id $BackendProc.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $BotProc.Id -ErrorAction SilentlyContinue
    Write-Host "✓ Все сервисы остановлены." -ForegroundColor Green
}
