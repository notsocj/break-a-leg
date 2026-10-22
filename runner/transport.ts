import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import type { Plan } from './types.ts';
import { resolvePath } from './plan.ts';

export type Response = { status: number; json: unknown; isJson: boolean };
const loopbackLookup: LookupFunction = (_host, options, callback) => {
  if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
  else callback(null, '127.0.0.1', 4);
};
export class ScopedTransport {
  plan: Plan;
  count = 0;
  lastStarted = 0;
  busy = false;
  stopped = false;
  constructor(plan: Plan) { this.plan = plan; }
  async get(path: string, token?: string, publicApiKey?: string): Promise<Response> {
    if (this.busy) throw new Error('Concurrent requests are disabled');
    if (this.stopped) throw new Error('Run stopped after a transport or server failure');
    if (this.count >= this.plan.limits.maxRequests) throw new Error('Request budget exhausted');
    const url = resolvePath(this.plan.target, path);
    this.busy = true;
    try {
      const pause = this.plan.limits.delayMs - (Date.now() - this.lastStarted);
      if (pause > 0) await new Promise(resolve => setTimeout(resolve, pause));
      this.lastStarted = Date.now(); this.count++;
      const headers: Record<string, string> = { accept: 'application/json', 'accept-encoding': 'identity', 'user-agent': 'BreakALeg/0.1.0' };
      if (token) headers.authorization = `Bearer ${token}`;
      if (publicApiKey) headers.apikey = publicApiKey;
      return await new Promise<Response>((resolve, reject) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout>;
        const finish = (response: Response) => {
          if (settled) return;
          settled = true; clearTimeout(timer); resolve(response);
        };
        const fail = (message: string) => {
          if (settled) return;
          settled = true; clearTimeout(timer); reject(new Error(message)); req.destroy();
        };
        const client = url.protocol === 'https:' ? https : http;
        const requestOptions: https.RequestOptions = {
          method: 'GET', headers, agent: false,
          // Do not inherit an insecure NODE_TLS_REJECT_UNAUTHORIZED setting.
          rejectUnauthorized: true,
          // localhost must never resolve to a remote address in local mode.
          ...(this.plan.environment === 'local' && url.hostname === 'localhost'
            ? { lookup: loopbackLookup } : {})
        };
        const req = client.request(url, requestOptions, res => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400) { fail('Redirects are blocked; review the exact target endpoint'); return; }
          if (status === 429 || status >= 500) { fail('Run stopped on rate limiting or a server error'); return; }
          if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') { fail('Compressed responses are unsupported'); return; }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on('data', chunk => {
            size += chunk.length;
            if (size > this.plan.limits.maxResponseBytes) fail('Response size limit exceeded');
            else chunks.push(chunk);
          });
          res.on('error', () => fail('Response interrupted'));
          res.on('aborted', () => fail('Response interrupted'));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json: unknown;
            try { json = JSON.parse(text); } catch { finish({ status, json: undefined, isJson: false }); return; }
            finish({ status, json, isJson: true });
          });
        });
        timer = setTimeout(() => fail('Request deadline exceeded'), this.plan.limits.timeoutMs);
        req.on('error', () => fail('Connection or TLS failure'));
        req.end();
      });
    } catch (error) {
      this.stopped = true;
      throw error;
    } finally { this.busy = false; }
  }
}
