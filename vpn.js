'use strict';

import assert from 'assert';
import { randint, inet_ntop, inet_pton } from './util.js';
import { randomBytes } from 'crypto';

function rand_vpn_code() {
    return randomBytes(6).toString("hex").toUpperCase();
}

const vpns = new Map();

class VPN {
    constructor() {
        this.serverCode = rand_vpn_code();
        this.clientCode = rand_vpn_code();
        this.game = null; // not tracked
        this.targets = new Map();
        vpns.set(this.serverCode, this);
        vpns.set(this.clientCode, this);
    }

    route(ip, port) {
        let addr = `${ip}:${port}`;
        if (this.targets.has(addr)) {
            return this.targets.get(addr);
        }
        return null;
    }
};

export function vpn_make(game) {
    const vpn = new VPN();
    return [vpn.serverCode, vpn.clientCode];
}

export function vpn_connect(client, code, bindport) {
    if (!vpns.has(code)) return null;
    const vpn = vpns.get(code);
    return new VPNTarget(vpn, client, code, bindport);
}

class VPNTarget {
    constructor(vpn, client, code, bindport) {
        this.vpn = vpn;
        this.client = client;
        this.bindport = bindport;
        if (code == vpn.serverCode) {
            this.ip = '172.16.0.1';
        } else if (code == vpn.clientCode) {
            const b = randint(16, 32);
            const c = randint(1, 254);
            const d = randint(1, 254);
            this.ip = `172.${b}.${c}.${d}`;
        } else {
            throw new Error('Invalid code');
        }
        this.addr = `${this.ip}:${this.bindport}`;
        vpn.targets.set(this.addr, this);
        client.log("VPN connect to ${this.addr}");
    }

    // Forward a message from the client
    forward(data) {
        // Data is encapsulated with a 12 byte header.
        // Magic      - 4 bytes 0x778B4CF3
        // Dest IP    - 4 bytes 0xAABBCCDD for AA.BB.CC.DD
        // Dest Port  - 2 bytes
        // Packet Len - 2 bytes
        const EP_MAGIC = 0x778B4CF3;
        assert(data instanceof ArrayBuffer);
        const view = new DataView(data);
        assert(data.byteLength >= 12);
        assert(view.getUint32(0) == EP_MAGIC);
        const dest_ip = inet_ntop(data.slice(4, 8));
        const dest_port = view.getUint16(8);
        const pktlen = view.getUint16(10);
        assert(data.byteLength == 12 + pktlen);
        const remote = this.vpn.route(dest_ip, dest_port);
        if (!remote) {
            // Packet is dropped
            this.client.log(`${this.addr} -> ${dest_ip}:${dest_port} (dropped)`);
            return;
        } else {
            this.client.log(`${this.addr} -> ${remote.addr}`);
        }

        // Rewrite the header to contain source ip/port
        (new Uint8Array(data, 4, 4)).set(new Uint8Array(inet_pton(this.ip)));
        view.setUint16(8, this.bindport);
        remote.client.send(data);
    }

    close() {
        this.client.close();
    }
}
