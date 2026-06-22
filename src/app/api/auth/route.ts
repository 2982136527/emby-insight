import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { timingSafeEqual } from 'crypto'

// 简单速率限制（内存计数器）
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 60 * 1000 // 1 分钟

function checkRateLimit(ip: string): boolean {
    const now = Date.now()
    const record = loginAttempts.get(ip)
    if (!record || now > record.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
        return true
    }
    if (record.count >= MAX_LOGIN_ATTEMPTS) return false
    record.count++
    return true
}

// 常量时间字符串比较
function timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    return timingSafeEqual(bufA, bufB)
}

// 密码哈希工具函数
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
}

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
}

// POST /api/auth - Login
export async function POST(request: NextRequest) {
    try {
        // 速率限制
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: '登录尝试过于频繁，请稍后再试' },
                { status: 429 }
            )
        }

        const body = await request.json()
        const { password } = body

        if (!password || typeof password !== 'string') {
            return NextResponse.json(
                { error: '密码不能为空' },
                { status: 400 }
            )
        }

        // Get admin password from environment variable
        const adminPassword = process.env.ADMIN_PASSWORD
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH

        if (!adminPassword && !adminPasswordHash) {
            console.error('[Auth] 未配置 ADMIN_PASSWORD 或 ADMIN_PASSWORD_HASH 环境变量，拒绝登录')
            return NextResponse.json(
                { error: '服务器未配置管理员密码，请设置环境变量后重启' },
                { status: 500 }
            )
        }

        // 支持两种验证模式：哈希密码（推荐）或明文密码（向后兼容）
        let isValid = false

        if (adminPasswordHash) {
            // 使用哈希密码验证（推荐）
            isValid = await verifyPassword(password, adminPasswordHash)
        } else {
            // 向后兼容：使用明文密码验证（常量时间比较）
            isValid = timingSafeCompare(password, adminPassword)
        }

        if (!isValid) {
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
            sameSite: 'strict', // 增强 CSRF 防护
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

// Helper endpoint to generate password hash (requires auth)
// Usage: curl -X PUT http://localhost:3000/api/auth -d '{"password":"your-password"}'
export async function PUT(request: NextRequest) {
    try {
        // 需要认证才能使用哈希生成工具
        const authCookie = request.cookies.get('emby-insight-auth')
        if (authCookie?.value !== 'authenticated') {
            return NextResponse.json(
                { error: '需要认证' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { password } = body

        if (!password) {
            return NextResponse.json(
                { error: 'Password is required' },
                { status: 400 }
            )
        }

        const hash = await hashPassword(password)

        return NextResponse.json({
            message: '将以下值设置为环境变量 ADMIN_PASSWORD_HASH',
            hash,
            example: `ADMIN_PASSWORD_HASH="${hash}"`
        })
    } catch (error) {
        console.error('[API] Hash generation failed:', error)
        return NextResponse.json({ error: 'Hash generation failed' }, { status: 500 })
    }
}
