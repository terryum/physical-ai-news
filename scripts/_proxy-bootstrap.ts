import { ProxyAgent, setGlobalDispatcher } from "undici";

const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  console.log(`[proxy] Routing outbound fetch through ${new URL(proxyUrl).host}`);
}
