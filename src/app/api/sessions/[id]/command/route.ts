import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import axios from 'axios'

export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const { command, text } = await request.json()
        const sessionLogId = params.id

        // 1. Get Session Log to find Server and SessionId
        const sessionLog = await prisma.sessionLog.findUnique({
            where: { id: sessionLogId },
        })

        if (!sessionLog) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        if (!sessionLog.isActive) {
            return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
        }

        // 2. Get Server Config
        const server = await prisma.server.findUnique({
            where: { id: sessionLog.serverId },
        })

        if (!server) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 })
        }

        const headers = {
            'X-Emby-Token': server.apiKey,
            'Content-Type': 'application/json',
        }

        // 3. Execute Command
        if (command === 'stop') {
            await axios.post(
                `${server.url}/Sessions/${sessionLog.sessionId}/Stopping`,
                {},
                { headers }
            )

            // Mark as inactive in DB immediately
            await prisma.sessionLog.update({
                where: { id: sessionLogId },
                data: { isActive: false, endedAt: new Date() }
            })

        } else if (command === 'message') {
            if (!text) {
                return NextResponse.json({ error: 'Message text is required' }, { status: 400 })
            }

            await axios.post(
                `${server.url}/Sessions/${sessionLog.sessionId}/Message`,
                { Header: '来自管理员的消息', Text: text, TimeoutMs: 10000 },
                { headers }
            )
        } else {
            return NextResponse.json({ error: 'Invalid command' }, { status: 400 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Session command failed:', error)
        return NextResponse.json({ error: 'Command failed' }, { status: 500 })
    }
}
