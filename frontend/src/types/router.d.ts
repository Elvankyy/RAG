import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    permission?: string
    menu?: string
    hidden?: boolean
    description?: string
    apiHint?: string
  }
}

export {}
