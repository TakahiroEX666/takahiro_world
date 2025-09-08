 export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Endpoint for Google Maps URL parsing
    if (url.pathname === "/api/parse-maps-url") {
      const COORDS_REGEX = /@(-?\d+\.\d+),(-?\d+\.\d+),?/;
      const userProvidedUrl = url.searchParams.get('url');

      if (!userProvidedUrl) {
        return new Response(JSON.stringify({
          error: 'URL parameter missing',
          message: 'Please provide a Google Maps URL in the "url" query parameter. Example: /api/parse-maps-url?url=https://maps.app.goo.gl/...'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      let finalUrl = userProvidedUrl;
      try {
        const response = await fetch(userProvidedUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Cloudflare Worker'
          }
        });
        finalUrl = response.url;
      } catch (e) {
        return new Response(JSON.stringify({
          error: 'Failed to resolve URL',
          message: `Could not resolve the provided URL. Error: ${e.message}`
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const match = finalUrl.match(COORDS_REGEX);
      if (match && match.length >= 3) {
        const latitude = parseFloat(match[1]);
        const longitude = parseFloat(match[2]);

        return new Response(JSON.stringify({
          latitude: latitude,
          longitude: longitude
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
        return new Response(JSON.stringify({
          error: 'Coordinates not found',
          message: 'Could not find latitude and longitude in the resolved URL. Please ensure it is a valid Google Maps link.'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // 踏 Upload file
    if (url.pathname === "/api/upload" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string") {
          return new Response("No file uploaded", { status: 400 });
        }
        const arrayBuffer = await file.arrayBuffer();
        await env.MY_BUCKET.put(file.name, arrayBuffer);
        return new Response(JSON.stringify({ success: true, name: file.name }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response("Upload error: " + err.message, { status: 500 });
      }
    }

    // 唐 List files
    if (url.pathname === "/api/list") {
      const objects = await env.MY_BUCKET.list();
      return Response.json(objects.objects.map(o => ({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded.toISOString()
      })));
    }

    // 豆 Download file
    if (url.pathname.startsWith("/api/get/")) {
      const key = decodeURIComponent(url.pathname.replace("/api/get/", ""));
      const object = await env.MY_BUCKET.get(key);
      if (!object) return new Response("Not found", { status: 404 });
      return new Response(object.body, {
        headers: { "Content-Type": "application/octet-stream" }
      });
    }

    // 卵ｸDelete file
    if (url.pathname.startsWith("/api/delete/") && request.method === "DELETE") {
      const key = decodeURIComponent(url.pathname.replace("/api/delete/", ""));
      await env.MY_BUCKET.delete(key);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 刀 Create folder (fake folder using object key ending with "/")
    if (url.pathname === "/api/create-folder" && request.method === "POST") {
      try {
        const { name } = await request.json();
        if (!name) return new Response("Missing folder name", { status: 400 });
        const key = name.endsWith("/") ? name : name + "/";
        await env.MY_BUCKET.put(key, new Uint8Array(0)); // empty object
        return new Response(JSON.stringify({ success: true, key }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response("Create folder error: " + err.message, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};

       
