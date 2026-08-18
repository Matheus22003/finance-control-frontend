const API_PREFIX = "/api/";

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);

    if (requestUrl.pathname === "/health") {
      return new Response(JSON.stringify({ status: "Healthy" }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (requestUrl.pathname.startsWith(API_PREFIX)) {
      return proxyToBff(request, env);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || request.method !== "GET") {
      return withSecurityHeaders(assetResponse);
    }

    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("text/html")) {
      return withSecurityHeaders(assetResponse);
    }

    const indexUrl = new URL("/index.html", request.url);
    return withSecurityHeaders(
      await env.ASSETS.fetch(new Request(indexUrl, request)),
    );
  },
};

async function proxyToBff(request, env) {
  if (!env.BFF_ORIGIN || !env.ORIGIN_VERIFY_TOKEN) {
    return problem(
      503,
      "Service unavailable",
      "The public API origin is not configured.",
      new URL(request.url).pathname,
    );
  }

  let upstreamBaseUrl;
  try {
    upstreamBaseUrl = new URL(env.BFF_ORIGIN);
  } catch {
    return problem(
      503,
      "Service unavailable",
      "The configured public API origin is invalid.",
      new URL(request.url).pathname,
    );
  }

  if (upstreamBaseUrl.protocol !== "https:") {
    return problem(
      503,
      "Service unavailable",
      "The public API origin must use HTTPS.",
      new URL(request.url).pathname,
    );
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(upstreamBaseUrl);
  upstreamUrl.pathname = requestUrl.pathname;
  upstreamUrl.search = requestUrl.search;

  const upstreamRequest = new Request(upstreamUrl, request);
  upstreamRequest.headers.delete("x-origin-verify");
  upstreamRequest.headers.set("x-origin-verify", env.ORIGIN_VERIFY_TOKEN);
  upstreamRequest.headers.set("x-forwarded-host", requestUrl.host);
  upstreamRequest.headers.set("x-forwarded-proto", "https");

  try {
    return await fetch(upstreamRequest, { redirect: "manual" });
  } catch {
    return problem(
      502,
      "Bad gateway",
      "The public API origin could not be reached.",
      requestUrl.pathname,
    );
  }
}

function withSecurityHeaders(response) {
  const securedResponse = new Response(response.body, response);
  securedResponse.headers.set("x-content-type-options", "nosniff");
  securedResponse.headers.set("x-frame-options", "DENY");
  securedResponse.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  securedResponse.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()",
  );
  return securedResponse;
}

function problem(status, title, detail, instance) {
  return new Response(
    JSON.stringify({
      type: "about:blank",
      title,
      status,
      detail,
      instance,
    }),
    {
      status,
      headers: {
        "content-type": "application/problem+json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
