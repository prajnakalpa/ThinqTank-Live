// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
// Forward pathname as a request header so Server Components
// can access it via headers().get('x-pathname')
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-pathname', request.nextUrl.pathname)

let supabaseResponse = NextResponse.next({
request: {
headers: requestHeaders,
},
})

const supabase = createServerClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
{
cookies: {
getAll() {
return request.cookies.getAll()
},
setAll(cookiesToSet) {
cookiesToSet.forEach(({ name, value }) =>
request.cookies.set(name, value)
)

```
      supabaseResponse = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })

      cookiesToSet.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(name, value, options)
      )
    },
  },
}
```

)

await supabase.auth.getUser()

return supabaseResponse
}

export const config = {
matcher: [
'/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
],
}
