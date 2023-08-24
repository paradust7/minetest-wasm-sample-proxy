'use strict';

import assert from 'assert';
import { isIPv4 } from 'net';

export function inet_pton(ip) {
    assert(isIPv4(ip));
    const ret = new ArrayBuffer(4);
    const v = new DataView(ret);
    var [a, b, c, d] = ip.split('.');
    v.setUint8(0, parseInt(a));
    v.setUint8(1, parseInt(b));
    v.setUint8(2, parseInt(c));
    v.setUint8(3, parseInt(d));
    return ret; // network order
}

export function inet_ntop(n) {
    assert(n instanceof ArrayBuffer)
    assert(n.byteLength == 4);
    const v = new DataView(n);
    const a = v.getUint8(0);
    const b = v.getUint8(1);
    const c = v.getUint8(2);
    const d = v.getUint8(3);
    return `${a}.${b}.${c}.${d}`;
}

// Make an untrusted string safe to print
export function sanitize(s) {
    return s.replace(/[^\x20-\x7E]/g, "");
}

// List the IP address(es) making the request.
// Because websocket requests can be forwarded
// between hosts, this may be a chain of addresses.
// These addresses are reported voluntarily by each host,
// and thus may or may not be accurate.
export function extract_ip_chain(request) {
    const chain = [];
    for (let entry of request.headers['x-forwarded-for'].split(',')) {
        chain.push(sanitize(entry.trim()));
    }
    chain.push(request.socket.remoteAddress);
    return chain;
}

// Returns a random integer in [a, b]
export function randint(a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
}
