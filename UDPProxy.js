'use strict';

import dgram from 'dgram';

export class UDPProxy {
    constructor(client, ip, port) {
        const socket = dgram.createSocket('udp4');
        this.client = client;
        this.socket = socket;
        this.ip = ip;
        this.port = port;
        this.sendok = false;
        this.sendqueue = [];
        socket.on('listening', this.handle_listening.bind(this));
        socket.on('error', this.handle_error.bind(this));
        socket.on('message', this.handle_message.bind(this));
        socket.bind();
    }

    forward(data) {
        // This creates a view of the ArrayBuffer
        data = new Uint8Array(data);
        if (data.byteLength < 4 ||
            data[0] != 0x4f ||
            data[1] != 0x45 ||
            data[2] != 0x74 ||
            data[3] != 0x03) {
            throw new Error('Client sent packet with invalid protocol.');
        }

        if (this.sendok) {
            // data must be a typed array here
            this.socket.send(data, this.port, this.ip);
        } else {
            this.sendqueue.push(data);
        }
    }

    handle_listening() {
        const sourcePort = this.socket.address().port;
        this.log(`Bound ${sourcePort} -> ${this.ip}:${this.port}`);
        this.sendok = true;
        if (this.sendqueue.length > 0) {
            for (const data of this.sendqueue) {
                this.socket.send(data, this.port, this.ip);
            }
            this.sendqueue = [];
        }
    }

    handle_error(err) {
        this.log("Socket error: " + err);
        this.close();
    }

    handle_message(msg, rinfo) {
        if (rinfo.address != this.ip || rinfo.port != this.port) {
            this.log("Ignoring unsolicited packet from " + rinfo.address + " port " + rinfo.port);
            return;
        }
        this.client.send(msg);
    }

    log(msg) {
        this.client.log(msg);
    }

    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.client.close();
    }
}
