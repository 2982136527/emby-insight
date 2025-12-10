'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'

interface ServerSelectorProps {
    value?: string[]
    onChange: (value: string[] | undefined) => void
    className?: string
}

interface Server {
    id: string
    name: string
}

export function ServerSelector({ value = [], onChange, className }: ServerSelectorProps) {
    const [open, setOpen] = React.useState(false)

    const { data: servers, isLoading } = useQuery<Server[]>({
        queryKey: ['servers'],
        queryFn: async () => {
            const res = await fetch('/api/servers')
            if (!res.ok) throw new Error('Failed to fetch servers')
            return res.json()
        },
    })

    const selectedValues = new Set(value || [])

    // If no value selected, we assume "All Servers" is implied in parent, 
    // but in UI we might want to show "All Servers" if count is 0.

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-[200px] justify-between", className)}
                >
                    <div className="flex items-center gap-2 truncate">
                        <Server className="h-4 w-4 shrink-0 opacity-50" />
                        {selectedValues.size === 0 ? (
                            "所有服务器"
                        ) : (
                            <div className="flex gap-1 overflow-hidden">
                                {selectedValues.size === servers?.length ? (
                                    "所有服务器"
                                ) : (
                                    <span className="truncate">
                                        已选 {selectedValues.size} 个
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="搜索服务器..." />
                    <CommandList>
                        <CommandEmpty>No server found.</CommandEmpty>
                        <CommandGroup>
                            {/* Option to clear/select all could be added here */}
                            {servers?.map((server) => (
                                <CommandItem
                                    key={server.id}
                                    value={server.name}
                                    onSelect={() => {
                                        const newSelected = new Set(selectedValues)
                                        if (newSelected.has(server.id)) {
                                            newSelected.delete(server.id)
                                        } else {
                                            newSelected.add(server.id)
                                        }
                                        onChange(newSelected.size > 0 ? Array.from(newSelected) : undefined)
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            selectedValues.has(server.id)
                                                ? "bg-primary text-primary-foreground"
                                                : "opacity-50 [&_svg]:invisible"
                                        )}
                                    >
                                        <Check className={cn("h-4 w-4")} />
                                    </div>
                                    <span>{server.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
