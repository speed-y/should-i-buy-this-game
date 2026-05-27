'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GameData } from '../types'

interface SearchBarProps {
  onSelectGame?: (game: GameData) => void
  placeholder?: string
}

export default function SearchBar({
  onSelectGame,
  placeholder = 'Search for a game...',
}: SearchBarProps): React.JSX.Element {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GameData[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = query.trim()
    if (!trimmed) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
          if (res.ok) {
            const data = (await res.json()) as GameData[]
            setSuggestions(data)
            setIsOpen(true)
            setSelectedIndex(-1)
          }
        } catch (err) {
          console.error('Failed to load suggestions:', err)
        } finally {
          setIsLoading(false)
        }
      })()
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleSelect = (game: GameData): void => {
    setQuery('')
    setIsOpen(false)
    setSuggestions([])

    if (onSelectGame) {
      onSelectGame(game)
    } else {
      router.push(`/game/${game.slug}`)
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelect(suggestions[selectedIndex])
      } else if (suggestions.length > 0) {
        handleSelect(suggestions[0])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative z-50 mx-auto w-full max-w-2xl" ref={dropdownRef}>
      {/* Search Input Field */}
      <div className="glass-input-wrapper flex w-full items-center px-6 py-4">
        <svg
          className="mr-4 h-6 w-6 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-lg font-light text-white placeholder-slate-400 focus:outline-none"
        />
        {isLoading && (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-violet-500 border-r-transparent border-b-transparent border-l-transparent"></div>
        )}
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && suggestions.length > 0 && (
        <div className="glass-panel dropdown-panel absolute top-full right-0 left-0 z-50 mt-3 overflow-hidden p-2">
          <ul className="custom-scrollbar flex max-h-72 flex-col gap-1 overflow-x-hidden overflow-y-auto">
            {suggestions.map((game, index) => (
              <li
                key={game.slug}
                onClick={() => handleSelect(game)}
                className={`autocomplete-item flex cursor-pointer items-center justify-between rounded-xl p-3 ${
                  index === selectedIndex ? 'translate-x-1 bg-white/10' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {game.backgroundImage ? (
                    React.createElement('img', {
                      src: game.backgroundImage,
                      alt: game.name,
                      className: 'h-8 w-12 rounded-lg object-cover',
                    })
                  ) : (
                    <div className="flex h-8 w-12 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-400">
                      N/A
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm leading-tight font-medium text-white">{game.name}</h4>
                    {game.rating && (
                      <span className="text-xs text-slate-400">⭐ {game.rating.toFixed(1)}</span>
                    )}
                  </div>
                </div>

                {game.metacritic && (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      game.metacritic >= 75
                        ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        : game.metacritic >= 50
                          ? 'border border-amber-500/20 bg-amber-500/10 text-amber-400'
                          : 'border border-rose-500/20 bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {game.metacritic}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
