import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// POST /api/auth - Login
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { password } = body

        // Get admin password from environment variable
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

        if (password !== adminPassword) {
            return NextResponse.json(
                { error: '密码错误' },
                { status: 401 }
            )
        }

        // Set auth cookie (valid for 7 days)
        const cookieStore = await cookies()
        cookieStore.set('emby-insight-auth', 'authenticated', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Login failed:', error)
        return NextResponse.json({ error: 'Login failed' }, { status: 500 })
    }
}

// DELETE /api/auth - Logout
export async function DELETE() {
    try {
        const cookieStore = await cookies()
        cookieStore.delete('emby-insight-auth')
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Logout failed:', error)
        return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
    }
}

// GET /api/auth - Check auth status
export async function GET() {
    try {
        const cookieStore = await cookies()
        const authCookie = cookieStore.get('emby-insight-auth')

        if (authCookie?.value === 'authenticated') {
            return NextResponse.json({ authenticated: true })
        }

        return NextResponse.json({ authenticated: false })
    } catch {
        return NextResponse.json({ authenticated: false })
    }
}
