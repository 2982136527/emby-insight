import { NextResponse } from 'next/server'

/**
 * 标准化 API 成功响应
 */
export function successResponse<T>(data: T, status: number = 200) {
    return NextResponse.json(data, { status })
}

/**
 * 标准化 API 错误响应
 */
export function errorResponse(
    message: string,
    status: number = 500,
    code?: string
) {
    return NextResponse.json(
        { error: message, code: code || `E${status}` },
        { status }
    )
}

/**
 * API 请求耗时记录
 */
export function logApiRequest(
    method: string,
    path: string,
    startTime: number,
    status: number
) {
    const duration = Date.now() - startTime
    console.log(`[API] ${method} ${path} - ${status} (${duration}ms)`)
}

/**
 * 安全序列化 BigInt 为 Number
 */
export function serializeBigInt<T>(obj: T): T {
    return JSON.parse(
        JSON.stringify(obj, (_key, value) =>
            typeof value === 'bigint' ? Number(value) : value
        )
    )
}
