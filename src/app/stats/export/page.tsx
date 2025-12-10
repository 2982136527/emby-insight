'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Users, Calendar, Loader2, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ExportOption {
    id: string
    title: string
    description: string
    icon: React.ReactNode
    type: string
}

const exportOptions: ExportOption[] = [
    {
        id: 'playhistory',
        title: '播放历史',
        description: '导出所有播放记录，包含日期、用户、影片、时长、进度等信息',
        icon: <FileSpreadsheet className="h-8 w-8 text-blue-500" />,
        type: 'playhistory',
    },
    {
        id: 'users',
        title: '用户统计',
        description: '导出用户数据，包含用户名、服务器、播放次数、总时长等',
        icon: <Users className="h-8 w-8 text-green-500" />,
        type: 'users',
    },
    {
        id: 'daily',
        title: '每日统计',
        description: '导出每日观看时长汇总数据',
        icon: <Calendar className="h-8 w-8 text-violet-500" />,
        type: 'daily',
    },
]

export default function ExportPage() {
    const [downloading, setDownloading] = useState<string | null>(null)
    const [completed, setCompleted] = useState<string | null>(null)

    const handleExport = async (type: string) => {
        setDownloading(type)
        setCompleted(null)

        try {
            const response = await fetch(`/api/export?type=${type}`)
            if (!response.ok) throw new Error('Export failed')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition')
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
            const filename = filenameMatch ? filenameMatch[1] : `export_${type}.csv`

            // Create download link and trigger
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)

            setCompleted(type)
            setTimeout(() => setCompleted(null), 3000)
        } catch (error) {
            console.error('Export failed:', error)
            alert('导出失败，请重试')
        } finally {
            setDownloading(null)
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <Download className="h-8 w-8 text-primary" />
                    数据导出
                </h1>
                <p className="text-muted-foreground">导出您的观看数据为 CSV 格式</p>
            </div>

            {/* Info Card */}
            <Card className="bg-muted/50">
                <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                        导出的 CSV 文件采用 UTF-8 编码，可在 Excel、Numbers 或其他电子表格软件中打开。
                        播放历史最多导出 10,000 条记录。
                    </p>
                </CardContent>
            </Card>

            {/* Export Options */}
            <div className="grid gap-4 md:grid-cols-3">
                {exportOptions.map(option => (
                    <Card key={option.id} className="transition-all hover:border-primary/50">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                {option.icon}
                                <div>
                                    <CardTitle className="text-lg">{option.title}</CardTitle>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="mb-4">{option.description}</CardDescription>
                            <Button
                                className="w-full"
                                onClick={() => handleExport(option.type)}
                                disabled={downloading !== null}
                            >
                                {downloading === option.type ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        导出中...
                                    </>
                                ) : completed === option.type ? (
                                    <>
                                        <Check className="h-4 w-4 mr-2 text-green-500" />
                                        已下载
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4 mr-2" />
                                        导出 CSV
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
