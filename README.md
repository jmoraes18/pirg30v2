<div align="center">

# 🖥️ pirg30v2 · Dashboard

### *"sua rede, sob controle"*

Dashboard de monitoramento residencial rodando em **Raspberry Pi 3B+** com tela de 7", exibido em modo quiosque.

![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-3B+-C51A4A?style=for-the-badge&logo=raspberrypi&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

</div>

---

## ✨ Funcionalidades

- 📡 **UniFi Network** — APs, clientes conectados por rádio em tempo real
- 🛡️ **AdGuard Home** — queries DNS, bloqueios do dia e top domínios bloqueados
- 📹 **NVD Intelbras** — status online/offline, uso do HD, estado do disco
- 🎥 **Motion (câmera Pi)** — detecção de movimento com notificação no WhatsApp via CallMeBot
- 🌡️ **Sistema** — temperatura CPU, uso de RAM, uptime
- 🕐 **Relógio** em tempo real com atualização a cada 30 segundos
- 🖥️ **Modo quiosque** — abre automaticamente na tela de 7" no boot

---

## 🖼️ Preview

> Dashboard rodando em 800×480px (tela oficial de 7" do Raspberry Pi)

| Seção | Descrição |
|---|---|
| Topo | Métricas rápidas: clientes Wi-Fi, bloqueios, queries DNS, temperatura |
| Meio | APs UniFi · Top bloqueados AdGuard · Status NVD Intelbras |
| Baixo | Sistema Pi · Gráfico DNS · Status dos serviços |

---

## 🛠️ Pré-requisitos

| Componente | Versão |
|---|---|
| Raspberry Pi | 3B+ ou superior |
| Raspberry Pi OS | Lite **64-bit** (Debian 13 Trixie) |
| Node.js | 20 LTS |
| UniFi Network Application | qualquer versão recente |
| AdGuard Home | qualquer versão recente |
| Motion | qualquer versão recente |

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/joaomoraes/dashboard.git
cd dashboard
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as credenciais

```bash
cp .env.example .env
nano .env
```

Preencha com suas credenciais:

```env
UNIFI_USER=admin
UNIFI_PASS=sua_senha
UNIFI_SITE=default

AG_USER=admin
AG_PASS=sua_senha

NVD_HOST=https://192.168.x.x
NVD_USER=admin
NVD_PASS=sua_senha
NVD_CAMERAS=6

CALLMEBOT_PHONE=5516999999999
CALLMEBOT_APIKEY=0000000
CAMERA_LOCATION=Escritório
```

### 4. Configure o script de notificação

```bash
cp scripts/notifica_whatsapp.sh ~/notifica_whatsapp.sh
chmod +x ~/notifica_whatsapp.sh
```

Edite o `/etc/motion/motion.conf` e aponte para o script:

```ini
on_event_start /home/pi/notifica_whatsapp.sh
```

### 5. Crie o serviço systemd

```bash
sudo nano /etc/systemd/system/pi-dashboard.service
```

```ini
[Unit]
Description=Pi Dashboard API
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/dashboard
ExecStart=/usr/bin/node /home/pi/dashboard/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pi-dashboard
```

### 6. Configure o modo quiosque

```bash
cp scripts/start_kiosk.sh ~/start_kiosk.sh
chmod +x ~/start_kiosk.sh
```

Adicione ao `~/.bash_profile` para iniciar automaticamente no boot:

```bash
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx ~/start_kiosk.sh -- -nocursor 2>/dev/null
fi
```

---

## 📁 Estrutura do projeto

```
dashboard/
├── server.js              # API Node.js — busca dados de todos os serviços
├── package.json
├── .env.example           # Template de configuração (sem credenciais)
├── .gitignore
├── public/
│   └── index.html         # Dashboard (HTML/CSS/JS puro, 800×480px)
└── scripts/
    ├── notifica_whatsapp.sh  # Notificação de movimento via CallMeBot
    └── start_kiosk.sh        # Inicia Chromium em modo quiosque
```

---

## ⚙️ Gerenciar o serviço

```bash
# Status
sudo systemctl status pi-dashboard

# Reiniciar após alterar server.js
sudo systemctl restart pi-dashboard

# Logs em tempo real
journalctl -u pi-dashboard -f

# Forçar reload no Chromium sem reiniciar
DISPLAY=:0 xdotool key ctrl+r
```

---

## 📡 Endpoints da API

| Endpoint | Descrição |
|---|---|
| `GET /api/stats` | Retorna todos os dados em JSON |
| `GET /snapshots/:arquivo` | Serve snapshots da câmera |

---

## 📱 Notificação WhatsApp

Utiliza a API do [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/).

Para ativar, envie uma mensagem para `+34 644 61 79 79` no WhatsApp:

```
I allow callmebot to send me messages
```

Você receberá sua API key em segundos.

---

## 🔒 Segurança

- ⚠️ **Nunca commite o arquivo `.env`** — ele está no `.gitignore`
- As credenciais ficam apenas no servidor local
- A API roda na porta `3500` — configure seu firewall para não expor externamente

---

## 👨‍💻 Autor

**João Moraes** — Projeto pessoal para monitoramento residencial (RG30)

---

<div align="center">

*pirg30v2 · sua rede, sob controle*

</div>
