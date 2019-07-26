import config from "@/config/config";
import * as fs from "fs";
import { Router, Request } from "express";
import * as WS from "ws";
import { parse } from "url";

const dataFile = `${config.public_path}/data.json`;
const dataPasscodeFile = `${config.data}/passcode.data.json`;
const router = Router();
const connectedVoters: { [id: string]: WS } = {};

class handleVoterWS {
    resultFileHandle: number
    logFileHandle: number
    resultFile: string
    lastResultLength = 0;

    data: {
        started: number,
        updated?: number,
        finished?: number,
        accepted: number,
        declined: number,
        total: number,
        results: number[]
    };

    constructor(public ws: WS, public req: Request, public voteId: number, public locationId: number) {
        this.resultFile = `${config.public_path}/${voteId}-${locationId}.json`;
        const logFile = `${config.public_path}/${voteId}-${locationId}.log`;

        let str;

        if (fs.existsSync(this.resultFile)) {
            str = fs.readFileSync(this.resultFile, 'utf8');
        }

        this.resultFileHandle = fs.openSync(this.resultFile, fs.constants.O_WRONLY | fs.constants.O_CREAT)
        this.logFileHandle = fs.openSync(logFile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND);

        echo("OPENED FILE", this.resultFile, this.resultFileHandle)
        if (str && str.length > 10) {
            try {
                this.data = JSON.parse(str);
                this.lastResultLength = str.length;
            } catch (error) {
                ws.send(error.message, () => ws.close());
                return;
            }
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
                results: voteInfo.candidates.map(v => 0),
            };
            str = JSON.stringify(this.data);
            this.save()
        }
        if (this.data.finished) {
            ws.send(str, () => ws.close());
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
            fs.writeSync(this.logFileHandle, data.join(' ') + "\n");
        } catch (error) {
            echo('Write Log failedd!!', error)
            this.destroy();
        }
    }
    save() {
        try {
            this.data.updated = Date.now();
            const str = JSON.stringify(this.data);
            fs.writeSync(this.resultFileHandle, str , 0, 'utf8');
            if( str.length < this.lastResultLength ){
                fs.truncateSync(this.resultFile, str.length);
            }
            this.lastResultLength = str.length;
        } catch (error) {
            echo('Write file failedd!!', error)
            this.destroy();
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
            if (typeof (this.data.results[candidate]) != 'undefined') {
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
        if (this.resultFileHandle) {
            try {
                fs.closeSync(this.resultFileHandle); delete this.logFileHandle
            } catch{ }
        }
        if (this.logFileHandle) {
            try {
                fs.closeSync(this.logFileHandle); delete this.logFileHandle
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

function removeWSConnection(ws, voteId, locationId:number) {
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
    delete connectedVoters[`${voteId}-${locationId}`];
}

function acceptWSConnection(ws: WS, voteId: number, locationId:number, req: Request) {
    connectedVoters[`${voteId}-${locationId}`] = ws;

    ws.on("error", (err) => {
        echo("VOTER ERRR", voteId, err.message)
        removeWSConnection(ws, voteId, locationId)
    })
    ws.on('close', function incoming(message) {
        removeWSConnection(ws, voteId, locationId)
    });

    const handler = new handleVoterWS(ws, req, voteId, locationId);
    //@ts-ignore
    ws.voter_handler = handler;
}

function handleWSConnection(ws: WS, req: Request, voteId: number, locationId: number) {
    let valid = false,
        passcode = req.headers['sec-websocket-protocol'] || '';


    const passcodes = JSON.parse(fs.readFileSync(dataPasscodeFile, 'utf8'));
    if (typeof (passcodes[voteId]) != 'object' || typeof (passcodes[voteId][locationId]) != 'string') {
        echo("WS PASSCODE NOT IN INDEX");
        return ws.terminate()
    }
    valid = passcode == passcodes[voteId][locationId];

    if (!valid) {
        echo("WS INVALID",passcode, passcodes[voteId][locationId]);
        return ws.send(':Invalid Passcode', () => ws.terminate());
    }

    // Check if other connected
    const wsOther = connectedVoters[`${voteId}-${locationId}`]
    if (wsOther) {
        echo(`${voteId} Double checked`, ws.readyState);
        ws.ping('online', false, (err) => {
            if (err) {
                echo(`${voteId} Other error, accept it`);
                acceptWSConnection(ws, voteId, locationId, req);
            } else {
                echo(`${voteId} Other alive, kick it`);
                return ws.send(':Terdeteksi login dobel', () => ws.terminate());
            }
        })
        // ping it maybe was disconnected
    } else {
        acceptWSConnection(ws, voteId, locationId, req);
    }


}

const websocket = new WS.Server({ noServer: true });
websocket.on('connection', handleWSConnection);

function serverUpgrade(request: Request, socket, head) {
    const pathname = parse(request.url).pathname;
    let match = pathname.match(/\/voter\/voting\/(\d+)\/(\d+)$/)

    // Dont accept if no passcode files!
    if (match && match.length && fs.existsSync(dataPasscodeFile)) {
        websocket.handleUpgrade(request, socket, head, (ws) => {
            websocket.emit('connection', ws, request, parseInt(match[1]), parseInt(match[2]));
        });
    } else {
        echo('Destroy WS', pathname);
        socket.destroy();
    }
}
router.post('/check', (req, res) => {
    let index = parseInt(req.body.id);
    let indexLocation = parseInt(req.body.location);
    let passcodes = fs.existsSync(dataPasscodeFile) ?
        JSON.parse(fs.readFileSync(dataPasscodeFile, 'utf8')) : [];

    if (typeof (passcodes[index]) != 'object' || typeof (passcodes[index][indexLocation]) != 'string') {
        throw { status: 404, message: 'Not Found' };
    }
    if (req.body && req.body.passcode) {
        res.send({
            valid: req.body.passcode == passcodes[index][indexLocation]
        })
    } else {
        throw { status: 404, message: 'Not valid' };
    }
});

export { router as VoterHandler, serverUpgrade as VoterServerUpgradeHandler };