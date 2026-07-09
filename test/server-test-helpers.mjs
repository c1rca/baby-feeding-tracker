import assert from 'node:assert/strict'

export const createFakeApp = () => {
  const routes = new Map()
  return {
    get(path, handler) {
      routes.set(`GET ${path}`, handler)
    },
    put(path, handler) {
      routes.set(`PUT ${path}`, handler)
    },
    post(path, handler) {
      routes.set(`POST ${path}`, handler)
    },
    delete(path, handler) {
      routes.set(`DELETE ${path}`, handler)
    },
    route(method, path) {
      const handler = routes.get(`${method} ${path}`)
      assert.equal(typeof handler, 'function', `${method} ${path} was not registered`)
      return handler
    },
  }
}

export const createJsonResponse = () => {
  const response = {
    headers: new Map(),
    body: undefined,
    set(key, value) {
      if (typeof key === 'object') {
        for (const [header, headerValue] of Object.entries(key)) response.headers.set(header, headerValue)
      } else {
        response.headers.set(key, value)
      }
    },
    status(code) {
      response.statusCode = code
      return response
    },
    json(payload) {
      response.body = payload
    },
  }
  return response
}
