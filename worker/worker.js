export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    // route helpers
    const json = (obj, status=200, headers={}) => new Response(JSON.stringify(obj), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", ...cors(), ...headers }
    });
    const text = (t, status=200) => new Response(t, { status, headers: { ...cors() }});
    const cors = () => ({
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors() });

    // bind bucket
    const bucket = env.R2_BUCKET; // <<— ตั้งค่า binding R2 ใน wrangler.toml เป็น R2_BUCKET

    // GET /api/list?prefix=
    if (pathname === "/api/list" && req.method === "GET") {
      const prefix = searchParams.get("prefix") || "";
      const list = await bucket.list({ prefix, delimiter: "/" });
      // standardize outputs
      const objects = list.objects.map(o => ({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded?.toISOString?.(),
        httpMetadata: o.httpMetadata
      }));
      const prefixes = list.delimitedPrefixes || [];
      return json({ objects, prefixes });
    }

    // POST /api/upload?key=foo/bar.jpg   (body = file blob)
    if (pathname === "/api/upload" && req.method === "POST") {
      const key = searchParams.get("key");
      if (!key) return json({ error: "missing key" }, 400);
      const body = req.body;
      const ctype = req.headers.get("content-type") || undefined;
      await bucket.put(key, body, { httpMetadata: { contentType: ctype } });
      return json({ ok: true, key });
    }

    // POST /api/mkdir   { prefix: "folder/" }
    if (pathname === "/api/mkdir" && req.method === "POST") {
      const { prefix } = await req.json();
      if (!prefix || !prefix.endsWith("/")) return json({ error: "prefix must end with '/'" }, 400);
      await bucket.put(prefix, new Uint8Array(0));
      return json({ ok: true, prefix });
    }

    // POST /api/rename  { from, to }
    if (pathname === "/api/rename" && req.method === "POST") {
      const { from, to } = await req.json();
      if (!from || !to) return json({ error: "missing from/to" }, 400);
      await bucket.copy(from, to);
      await bucket.delete(from);
      return json({ ok: true, from, to });
    }

    // DELETE /api/object?key=...
    if (pathname === "/api/object" && req.method === "DELETE") {
      const key = searchParams.get("key");
      if (!key) return json({ error: "missing key" }, 400);
      await bucket.delete(key);
      return json({ ok: true });
    }

    // GET /api/object?key=...&download=1  (download with attachment)
    if (pathname === "/api/object" && req.method === "GET") {
      const key = searchParams.get("key");
      if (!key) return json({ error: "missing key" }, 400);
      const obj = await bucket.get(key);
      if (!obj) return json({ error: "not found" }, 404);
      const headers = new Headers(cors());
      const meta = obj.httpMetadata || {};
      headers.set("content-type", meta.contentType || "application/octet-stream");
      if (searchParams.get("download"))
        headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(key.split('/').pop())}`);
      return new Response(obj.body, { headers });
    }

    // GET /api/preview?key=... (inline stream for iframe/img/video/audio)
    if (pathname === "/api/preview" && req.method === "GET") {
      const key = searchParams.get("key");
      if (!key) return json({ error: "missing key" }, 400);
      const obj = await bucket.get(key);
      if (!obj) return json({ error: "not found" }, 404);
      const headers = new Headers(cors());
      const meta = obj.httpMetadata || {};
      headers.set("content-type", meta.contentType || "application/octet-stream");
      // allow simple range-less streaming
      return new Response(obj.body, { headers });
    }

    return text("Not Found", 404);
  }
}
