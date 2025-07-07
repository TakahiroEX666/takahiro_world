export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === "/api/hello") {
      return new Response("Hello from API!", { status: 200 })
    }

    // ถ้าไม่ใช่ API → ส่ง static file
    return env.ASSETS.fetch(request)
  },
}
