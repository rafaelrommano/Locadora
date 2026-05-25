@echo off
title VHS Rental - Servidor Local
cd /d "%~dp0"

echo.
echo ================================================
echo   VHS RENTAL - Iniciando servidor local...
echo ================================================
echo.
echo Pasta: %CD%
echo URL:   http://localhost:8000/index.html
echo.
echo NAO FECHE esta janela enquanto estiver usando o site.
echo Para parar o servidor, aperte Ctrl+C ou feche esta janela.
echo.
echo ================================================
echo.

REM Abre o navegador apos 2 segundos (tempo do servidor subir)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8000/index.html"

REM Tenta python primeiro, depois py, depois mostra erro amigavel
python -m http.server 8000 2>nul
if errorlevel 1 (
    py -m http.server 8000 2>nul
    if errorlevel 1 (
        echo.
        echo ================================================
        echo   ERRO: Python nao encontrado!
        echo ================================================
        echo.
        echo Instale o Python em: https://www.python.org/downloads/
        echo IMPORTANTE: Marque a opcao "Add Python to PATH" durante a instalacao.
        echo.
        pause
    )
)