import config from "@/config/config";
import * as fs from "fs";
import { Router, Request } from "express";
import * as WS from "ws";
import { parse } from "url";

const dataFile = `${config.public_path}/data.json`;
const dataPasscodeFile = `${config.data}/passcode.data.json`;
const router = Router();
const connectedVoters: { [id: number]: WS } = {};

class handleVoterWS {
    file: number
    logFile: number
    data: {
        started: number,
        // Total pemilih
        participant: number,
        updated?: number,
        finished?: number,
        accepted: number,
        declined: number,
        total: number,
        results: number[]
    };

    constructor(public ws: WS, public req: Request, public voteId: number) {
        const resultFile = `${config.public_path}/${voteId}.json`,
            logFile = `${config.public_path}/${voteId}.log`;

        let str;

        if (fs.existsSync(resultFile)) {
            str = fs.readFileSync(resultFile, 'utf8');
        }

        this.file = fs.openSync(resultFile, fs.constants.O_WRONLY | fs.constants.O_CREAT)
        this.logFile = fs.openSync(logFile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND);

        echo("OPENED FILE", resultFile, this.file)
        if (str && str.length > 10) {
            this.data = JSON.parse(str);
        } else {
            // just started vote
            const dataJson = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            const voteInfo = dataJson[voteId];
            //this just started
            this.data = {
                started: Date.now(),
                accepted: 0,
                declined: 0,
                total: 0,
                participant: parseInt(voteInfo.participant) || 0,
                results: voteInfo.candidates.map(v => 0),
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
            const remoteIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            this.log('Connected', remoteIp, req.headers["user-agent"]);
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
            if ( typeof(this.data.results[candidate]) != 'undefined' ) {
                this.data.results[candidate] += add;
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
        delete this.voteId;
    }
}

function removeWSConnection(ws, voteId) {
    try {
        ws.terminate && ws.terminate();
    } catch (error) { }
    //@ts-ignore
    if (ws.voter_handler) {
        //@ts-ignore
        (ws.voter_handler as handleVoterWS).destroy()
        //@ts-ignore
        delete ws.voter_handler
    }
    delete connectedVoters[voteId];
}

function acceptWSConnection(ws: WS, voteId: number, req: Request) {
    connectedVoters[voteId] = ws;

    ws.on("error", (err) => {
        echo("VOTER ERRR", voteId, err.message)
        removeWSConnection(ws, voteId)
    })
    ws.on('close', function incoming(message) {
        removeWSConnection(ws, voteId)
    });

    const handler = new handleVoterWS(ws, req, voteId);
    //@ts-ignore
    ws.voter_handler = handler;
}

function handleWSConnection(ws: WS, req: Request, voteId: number) {
    let index = voteId,
        valid = false,
        passcode = req.headers['sec-websocket-protocol'] || '';


    const passcodes = JSON.parse(fs.readFileSync(dataPasscodeFile, 'utf8'));

    valid = passcodes[index] && passcode == passcodes[index];


    if (!valid) {
        echo("WS INVALID");
        return ws.terminate()
    }

    // Check if other connected
    const wsOther = connectedVoters[voteId]
    if (wsOther) {
        echo(`${voteId} Double checked`, ws.readyState);
        ws.ping('online', false, (err) => {
            if (err) {
                echo(`${voteId} Other error, accept it`);
                acceptWSConnection(ws, voteId, req);
            } else {
                echo(`${voteId} Other alive, kick it`);
                ws.terminate();
            }
        })
        // ping it maybe was disconnected
    } else {
        acceptWSConnection(ws, voteId, req);
    }


}

const websocket = new WS.Server({ noServer: true });
websocket.on('connection', handleWSConnection);

function serverUpgrade(request: Request, socket, head) {
    const pathname = parse(request.url).pathname;
    let match = pathname.match(/\/voter\/voting\/(\d+)$/)

    // Dont accept if no passcode files!
    if (match && match.length && fs.existsSync(dataPasscodeFile)) {
        websocket.handleUpgrade(request, socket, head, (ws) => {
            websocket.emit('connection', ws, request, parseInt(match[1]));
        });
    } else {
        echo('Destroy WS', pathname);
        socket.destroy();
    }
}
router.post('/check', (req, res) => {
    let index = parseInt(req.body.id);
    let passcodes = fs.existsSync(dataPasscodeFile) ?
        JSON.parse(fs.readFileSync(dataPasscodeFile, 'utf8')) : [];

    if (passcodes[index] && req.body && req.body.passcode) {
        res.send({
            valid: req.body.passcode == passcodes[index]
        })
    } else {
        throw { status: 404, message: 'Not valid' };
    }
});

export { router as VoterHandler, serverUpgrade as VoterServerUpgradeHandler };