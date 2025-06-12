const fs = require('fs');
const vm = require('vm');

function loadHandler(mockFetch) {
  const code = fs.readFileSync('netlify/functions/inpn-proxy.js', 'utf-8');
  const patched = code.replace(
    /const fetch = \(\.\.\.args\) => import\("node-fetch"\)\.then\(\(\{default: f\}\) => f\(\.\.\.args\)\);/,
    'const fetch = (...args) => global.__fetch(...args);'
  );
  const context = { require, console, exports: {}, __fetch: mockFetch };
  context.global = context;
  vm.createContext(context);
  vm.runInContext(patched, context);
  return context.exports.handler;
}

function mockFetch(html) {
  return jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(html)
  });
}

describe('inpn-proxy handler', () => {
  test('extracts canvas for carte type', async () => {
    const html = '<html><body><canvas class="ol-unselectable"></canvas></body></html>';
    const fetchMock = mockFetch(html);
    const handler = loadHandler(fetchMock);
    const res = await handler({ queryStringParameters: { cd: '1', type: 'carte' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('<canvas class="ol-unselectable"></canvas>');
  });

  test('returns 404 when fragment missing', async () => {
    const html = '<html><body></body></html>';
    const fetchMock = mockFetch(html);
    const handler = loadHandler(fetchMock);
    const res = await handler({ queryStringParameters: { cd: '1', type: 'statut' } });
    expect(res.statusCode).toBe(404);
  });
});
