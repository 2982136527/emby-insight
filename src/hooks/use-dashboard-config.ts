import { useState, useEffect } from 'react'

export interface DashboardConfig {
    overview: boolean
    comparison: boolean
    charts: boolean
    tagCloud: boolean
    topWatched: boolean
    recentActivity: boolean
}

const DEFAULT_CONFIG: DashboardConfig = {
    overview: true,
    comparison: true,
    charts: true,
    tagCloud: true,
    topWatched: true,
    recentActivity: true,
}

export function useDashboardConfig() {
    const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('dashboard-config')
        if (saved) {
            try {
                setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) })
            } catch (e) {
                console.error('Failed to parse dashboard config', e)
            }
        }
        setMounted(true)
    }, [])

    const toggle = (key: keyof DashboardConfig) => {
        const newConfig = { ...config, [key]: !config[key] }
        setConfig(newConfig)
        localStorage.setItem('dashboard-config', JSON.stringify(newConfig))
    }

    return { config, toggle, mounted }
}
