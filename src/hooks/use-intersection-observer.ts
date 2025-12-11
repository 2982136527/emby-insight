import { useEffect, useState, useRef, RefObject } from 'react'

interface UseIntersectionObserverArgs extends IntersectionObserverInit {
    freezeOnceVisible?: boolean
}

export function useIntersectionObserver({
    threshold = 0,
    root = null,
    rootMargin = '0%',
    freezeOnceVisible = false,
}: UseIntersectionObserverArgs = {}): [RefObject<HTMLDivElement | null>, boolean] {
    const [entry, setEntry] = useState<IntersectionObserverEntry>()
    const [frozen, setFrozen] = useState(false)
    const elementRef = useRef<HTMLDivElement>(null)

    const frozenState = entry?.isIntersecting && freezeOnceVisible

    const updateEntry = ([entry]: IntersectionObserverEntry[]): void => {
        setEntry(entry)
    }

    useEffect(() => {
        const node = elementRef.current // Capture current node
        const hasIOSupport = !!window.IntersectionObserver

        if (!hasIOSupport || frozen || !node) return

        const observerParams = { threshold, root, rootMargin }
        const observer = new IntersectionObserver(updateEntry, observerParams)

        observer.observe(node)

        return () => observer.disconnect()
    }, [elementRef, JSON.stringify(threshold), root, rootMargin, frozen])

    return [elementRef, !!entry?.isIntersecting]
}
