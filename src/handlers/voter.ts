import config from "@/config/config";
import * as fs from "fs";
import { Router, Request } from "express";
import * as WS from "ws";
import { parse } from "url";

const dataFile = `${config.data}/data.json`;
const router = Router();
const connectedVoters: { [id: number]: WS } = {};

class handleVoterWS {
    file: number
    logFile: number
    data: {
        started: number,
        updated?: number,
        finished?: number,
        accepted: number,
        declined: number,
        total: number,
        results: {
            number: number,
            name: string,
            count: number
        }[]
    };

    constructor(public ws: WS, public voteFile: string, public req: Request, public voteId: number, voteInfo) {
        let str;

        if (fs.existsSync(voteFile)) {
            str = fs.readFileSync(voteFile, 'utf8');
        }

        const logFile = `${voteFile.replace(/\.json$/, '.log')}`;
        this.file = fs.openSync(voteFile, fs.constants.O_WRONLY | fs.constants.O_CREAT)
        this.logFile = fs.openSync(logFile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND);

        echo("OPENED FILE", voteFile, this.file)
        if (str && str.length > 10) {
            this.data = JSON.parse(str);
        } else {
            // just started vote
            const results = voteInfo.candidates.map(v => {
                return {
                    number: v.number,
                    name: v.name,
                    count: 0
                }
            })
            // not required, merged to results
            delete voteInfo.candidates
            delete voteInfo.passcode
            //this just started
            this.data = {
                ...voteInfo,
                ...{
                    started: Date.now(),
                    accepted: 0,
                    declined: 0,
                    total: 0,
                    results: results
                }
            };
            str = JSON.stringify(this.data);
            this.save()
        }
        if (this.data.finished) {
            ws.send(str, () => ws.close());
            ws.close();
            return;
        } else {
            ws.send(str)
            // send initial data
            ws.on('message', this.onMessage)
            this.log('Connected', req.socket.remoteAddress, req.headers["user-agent"]);
        }
    }
    log(...args) {
        const data = [Date.now(), ...args];
        try {
            fs.writeSync(this.logFile, data.join(' ') + "\n");
        } catch (error) {
            echo('Write Log failedd!!', error)
            this.destroy();
        }
    }
    save() {
        try {
            this.data.updated = Date.now();
            fs.writeSync(this.file, JSON.stringify(this.data), 0, 'utf8')
            return true;
        } catch (error) {
            echo('Write file failedd!!', error)
            this.destroy();
            return false;
        }
    }
    onMessage = (data: WS.Data) => {

        if (typeof (data) == 'string') {
            switch (data) {
                case 'SELESAI': {
                    this.data.finished = Date.now();
                    this.save();
                    this.ws.close();
                    break;
                }
                default: {
                    echo("Unhandled message", data)
                    break;
                }
            }
        } else {
            // is object, mean vote it!
            const raw = new Int8Array(data as Buffer);
            const [candidate, add] = raw;
            if (this.data.results[candidate]) {
                this.data.results[candidate].count += add;
                this.data.accepted += add;
            } else {
                this.data.declined += add;
            }
            this.data.total = this.data.accepted + this.data.declined;
            this.save();
            this.log('VOTE', candidate, add)
            // reply back of the total value
            this.ws.send(raw);
            echo(candidate, add)
        }
    }
    destroy() {
        if (this.file) {
            try {
                fs.closeSync(this.file); delete this.logFile
            } catch{ }
        }
        if (this.logFile) {
            try {
                fs.closeSync(this.logFile); delete this.logFile
            } catch{ }
        }
        //@ts-ignore
        if (this.ws && (this.ws.voter_handler || this.ws.readyState == WS.OPEN)) {
            try {
                this.ws.terminate()
            } catch { }
        }
        delete this.ws;
        delete this.req;
        delete this.voteFile;
        delete this.voteId;
    }
}

function acceptWSConnection(ws: WS, voteId: number, voteInfo, req: Request) {
    const voteFile = `${config.public_path}/${voteId}.json`;

    connectedVoters[voteId] = ws;

    ws.on("error", (err) => {
        echo("VOTER ERRR", voteId, err.message)
        ws.terminate();
        //@ts-ignore
        if (ws.voter_handler) {
            //@ts-ignore
            (ws.voter_handler as handleVoterWS).destroy()
            //@ts-ignore
            delete ws.voter_handler
        }
        delete connectedVoters[voteId];
    })
    ws.on('close', function incoming(message) {
        echo("VOTER CLOSED", voteId)
        //@ts-ignore
        if (ws.voter_handler) {
            //@ts-ignore
            (ws.voter_handler as handleVoterWS).destroy()
            //@ts-ignore
            delete ws.voter_handler
        }
        delete connectedVoters[voteId];
    });

    const handler = new handleVoterWS(ws, voteFile, req, voteId, voteInfo);
    //@ts-ignore
    ws.voter_handler = handler;
}

function handleWSConnection(ws: WS, req: Request, voteId: number) {
    let index = voteId,
        valid = false,
        passcode = req.headers['sec-websocket-protocol'] || '';


    const dataJson = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

    valid = dataJson[index] && passcode == dataJson[index].passcode;


    if (!valid) {
        echo("WS INVALID");
        return ws.terminate()
    }
    const voteInfo = dataJson[index];

    // Check if other connected
    const wsOther = connectedVoters[voteId]
    if (wsOther) {
        echo(`${voteId} Double checked`, ws.readyState);
        ws.ping('online', false, (err) => {
            if (err) {
                echo(`${voteId} Other error, accept it`);
                acceptWSConnection(ws, voteId, voteInfo, req);
            } else {
                echo(`${voteId} Other alive, kick it`);
                ws.terminate();
            }
        })
        // ping it maybe was disconnected
    } else {
        acceptWSConnection(ws, voteId, voteInfo, req);
    }


}

const websocket = new WS.Server({ noServer: true });
websocket.on('connection', handleWSConnection);

function serverUpgrade(request: Request, socket, head) {
    const pathname = parse(request.url).pathname;
    let match = pathname.match(/\/voter\/voting\/(\d+)$/)
    if (match && match.length) {
        websocket.handleUpgrade(request, socket, head, function done(ws) {
            websocket.emit('connection', ws, request, parseInt(match[1]));
        });
    } else {
        console.log('Destroy WS', pathname);
        socket.destroy();
    }
}
router.post('/check', (req, res) => {
    let index = parseInt(req.body.id);
    const dataJson = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

    if (dataJson[index] && req.body && req.body.passcode) {
        res.send({
            valid: req.body.passcode == dataJson[index].passcode
        })
    } else {
        throw { status: 404, message: 'Not valid' };
    }
});

export { router as VoterHandler, serverUpgrade as VoterServerUpgradeHandler };