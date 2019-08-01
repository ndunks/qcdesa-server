# QC Desa Server

    Aplikasi Server-side QuickCount menggunakan NodeJS dan ExpressJS

## Example deploy.sh script

``` bash
#!/bin/bash
yarn build
echo "Uplading changes..."
rsync -rav ./dist/index.js "servername:/home/user/server"
echo "Restarting server..."
ssh servername "sh -c 'killall node; cd /home/user/server; nohup node index.js --passcode ADMINPASSWORD > /dev/null 2>&1 &'"

```


## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn run serve
```

### Compiles and minifies for production
```
yarn run build
```

### Deploy to Server

*For Linux Users Only*
Pastikan sudah di setting ssh menggunakan publickey dan sudah membuat file `deploy.sh` executable.

```
yarn run deploy
```
