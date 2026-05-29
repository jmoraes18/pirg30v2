#!/bin/bash
xset s off
xset -dpms
xset s noblank
unclutter -idle 0.5 -root &
sleep 5
chromium \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-translate \
  --check-for-update-interval=31536000 \
  --window-size=800,480 \
  --window-position=0,0 \
  http://localhost:3500
