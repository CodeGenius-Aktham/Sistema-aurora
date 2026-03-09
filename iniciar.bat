@echo off
:: Inicia el servidor usando tu motor local
start node_bin\node.exe server.js
echo Esperando a que el servidor inicie...
timeout /t 5
:: Abre el navegador directamente
start http://localhost:3000
pause