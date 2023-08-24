'use strict';

const PROXY_PORT = 8888;

import { WebSocketServer } from 'ws';
import { Client } from './client.js';

const options = {};
options.port = PROXY_PORT;
const wss = new WebSocketServer(options);

let connId = 1;
wss.on('connection', (socket, request) => {
    new Client(connId++, socket, request);
});

console.log(`Proxy listening on port ${PROXY_PORT}`);
