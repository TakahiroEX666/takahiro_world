export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 📂 list files
    if (url.pathname === "/api/list") {
      const objects = await env.MY_BUCKET.list();
      return Response.json(objects.objects.map(o => ({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded.toISOString()
      })));
    }

    // 📥 upload file
    if (url.pathname === "/api/upload" && request.method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return new Response("No file", { status: 400 });

      await env.MY_BUCKET.put(file.name, file.stream());
      return new Response("Uploaded");
    }

    // 📤 download file
    if (url.pathname.startsWith("/api/get/")) {
      const key = url.pathname.replace("/api/get/", "");
      const object = await env.MY_BUCKET.get(key);
      if (!object) return new Response("Not found", { status: 404 });
      return new Response(object.body, {
        headers: { "Content-Type": "application/octet-stream" }
      });
    }

    // 🗑️ delete file
    if (url.pathname.startsWith("/api/delete/") && request.method === "DELETE") {
      const key = url.pathname.replace("/api/delete/", "");
      await env.MY_BUCKET.delete(key);
      return new Response("Deleted");
    }

    return new Response("Not found", { status: 404 });
  }
};
