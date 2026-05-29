#!/bin/bash
# Carrega variáveis do .env
source /home/joao/dashboard/.env 2>/dev/null || true

PHONE="${CALLMEBOT_PHONE}"
APIKEY="${CALLMEBOT_APIKEY}"
LOCAL="${CAMERA_LOCATION:-Escritório}"
DATA=$(date '+%d/%m/%Y às %H:%M:%S')
FOTO=$(ls -t /home/joao/snapshots/*.jpg 2>/dev/null | head -1 | xargs basename 2>/dev/null)
LINK="http://192.168.100.103:3500/snapshots/${FOTO}"

MENSAGEM="🚨 *Movimento Detectado!*

📍 Local: ${LOCAL}
🕐 Horário: ${DATA}
📷 Câmera: Raspberry Pi Cam

🖼 *Ver captura:*
${LINK}

_pirg30v2 · sua rede, sob controle_"

ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${MENSAGEM}'''))")
curl -s "https://api.callmebot.com/whatsapp.php?phone=${PHONE}&text=${ENCODED}&apikey=${APIKEY}"
