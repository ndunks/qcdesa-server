#!/bin/bash

yarn build
echo "Uplading changes..."
rsync -rav ./dist/index.js "klampok:/home/pilkades/server"
echo "Restarting server..."
ssh klampok "sh -c 'killall node; cd /home/pilkades/server; nohup node index.js > /dev/null 2>&1 &'"

