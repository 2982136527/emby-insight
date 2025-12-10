'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  PlayCircle,
  CalendarDays,
  Server,
  Film,
  Tv,
  Loader2,
  TrendingUp,
  ArrowRight,

  Download,
  LayoutDashboard,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDashboardConfig } from '@/hooks/use-dashboard-config'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDuration, ticksToHours } from '@/types/emby'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ComparisonCards } from '@/components/comparison-cards'
import { TagCloud } from '@/components/tag-cloud'
import { DailyReportButton } from '@/components/daily-report'

interface DashboardData {
  overview: {
    totalPlayDuration: number
    totalPlayCount: number
    totalItemCount: number
    todayPlayCount: number
    activeDays: number
    serverCount: number
    weekChange: number
  }
  serverDistribution: Array<{
    serverId: string
    serverName: string
    playDuration: number
    playCount: number
  }>
  dailyTrend: Array<{
    date: string
    duration: number
  }>
  topItems: Array<{
    itemId: string
    itemName: string
    imageUrl: string | null
    itemType: string
    playDuration: number
    playCount: number
    serverName?: string
    serverId?: string
  }>
  recentActivity: Array<{
    id: string
    itemName: string
    itemId: string
    imageUrl: string
    itemType: string
    seriesName: string | null
    playedAt: string
    playDuration: number
    totalDuration: number
    playbackPosition: number
    userName: string
    serverName: string
    serverId: string
  }>
  itemTypeStats: Array<{
    type: string
    playDuration: number
    playCount: number
  }>
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/stats/dashboard')
      if (!res.ok) throw new Error('Failed to fetch dashboard data')
      return res.json()
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  })

  const { config, toggle, mounted } = useDashboardConfig()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
      </div>
    )
  }

  const chartData = data.dailyTrend.map((d) => ({
    ...d,
    hours: ticksToHours(d.duration),
    formatted: formatDuration(d.duration),
    label: format(parseISO(d.date), 'M/d'),
  }))

  // Assuming trendData is the same as chartData for the BarChart
  const trendData = chartData;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">仪表盘</h1>
          <p className="text-muted-foreground">
            Emby 服务器数据的完整概览
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DailyReportButton />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/export?type=playhistory', '_blank')}
          >
            <Download className="h-4 w-4 mr-2" />
            导出数据
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                自定义
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>仪表盘布局</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={config.overview} onCheckedChange={() => toggle('overview')}>
                概览卡片
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={config.comparison} onCheckedChange={() => toggle('comparison')}>
                数据对比
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={config.charts} onCheckedChange={() => toggle('charts')}>
                图表分析
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={config.tagCloud} onCheckedChange={() => toggle('tagCloud')}>
                标签云
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={config.topWatched} onCheckedChange={() => toggle('topWatched')}>
                常看内容
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={config.recentActivity} onCheckedChange={() => toggle('recentActivity')}>
                最近活动
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Overview Cards - Compact Version */}
      {config.overview && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card className="bg-gradient-to-br from-violet-500/10 to-transparent border-violet-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">总时长</p>
                  <p className="text-xl font-bold">{formatDuration(data.overview.totalPlayDuration)}</p>
                </div>
                <Clock className="h-5 w-5 text-violet-500" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                <span className={data.overview.weekChange >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                  {data.overview.weekChange >= 0 ? '↑' : '↓'} {Math.abs(data.overview.weekChange)}%
                </span> vs 上周
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-transparent border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">影片数量</p>
                  <p className="text-xl font-bold">{data.overview.totalItemCount?.toLocaleString() ?? 0}</p>
                </div>
                <Film className="h-5 w-5 text-cyan-500" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">已看影片</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">今日影片</p>
                  <p className="text-xl font-bold">{data.overview.todayPlayCount.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">今日新增</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">活跃天数</p>
                  <p className="text-xl font-bold">{data.overview.activeDays}</p>
                </div>
                <CalendarDays className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">有播放记录</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">服务器</p>
                  <p className="text-xl font-bold">{data.overview.serverCount}</p>
                </div>
                <Server className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">已配置</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comparison Cards */}
      {config.comparison && <ComparisonCards />}


      {/* Charts Row with TagCloud */}
      {config.charts && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Trend Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                观看趋势
              </CardTitle>
              <CardDescription className="text-xs">过去 30 天每日统计</CardDescription>
            </CardHeader>
            <CardContent className="pl-0 pb-2">
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval={6}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}h`}
                      width={30}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(_, __, props) => {
                        const item = chartData.find(d => d.label === props?.payload?.label)
                        return [item?.formatted || '0m', '观看时长']
                      }}
                    />
                    <Bar
                      dataKey="hours"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Server Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Server className="h-4 w-4" />
                服务器分布
              </CardTitle>
              <CardDescription className="text-xs">按播放次数统计</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="h-[160px]">
                {data.serverDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.serverDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="playCount"
                        nameKey="serverName"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={(props: any) =>
                          `${props.serverName} ${((props.percent || 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                        className="text-xs"
                      >
                        {data.serverDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                        formatter={(value: number) => [value, '播放次数']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tag Cloud - inline with charts */}
          {config.tagCloud && <TagCloud compact />}
        </div>
      )}

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Top Watched */}
        {config.topWatched && (
          <Card className="col-span-4 flex flex-col h-[850px]">
            <CardHeader className="flex-none">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Film className="h-5 w-5" />
                    常看内容
                  </CardTitle>
                  <CardDescription>按总观看时长排序</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/leaderboard?tab=media" className="gap-1">
                    查看全部 <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-full px-4 pb-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {data.topItems.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-muted-foreground">
                      暂无观看数据
                    </div>
                  ) : (
                    data.topItems.slice(0, 20).map((item, index) => (
                      <Link
                        key={item.itemId}
                        href={`/media/${item.itemId}?serverId=${item.serverId}`}
                        className="group relative overflow-hidden rounded-xl bg-muted/40 border transition-all hover:scale-[1.02] hover:shadow-lg hover:bg-muted/60 cursor-pointer"
                      >
                        {/* Rank Badge */}
                        <div className={`absolute top-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ${index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-slate-400' :
                            index === 2 ? 'bg-orange-500' :
                              'bg-primary/80'
                          }`}>
                          {index + 1}
                        </div>

                        <div className="aspect-[2/3] w-full relative overflow-hidden">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.itemName}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted">
                              {item.itemType === 'Movie' ? (
                                <Film className="h-10 w-10 text-muted-foreground/50" />
                              ) : (
                                <Tv className="h-10 w-10 text-muted-foreground/50" />
                              )}
                            </div>
                          )}

                          {/* Overlay Info */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-12 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <div className="text-xs font-medium">总时长</div>
                            <div className="text-base font-bold">{formatDuration(item.playDuration)}</div>
                          </div>
                        </div>

                        <div className="p-3">
                          <h3 className="font-semibold line-clamp-1 text-sm mb-1" title={item.itemName}>
                            {item.itemName}
                          </h3>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              {item.itemType === 'Movie' ? '电影' : '剧集'}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <PlayCircle className="h-3 w-3" />
                              {item.playCount}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {config.recentActivity && (
          <Card className="col-span-3 flex flex-col h-[850px]">
            <CardHeader className="flex-none">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                最近活动
              </CardTitle>
              <CardDescription>最新的播放记录</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-full px-6 pb-6">
                <div className="space-y-4">
                  {data.recentActivity.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      暂无活动记录
                    </div>
                  ) : (
                    data.recentActivity.map((activity) => (
                      <Link
                        key={activity.id}
                        href={`/media/${activity.itemId}?serverId=${activity.serverId}`}
                        className="group flex flex-col sm:flex-row gap-4 p-3 rounded-xl border bg-card/50 hover:bg-accent/50 transition-all hover:shadow-md cursor-pointer"
                      >
                        {/* Cover Image */}
                        <div className="relative w-full sm:w-24 aspect-video sm:aspect-[2/3] rounded-lg overflow-hidden border bg-muted shrink-0 shadow-sm">
                          <img
                            src={activity.imageUrl}
                            alt={activity.itemName}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div className="space-y-1.5">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="h-5 text-[10px] font-normal border-primary/20 text-primary">
                                    {activity.userName}
                                  </Badge>
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-secondary/50 font-normal">
                                    {activity.serverName}
                                  </Badge>
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(activity.playedAt), 'MM-dd HH:mm', { locale: zhCN })}
                                </span>
                              </div>
                              <h4 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground/90">
                                {activity.seriesName && (
                                  <span className="text-muted-foreground font-normal">{activity.seriesName} - </span>
                                )}
                                {activity.itemName}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                              <span>{formatDuration(activity.playDuration)}</span>
                            </div>
                          </div>

                          {/* Progress Bar Container */}
                          <div className="mt-3">
                            {activity.totalDuration > 0 && (() => {
                              const position = activity.playbackPosition || (activity.playDuration > activity.totalDuration * 0.9 ? activity.totalDuration : 0)
                              const percentage = Math.min(100, (position / activity.totalDuration) * 100)
                              return (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>观看进度</span>
                                    <span>{percentage.toFixed(0)}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary rounded-full transition-all duration-500"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
