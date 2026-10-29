// Kullanım: node --experimental-websocket cdp.mjs <port> <js>
const [port, expr] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = list.find(p => p.type === 'page' && p.url.includes('page.html'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression: expr, userGesture: true, awaitPromise: true, returnByValue: true}}));
ws.onmessage = e => { console.log(JSON.stringify(JSON.parse(e.data).result?.result ?? JSON.parse(e.data))); process.exit(0); };
setTimeout(() => { console.log('timeout'); process.exit(1); }, 8000);
