'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Lock, Loader2, Film } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            })

            if (res.ok) {
                toast.success('登录成功')
                router.push('/')
                router.refresh()
            } else {
                const data = await res.json()
                toast.error(data.error || '登录失败')
            }
        } catch {
            toast.error('网络错误，请重试')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-4">
                        <Film className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-2xl">EmbyInsight</CardTitle>
                    <CardDescription>请输入管理员密码以登录</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    placeholder="输入密码"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading || !password}>
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    登录中...
                                </>
                            ) : (
                                '登录'
                            )}
                        </Button>
                    </form>
                    <p className="text-xs text-muted-foreground text-center mt-4">
                        默认密码: admin123<br />
                        可通过环境变量 ADMIN_PASSWORD 自定义
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
