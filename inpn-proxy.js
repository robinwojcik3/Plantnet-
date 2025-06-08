// netlify/functions/inpn-proxy.js
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

exports.handler = async (event) => {
  const cd   = event.queryStringParameters.cd;      // ex. 99910
  const type = event.queryStringParameters.type;    // "carte" | "statut"
  if(!cd || !type) return { statusCode:400, body:"missing params" };

  const url = `https://inpn.mnhn.fr/espece/cd_nom/${cd}/tab/${type}`;
  const resp = await fetch(url);
  if(!resp.ok) return { statusCode:resp.status, body:"fetch error" };

  const html = await resp.text();
  const dom  = new JSDOM(html);
  const doc  = dom.window.document;

  let fragment;
  if(type==="carte"){
    fragment = doc.querySelector("canvas.ol-unselectable");
  }else if(type==="statut"){
    fragment = doc.querySelector("section#section");
  }else{
    return { statusCode:400, body:"bad type" };
  }
  if(!fragment) return { statusCode:404, body:"fragment not found" };

  return {
    statusCode:200,
    headers:{ "content-type":"text/html; charset=utf-8",
              "cache-control":"public, max-age=86400" },
    body: fragment.outerHTML
  };
};
