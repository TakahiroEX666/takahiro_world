export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 📥 Upload file
    if (url.pathname === "/api/upload" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string") {
          return new Response("No file uploaded", { status: 400 });
        }

        // ใช้ arrayBuffer() แทน stream()
        const arrayBuffer = await file.arrayBuffer();
        await env.MY_BUCKET.put(file.name, arrayBuffer);

        return new Response(JSON.stringify({ success: true, name: file.name }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response("Upload error: " + err.message, { status: 500 });
      }
    }

    // 📂 List files
    if (url.pathname === "/api/list") {
      const objects = await env.MY_BUCKET.list();
      return Response.json(objects.objects.map(o => ({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded.toISOString()
      })));
    }

    // 📤 Download file
    if (url.pathname.startsWith("/api/get/")) {
      const key = decodeURIComponent(url.pathname.replace("/api/get/", ""));
      const object = await env.MY_BUCKET.get(key);
      if (!object) return new Response("Not found", { status: 404 });
      return new Response(object.body, {
        headers: { "Content-Type": "application/octet-stream" }
      });
    }

    // 🗑️ Delete file
    if (url.pathname.startsWith("/api/delete/") && request.method === "DELETE") {
      const key = decodeURIComponent(url.pathname.replace("/api/delete/", ""));
      await env.MY_BUCKET.delete(key);
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response("Not found", { status: 404 });
  }
};
