'use strict';

import assert from 'assert';
import { isIPv4 } from 'net';
import { format } from 'util'; // node.js built-in

import { DIRECT_PROXY } from './settings.js';
import { ConnectProxy } from './ConnectProxy.js';
import { UDPProxy } from './UDPProxy.js';
import { extract_ip_chain, sanitize } from './util.js';
import { vpn_make, vpn_connect} from './vpn.js';
const textDecoder = new TextDecoder();

let lastlog = null;
let lastlogcount = 0;

export class Client {
    constructor(id, socket, request) {
        this.id = id;
        this.socket = socket;
        this.ip_chain = extract_ip_chain(request);
        this.target = null;
        this.socket.on('message', this.handle_message.bind(this));
        this.socket.on('error', this.handle_error.bind(this));
        this.socket.on('close', this.handle_close.bind(this));
        this.log("New client from ", this.ip_chain);
    }

    log() {
        let line = [`[CLIENT ${this.id}]`, ...arguments].map(o => format("%s", o)).join(" ");
        if (lastlog != line) {
            if (lastlogcount > 0) {
                console.log(lastlog + ` [repeated ${lastlogcount} times]`);
            }
            console.log(line);
            lastlog = line;
            lastlogcount = 0;
        } else {
            lastlogcount++;
        }
    }

    send(data) {
        let binary =
            Buffer.isBuffer(data) ||
            (data instanceof ArrayBuffer) ||
            ArrayBuffer.isView(data);
        if (this.socket) {
            this.socket.send(data, {binary});
        }
    }

    close() {
        let socket = this.socket;
        this.socket = null;
        if (socket) {
            socket.close();
        }
        let target = this.target;
        this.target = null;
        if (target) {
            target.close();
        }
    }

    handle_error() {
        this.log("Error");
        this.close();
    }

    handle_close() {
        this.socket = null;
        this.close();
    }

    handle_message(buffer, isBinary) {
        // node.js specific fix: Convert Buffer to ArrayBuffer
        buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        if (!isBinary) {
            buffer = textDecoder.decode(buffer);
        }
        if (this.target) {
            this.target.forward(buffer);
        } else {
            this.handle_command(buffer);
        }
    }

    handle_command(data) {
        data = sanitize(data);
        let tokens = data.split(' ');
        let command = tokens[0];
        let response = null;
        if (command == 'MAKEVPN') {
            const game = tokens[1];
            const [serverCode, clientCode] = vpn_make(game);
            response = `NEWVPN ${serverCode} ${clientCode}`;
        } else if (command == 'VPN') {
            const code = tokens[1];
            const bindport = parseInt(tokens[5], 10);
            this.target = vpn_connect(this, code, bindport);
            if (this.target == null) {
                this.log(`VPN connect failed`);
                this.close();
                return;
            }
            response = 'BIND OK';
        } else if (command == 'PROXY') {
            assert(tokens[2] == 'TCP' || tokens[2] == 'UDP');
            const isUDP = (tokens[2] == 'UDP');
            const ip = sanitize(tokens[3]);
            const port = parseInt(sanitize(tokens[4]));
            assert(isIPv4(ip));
            assert(port >= 1 && port < 65536);
            this.target = route(this, isUDP, ip, port);
            if (!this.target) {
                this.log(`Proxy to udp=${isUDP}, ip=${ip}, port=${port} rejected`);
                response = 'PROXY FAIL';
            } else {
                response = 'PROXY OK';
            }
        } else {
            this.log('Unhandled command: ', data);
            this.close();
            return;
        }
        this.send(response);
    }

}

const PROXY_MAP = new Map(DIRECT_PROXY.map(([vip,ip,port]) => [vip, [ip, port]]));

function route(client, isUDP, ip, port) {
    if (!isUDP && ip == '10.0.0.1' && port == 8080) {
        return new ConnectProxy(client);
    }
    if (isUDP && PROXY_MAP.has(ip)) {
        let [real_ip, real_port] = PROXY_MAP.get(ip);
        return new UDPProxy(client, real_ip, real_port);
    }

    return null;
}
