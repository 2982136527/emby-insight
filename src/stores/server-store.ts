import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ServerConfig } from '@/types/emby'

interface ServerState {
    servers: ServerConfig[]
    activeServerId: string | null

    // Actions
    addServer: (server: ServerConfig) => void
    updateServer: (id: string, server: Partial<ServerConfig>) => void
    removeServer: (id: string) => void
    setActiveServer: (id: string | null) => void
    getActiveServer: () => ServerConfig | null
}

export const useServerStore = create<ServerState>()(
    persist(
        (set, get) => ({
            servers: [],
            activeServerId: null,

            addServer: (server) =>
                set((state) => ({
                    servers: [...state.servers, server],
                    activeServerId: state.activeServerId ?? server.id
                })),

            updateServer: (id, updates) =>
                set((state) => ({
                    servers: state.servers.map((s) =>
                        s.id === id ? { ...s, ...updates } : s
                    ),
                })),

            removeServer: (id) =>
                set((state) => {
                    const newServers = state.servers.filter((s) => s.id !== id)
                    return {
                        servers: newServers,
                        activeServerId: state.activeServerId === id
                            ? newServers[0]?.id ?? null
                            : state.activeServerId
                    }
                }),

            setActiveServer: (id) => set({ activeServerId: id }),

            getActiveServer: () => {
                const state = get()
                return state.servers.find((s) => s.id === state.activeServerId) ?? null
            },
        }),
        {
            name: 'emby-insight-servers',
        }
    )
)

// UI State Store
interface UIState {
    sidebarOpen: boolean
    selectedUserId: string | null
    selectedGlobalUserId: string | null
    dateRange: {
        from: Date | null
        to: Date | null
    }

    // Actions
    setSidebarOpen: (open: boolean) => void
    setSelectedUserId: (id: string | null) => void
    setSelectedGlobalUserId: (id: string | null) => void
    setDateRange: (from: Date | null, to: Date | null) => void
}

export const useUIStore = create<UIState>()((set) => ({
    sidebarOpen: true,
    selectedUserId: null,
    selectedGlobalUserId: null,
    dateRange: {
        from: null,
        to: null,
    },

    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setSelectedUserId: (id) => set({ selectedUserId: id }),
    setSelectedGlobalUserId: (id) => set({ selectedGlobalUserId: id }),
    setDateRange: (from, to) => set({ dateRange: { from, to } }),
}))
