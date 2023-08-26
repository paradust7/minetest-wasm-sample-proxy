
export const PROXY_PORT = 8888;

// [virtual_ip, real_ip, real_port]
//
// The virtual IP is the one that minetest-wasm sees.
// The virtual port is the same as the real port.
//
export const DIRECT_PROXY = [
    // This allows clients to connect to a server running on the proxy itself.
    ['192.168.0.1', '127.0.0.1', 30000],

    // This would allow clients to connect to 1.2.3.4, port 40000
    //['192.168.0.2', '1.2.3.4', 40000],
];
